"""User profile HTTP routes (backend_rules.md §2.2: thin routes).

Endpoints:
  GET    /api/v1/users/me
  PUT    /api/v1/users/me
  DELETE /api/v1/users/me
  POST   /api/v1/users/me/fcm-tokens
  DELETE /api/v1/users/me/fcm-tokens/{token}
  GET    /api/v1/users/me/consents
  POST   /api/v1/users/me/consents
  GET    /api/v1/users/me/export
"""

from __future__ import annotations

from fastapi import APIRouter, Request, status

from app.modules.auth.dependencies import CurrentUser
from app.modules.users.dependencies import UserServiceDep
from app.modules.users.schemas import (
    AvatarUploadResponse,
    ConsentCreate,
    ConsentResponse,
    DataExportResponse,
    DeleteAccountResponse,
    FCMTokenCreate,
    FCMTokenResponse,
    ProfileResponse,
    ProfileUpdate,
)

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/me",
    response_model=ProfileResponse,
    summary="Get own user profile",
)
async def get_profile(
    current_user: CurrentUser,
    svc: UserServiceDep,
) -> ProfileResponse:
    user = await svc.get_profile(current_user.id)
    return ProfileResponse.model_validate(user)


@router.put(
    "/me",
    response_model=ProfileResponse,
    summary="Update user profile (name, DOB, blood group, medical notes)",
)
async def update_profile(
    payload: ProfileUpdate,
    current_user: CurrentUser,
    svc: UserServiceDep,
) -> ProfileResponse:
    user = await svc.update_profile(current_user.id, payload)
    return ProfileResponse.model_validate(user)


@router.delete(
    "/me",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=DeleteAccountResponse,
    summary="Soft delete account (GDPR erasure queued)",
)
async def delete_account(
    current_user: CurrentUser,
    svc: UserServiceDep,
) -> DeleteAccountResponse:
    await svc.soft_delete(current_user.id)
    return DeleteAccountResponse()


@router.get(
    "/me/export",
    response_model=DataExportResponse,
    summary="Export all personal data (GDPR portability)",
)
async def export_data(
    current_user: CurrentUser,
    svc: UserServiceDep,
) -> DataExportResponse:
    return await svc.export_user_data(current_user.id)


@router.post(
    "/me/avatar",
    response_model=AvatarUploadResponse,
    summary="Upload avatar (returns presigned S3 URL — stub for now)",
)
async def upload_avatar(
    current_user: CurrentUser,
) -> AvatarUploadResponse:
    return AvatarUploadResponse(url=f"https://avatars.shecare.app/{current_user.id}.jpg")


@router.post(
    "/me/fcm-tokens",
    response_model=FCMTokenResponse,
    summary="Register an FCM push notification token",
)
async def register_fcm_token(
    payload: FCMTokenCreate,
    current_user: CurrentUser,
    svc: UserServiceDep,
) -> FCMTokenResponse:
    tokens = await svc.register_fcm_token(current_user.id, payload.token)
    return FCMTokenResponse(tokens=tokens)


@router.delete(
    "/me/fcm-tokens/{token}",
    response_model=FCMTokenResponse,
    summary="Remove an FCM push notification token",
)
async def remove_fcm_token(
    token: str,
    current_user: CurrentUser,
    svc: UserServiceDep,
) -> FCMTokenResponse:
    tokens = await svc.remove_fcm_token(current_user.id, token)
    return FCMTokenResponse(tokens=tokens)


@router.get(
    "/me/consents",
    response_model=list[ConsentResponse],
    summary="List user consent records",
)
async def list_consents(
    current_user: CurrentUser,
    svc: UserServiceDep,
) -> list[ConsentResponse]:
    consents = await svc.list_consents(current_user.id)
    return [ConsentResponse.model_validate(c) for c in consents]


@router.post(
    "/me/consents",
    response_model=ConsentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record user consent (privacy policy, AI analysis, etc.)",
)
async def record_consent(
    payload: ConsentCreate,
    request: Request,
    current_user: CurrentUser,
    svc: UserServiceDep,
) -> ConsentResponse:
    consent = await svc.record_consent(
        user_id=current_user.id,
        consent_type=payload.consent_type,
        version=payload.version,
        granted=payload.granted,
        ip_hash=request.client.host if request.client else None,
    )
    return ConsentResponse.model_validate(consent)


def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")
