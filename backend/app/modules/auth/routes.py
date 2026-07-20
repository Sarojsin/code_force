"""Auth HTTP routes (rule §2.2: thin — delegate to AuthService).

Endpoints:
  POST /api/v1/auth/register          (email + password registration)
  POST /api/v1/auth/login             (email + password login, rate-limited)
  POST /api/v1/auth/otp/request
  POST /api/v1/auth/otp/verify
  POST /api/v1/auth/refresh           (rotate refresh token, replay-protected)
  POST /api/v1/auth/logout            (revoke current access + refresh)
  GET  /api/v1/auth/me                (current user profile — mobile hydration)
  POST /api/v1/auth/mfa/enable        (issue TOTP secret; user must verify)
  POST /api/v1/auth/mfa/verify-setup  (confirm TOTP code, flip mfa_enabled)
  POST /api/v1/auth/mfa/login         (complete MFA challenge)
  POST /api/v1/auth/password          (set/change password)
  POST /api/v1/auth/password/change   (change with old-password check, revokes all)
  GET  /api/v1/auth/sessions          (list active sessions for the user)
  DELETE /api/v1/auth/sessions/{id}   (revoke a specific session)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select

from app.core.config import get_settings
from app.core.rate_limit import RateLimiter
from app.core.redis_client import get_redis_client
from app.core.security import decode_token, get_current_user_id
from app.core.token_revocation import TokenRevocationStore
from app.modules.auth.dependencies import AuthServiceDep, CurrentUser
from app.modules.auth.models import UserSession
from app.modules.auth.schemas import (
    DeviceRegisterCreate,
    DeviceRegisterResponse,
    LoginCreate,
    LoginResponse,
    LogoutCreate,
    MFAEnableResponse,
    MFALoginCreate,
    MFAVerifyCreate,
    OTPRequestCreate,
    OTPRequestResponse,
    OTPVerifyCreate,
    PasswordChangeCreate,
    PasswordLoginCreate,
    PasswordSetCreate,
    RefreshTokenCreate,
    RegisterCreate,
    TokenPair,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _rate_limiter() -> RateLimiter:
    return RateLimiter(get_redis_client())


# ---- Email + Password register / login ----


@router.post(
    "/register",
    response_model=LoginResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new account with email + password",
)
async def register(
    payload: RegisterCreate,
    svc: AuthServiceDep,
) -> LoginResponse:
    user, tokens = await svc.register(
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
    )
    resp = UserResponse.model_validate(user)
    resp.onboarding_completed = await svc.get_onboarding_status(user.id)
    return LoginResponse(
        user=resp,
        tokens=tokens,
        requires_mfa=False,
    )


@router.post(
    "/login",
    response_model=LoginResponse,
    summary="Email + password login",
)
async def login(
    payload: LoginCreate,
    svc: AuthServiceDep,
) -> LoginResponse:
    await _rate_limiter().check(f"login:{payload.email}", limit=10, window_seconds=600)
    user, tokens = await svc.login_with_email(
        email=payload.email,
        password=payload.password,
        device_info=payload.device_info,
    )
    resp = UserResponse.model_validate(user)
    resp.onboarding_completed = await svc.get_onboarding_status(user.id)
    return LoginResponse(
        user=resp,
        tokens=tokens,
        requires_mfa=False,
    )


# ---- OTP ----


@router.post(
    "/otp/request",
    response_model=OTPRequestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Send an OTP to the given phone number",
)
async def request_otp(
    payload: OTPRequestCreate,
    svc: AuthServiceDep,
) -> OTPRequestResponse:
    # Plan 24: 5 requests per 10 minutes per phone.
    await _rate_limiter().check(f"otp_request:{payload.phone}", limit=5, window_seconds=600)
    dev_code, ttl = await svc.request_otp(payload.phone)
    return OTPRequestResponse(expires_in=ttl, dev_code=dev_code)


@router.post(
    "/otp/verify",
    response_model=LoginResponse,
    summary="Verify OTP and issue access + refresh tokens (or an MFA challenge)",
)
async def verify_otp(
    payload: OTPVerifyCreate,
    svc: AuthServiceDep,
) -> LoginResponse:
    user, tokens, requires_mfa = await svc.verify_otp(
        payload.phone, payload.otp, device_info=payload.device_info,
    )
    return LoginResponse(
        user=UserResponse.model_validate(user),
        tokens=tokens,
        requires_mfa=requires_mfa,
    )


# ---- Password login (phone, optional) ----


@router.post(
    "/login/phone",
    response_model=LoginResponse,
    summary="Phone + password login (alternative to OTP)",
)
async def login_phone(
    payload: PasswordLoginCreate,
    svc: AuthServiceDep,
) -> LoginResponse:
    await _rate_limiter().check(f"login:{payload.phone}", limit=10, window_seconds=600)
    user, tokens, requires_mfa = await svc.login_with_password(
        payload.phone, payload.password, device_info=payload.device_info,
    )
    return LoginResponse(
        user=UserResponse.model_validate(user),
        tokens=tokens,
        requires_mfa=requires_mfa,
    )


# ---- Refresh rotation ----


@router.post(
    "/refresh",
    response_model=TokenPair,
    summary="Rotate refresh token; reuse of an old token revokes the session family",
)
async def refresh(
    payload: RefreshTokenCreate,
    svc: AuthServiceDep,
) -> TokenPair:
    return await svc.rotate_refresh_token(
        payload.refresh_token, device_info=payload.device_info,
    )


# ---- Logout / revocation ----


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke the current access token (and optionally all sessions)",
)
async def logout(
    request: Request,
    payload: LogoutCreate,
    svc: AuthServiceDep,
    token_payload=Depends(get_current_user_id),
) -> Response:
    import uuid as _uuid
    user_id_str = token_payload.get("sub")
    if not user_id_str:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    user_id = _uuid.UUID(user_id_str)
    settings = get_settings().jwt
    auth_header = request.headers.get("Authorization", "")
    jti = token_payload.get("jti", "")
    if not jti and auth_header.lower().startswith("bearer "):
        try:
            claims = decode_token(
                auth_header.split(" ", 1)[1],
                secret=settings.secret_key,
                expected_type="access",
                algorithm=settings.algorithm,
            )
            jti = claims.get("jti", "")
        except HTTPException:
            pass
    if jti:
        store = TokenRevocationStore(get_redis_client())
        await store.revoke(jti, ttl_seconds=settings.access_token_expire_minutes * 60)
    if payload.all_devices:
        await svc.logout(user_id, jti or "all")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---- MFA ----


@router.post(
    "/mfa/enable",
    response_model=MFAEnableResponse,
    summary="Generate a TOTP secret for the authenticated user (does not flip mfa_enabled)",
)
async def mfa_enable(current_user: CurrentUser, svc: AuthServiceDep) -> MFAEnableResponse:
    secret, otpauth_uri = await svc.enable_mfa(current_user.id)
    return MFAEnableResponse(secret=secret, otpauth_uri=otpauth_uri)


@router.post(
    "/mfa/verify-setup",
    summary="Confirm a fresh TOTP code; flips mfa_enabled=true on success",
)
async def mfa_verify_setup(
    payload: MFAVerifyCreate,
    current_user: CurrentUser,
    svc: AuthServiceDep,
) -> dict[str, bool]:
    ok = await svc.verify_mfa_setup(current_user.id, payload.code)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "MFA_INVALID", "details": "Code did not match"},
        )
    return {"enabled": True}


@router.post(
    "/mfa/login",
    response_model=TokenPair,
    summary="Complete the MFA challenge: exchange the challenge access token + TOTP code for a real token pair",
)
async def mfa_login(
    payload: MFALoginCreate,
    svc: AuthServiceDep,
) -> TokenPair:
    import uuid as _uuid

    from app.core.config import get_settings
    from app.core.security import decode_token

    settings = get_settings().jwt
    # Accept the challenge token (signed with the access secret, type=access).
    claims = decode_token(
        payload.mfa_token, secret=settings.secret_key, expected_type="access", algorithm=settings.algorithm,
    )
    user_id = _uuid.UUID(claims["sub"])
    from app.modules.auth.models import User
    user = (await svc.db.execute(select(User).where(User.id == user_id))).scalar_one()
    return await svc.verify_mfa_login(user, payload.code, device_info=payload.device_info)


# ---- Profile ----


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get the authenticated user's profile (used by mobile hydration)",
)
async def get_me(
    current_user: CurrentUser,
    svc: AuthServiceDep,
) -> UserResponse:
    onboarding_completed = await svc.get_onboarding_status(current_user.id)
    resp = UserResponse.model_validate(current_user)
    resp.onboarding_completed = onboarding_completed
    return resp


# ---- Password management ----


@router.post(
    "/password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Set or change the user's password",
)
async def set_password(
    payload: PasswordSetCreate,
    current_user: CurrentUser,
    svc: AuthServiceDep,
) -> Response:
    await svc.set_password(current_user.id, payload.new_password)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/password/change",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Change password with old-password verification (rotates usk, revokes all sessions)",
)
async def change_password(
    payload: PasswordChangeCreate,
    current_user: CurrentUser,
    svc: AuthServiceDep,
) -> Response:
    await svc.change_password(current_user.id, payload.old_password, payload.new_password)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---- Session management (plan 40) ----


@router.get(
    "/sessions",
    summary="List active sessions for the current user",
)
async def list_sessions(
    current_user: CurrentUser,
    svc: AuthServiceDep,
) -> list[dict]:
    stmt = (
        select(UserSession)
        .where(UserSession.user_id == current_user.id)
        .where(UserSession.is_active.is_(True))
        .order_by(UserSession.last_used_at.desc())
    )
    sessions = (await svc.db.execute(stmt)).scalars().all()
    return [
        {
            "id": str(s.id),
            "device_info": s.device_info,
            "last_used_at": s.last_used_at.isoformat(),
            "expires_at": s.expires_at.isoformat(),
        }
        for s in sessions
    ]


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke a specific session (remote logout)",
)
async def revoke_session(
    session_id: str,
    current_user: CurrentUser,
    svc: AuthServiceDep,
) -> Response:
    import uuid as _uuid
    await svc.logout_session(current_user.id, _uuid.UUID(session_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---- Device Registration (used by Safety SOS push notifications) ----

@router.post(
    "/device/register",
    response_model=DeviceRegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a device FCM token for push notifications",
)
async def register_device(
    payload: DeviceRegisterCreate,
    current_user: CurrentUser,
    svc: AuthServiceDep,
) -> DeviceRegisterResponse:
    from sqlalchemy import select as _sel

    from app.modules.auth.models import User
    stmt = _sel(User).where(User.id == current_user.id)
    user = (await svc.db.execute(stmt)).scalar_one()
    tokens = list(user.fcm_tokens or [])
    if payload.fcm_token not in tokens:
        tokens.append(payload.fcm_token)
    user.fcm_tokens = tokens
    await svc.db.commit()
    return DeviceRegisterResponse(fcm_token_prefix=payload.fcm_token[:12])


# ---- module init hook (rule §15.1) ----

def init_module(app, event_bus) -> None:  # type: ignore[no-untyped-def]
    app.include_router(router, prefix="/api/v1")
