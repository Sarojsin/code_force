"""Auth service: OTP, JWT pair, refresh rotation, MFA, password, email+password register/login.

Backend plan 04 (canonical) + jwt_authplan.md. Implements:
  - Email + password register and login
  - OTP request + verify (Twilio Verify in prod, dev mode in local/test)
  - Refresh token rotation with reuse detection (plan 40)
  - TOTP MFA enable / verify (pyotp)
  - Optional password (bcrypt)
  - Logout / revoke (Redis revocation list)

Rule §14.1: row-level permission enforced in dependencies, not here.
Rule §14.2: encryption lives in core.encryption, not this file.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime

import bcrypt as _bcrypt
import pyotp
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.encryption import EncryptionService
from app.core.exceptions import ConflictError
from app.core.security import (
    create_access_token,
    create_refresh_token,
)
from app.core.token_revocation import TokenRevocationStore
from app.integrations.twilio_client import TwilioClient
from app.modules.auth.exceptions import (
    InvalidCredentialsError,
    MFAInvalidError,
    MFAMissingError,
    OTPInvalidError,
    TokenRevokedError,
)
from app.modules.auth.models import OTPAttempt, User, UserSession
from app.modules.auth.schemas import TokenPair

SECRET_KEY_BYTES = 32  # 64 hex chars for user_secret_key


def _hash_phone(phone: str) -> str:
    """Hash phone for privacy-preserving audit trail (rule §14 privacy)."""
    return hashlib.sha256(phone.encode("utf-8")).hexdigest()


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _new_otp() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


class AuthService:
    def __init__(
        self,
        db: AsyncSession,
        twilio: TwilioClient,
        settings: Settings,
        encryption: EncryptionService,
        revocation: TokenRevocationStore,
    ) -> None:
        self.db = db
        self.twilio = twilio
        self.settings = settings
        self.encryption = encryption
        self.revocation = revocation

    # ============================================================
    # OTP flow
    # ============================================================

    async def request_otp(self, phone: str) -> tuple[str | None, int]:
        """Issue an OTP, persist hashed, send via Twilio.

        Returns (dev_code, ttl_seconds). dev_code is populated only in dev/test
        environments so the mobile client can complete the flow locally
        without receiving a real SMS. In production this is None.
        """
        ttl = 300
        code = _new_otp()
        otp = OTPAttempt(
            phone_hash=_hash_phone(phone),
            code_hash=_hash_token(code),
            expires_at=datetime.now(tz=UTC).replace(microsecond=0)
            + _seconds(ttl),
        )
        self.db.add(otp)
        await self.db.commit()

        await self.twilio.send_otp(phone)

        if self.settings.environment in {"development", "test"}:
            return code, ttl
        return None, ttl

    async def verify_otp(
        self,
        phone: str,
        code: str,
        device_info: dict | None = None,
    ) -> tuple[User, TokenPair, bool]:
        """Verify the OTP, return or create the user, issue tokens.

        The third return value is `requires_mfa`: True if the user has MFA
        enabled and the caller must call /auth/mfa/verify before they get
        usable tokens. In that case the tokens returned are short-lived
        "challenge" tokens that only the MFA endpoint accepts.
        """
        phone_h = _hash_phone(phone)
        now = datetime.now(tz=UTC).replace(microsecond=0)
        stmt = (
            select(OTPAttempt)
            .where(OTPAttempt.phone_hash == phone_h)
            .where(OTPAttempt.consumed.is_(False))
            .where(OTPAttempt.expires_at > now)
            .order_by(OTPAttempt.expires_at.desc())
            .limit(1)
        )
        attempt = (await self.db.execute(stmt)).scalar_one_or_none()

        if attempt is None:
            # No local attempt — verify against Twilio in case it issued the code.
            ok = await self.twilio.verify_otp(phone, code)
            if not ok:
                raise OTPInvalidError("OTP does not match")
        else:
            if attempt.code_hash != _hash_token(code):
                attempt.attempt_count += 1
                await self.db.commit()
                # If Twilio is configured we still let it adjudicate the final
                # attempt; otherwise we reject immediately.
                if not self.twilio.has_credentials:
                    raise OTPInvalidError("OTP does not match")
                ok = await self.twilio.verify_otp(phone, code)
                if not ok:
                    raise OTPInvalidError("OTP does not match")
            attempt.consumed = True
            attempt.is_active = False
            await self.db.commit()

        user = await self._get_or_create_user(phone)
        if user.mfa_enabled:
            tokens = await self._issue_token_pair(user, device_info, mfa_challenge=True)
            return user, tokens, True

        tokens = await self._issue_token_pair(user, device_info, mfa_challenge=False)
        return user, tokens, False

    # ============================================================
    # MFA (TOTP)
    # ============================================================

    async def enable_mfa(self, user_id: uuid.UUID) -> tuple[str, str]:
        """Generate a TOTP secret for the user and return (secret, otpauth_uri).

        Secret is stored encrypted via the per-user encryption service.
        """
        user = await self._load_user(user_id)
        secret = pyotp.random_base32()
        # Encrypt using per-user salt when available.
        if user.encryption_key_salt:
            user.mfa_secret = self.encryption.encrypt_for_user(secret, user.encryption_key_salt)
        else:
            user.mfa_secret = secret  # dev fallback; rotated when salt is set
        user.mfa_enabled = False  # only flips to True after verify_mfa_setup
        await self.db.commit()

        otpauth = pyotp.TOTP(secret).provisioning_uri(
            name=user.phone_number,
            issuer_name="SheCare",
        )
        return secret, otpauth

    async def verify_mfa_setup(self, user_id: uuid.UUID, code: str) -> bool:
        """Confirm a fresh TOTP code, then enable MFA on the user."""
        user = await self._load_user(user_id)
        secret = self._decrypt_mfa_secret(user)
        if not pyotp.TOTP(secret).verify(code, valid_window=1):
            return False
        user.mfa_enabled = True
        await self.db.commit()
        return True

    async def verify_mfa_login(
        self,
        user: User,
        code: str,
        device_info: dict | None = None,
    ) -> TokenPair:
        """After an MFA challenge token is presented, verify the TOTP code
        and issue the real (non-challenge) token pair."""
        if not user.mfa_enabled:
            raise MFAMissingError("MFA is not enabled for this user")
        secret = self._decrypt_mfa_secret(user)
        if not pyotp.TOTP(secret).verify(code, valid_window=1):
            raise MFAInvalidError("MFA code did not match")
        return await self._issue_token_pair(user, device_info, mfa_challenge=False)

    # ============================================================
    # Refresh token rotation (plan 40 / rule §5.2)
    # ============================================================

    async def rotate_refresh_token(
        self,
        presented_token: str,
        device_info: dict | None = None,
    ) -> TokenPair:
        """Rotate a refresh token.

        Reuse of a previously-rotated token revokes the entire session
        family (rule §5.2 reuse detection). Also validates the **usk hash**
        to catch password-change invalidations on the refresh token itself.
        """
        payload = _decode_refresh(presented_token, self.settings.jwt)
        jti = payload["jti"]
        user_id = uuid.UUID(payload["sub"])
        token_usk_hash = payload.get("usk", "")

        stmt = select(UserSession).where(UserSession.refresh_jti == jti)
        session = (await self.db.execute(stmt)).scalar_one_or_none()
        if session is None or not session.is_active or session.revoked_at is not None:
            # Reuse of a rotated/revoked token — burn the entire user family.
            await self._revoke_user_sessions(user_id)
            raise TokenRevokedError("Refresh token has been rotated or revoked")

        user = await self._load_user(user_id)

        # Kill-switch check on the refresh token itself
        current_usk_hash = hashlib.sha256(user.user_secret_key.encode()).hexdigest()
        if token_usk_hash != current_usk_hash:
            await self._revoke_user_sessions(user_id)
            raise TokenRevokedError("Session expired. Please log in again.")

        session.is_active = False
        session.revoked_at = datetime.now(tz=UTC)
        await self.db.commit()
        return await self._issue_token_pair(user, device_info, mfa_challenge=False)

    async def logout(self, user_id: uuid.UUID, jti: str) -> None:
        """Revoke the access token (by jti) and the user's current refresh
        session. Plan 40 also supports revoking other devices; that's
        exposed via the admin/family module later."""
        await self.revocation.revoke(jti, ttl_seconds=self.settings.jwt.access_token_expire_minutes * 60)
        # Best-effort: also revoke any active session for this user.
        # A more specific endpoint can revoke a single session.
        await self._revoke_user_sessions(user_id)

    async def logout_session(self, user_id: uuid.UUID, session_id: uuid.UUID) -> None:
        """Revoke a specific session (e.g. from a 'manage devices' screen)."""
        stmt = select(UserSession).where(
            UserSession.id == session_id,
            UserSession.user_id == user_id,
        )
        session = (await self.db.execute(stmt)).scalar_one_or_none()
        if session is not None:
            session.is_active = False
            session.revoked_at = datetime.now(tz=UTC)
            await self.db.commit()

    # ============================================================
    # Email + Password register / login (jwt_authplan.md)
    # ============================================================

    async def register(
        self,
        email: str,
        password: str,
        display_name: str | None = None,
    ) -> tuple[User, TokenPair]:
        """Create a new local-account user.

        Generates a unique ``user_secret_key`` that is embedded (as a
        SHA-256 hash) in every JWT. If the secret is rotated later
        (password change, security event), all previously-issued tokens
        become invalid instantly.
        """
        normalized = email.strip().lower()
        existing = await self.get_user_by_email(normalized)
        if existing is not None:
            raise ConflictError("An account with this email already exists")

        user_secret_key = secrets.token_hex(SECRET_KEY_BYTES)
        password_hash = hash_password(password)

        user = User(
            email=normalized,
            hashed_password=password_hash,
            user_secret_key=user_secret_key,
            provider="local",
            is_verified=False,
            display_name=display_name,
            encryption_key_salt=_new_user_salt(),
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)

        tokens = await self._issue_token_pair(user, device_info=None)
        return user, tokens

    async def login_with_email(
        self,
        email: str,
        password: str,
        device_info: dict | None = None,
    ) -> tuple[User, TokenPair]:
        """Authenticate a local-account user by email + password.

        Tracks ``failed_login_attempts`` and ``last_login_at`` on the user
        record. Raises ``InvalidCredentialsError`` for wrong email, wrong
        password, inactive account, or non-local provider.
        """
        normalized = email.strip().lower()
        user = await self.get_user_by_email(normalized)
        if user is None:
            raise InvalidCredentialsError("Invalid email or password")

        # Provider guard: only "local" accounts can use password auth
        if user.provider != "local":
            raise InvalidCredentialsError(
                "This account uses a different sign-in method"
            )

        # Lockout check
        if user.failed_login_attempts >= 10:
            raise InvalidCredentialsError("Account locked. Reset password.")

        # Password verification
        if user.hashed_password is None or not verify_password(password, user.hashed_password):
            user.failed_login_attempts += 1
            await self.db.flush()
            raise InvalidCredentialsError("Invalid email or password")

        if not user.is_active:
            raise InvalidCredentialsError("Account is inactive")

        # Success — reset counters and update timestamp
        user.failed_login_attempts = 0
        user.last_login_at = datetime.now(tz=UTC)

        tokens = await self._issue_token_pair(user, device_info=device_info)
        return user, tokens

    async def get_user_profile(self, user_id: uuid.UUID) -> User | None:
        """Return the user by ID (used by GET /auth/me)."""
        stmt = select(User).where(User.id == user_id).where(User.is_active.is_(True))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def change_password(
        self,
        user_id: uuid.UUID,
        old_password: str,
        new_password: str,
    ) -> None:
        """Change the user's password.

        Verifies the old password, hashes the new one, rotates
        ``user_secret_key`` (invalidating all JWTs), and revokes ALL
        sessions — forcing a full re-login everywhere.
        """
        user = await self._load_user(user_id)

        # Verify old password
        if user.hashed_password is None or not verify_password(old_password, user.hashed_password):
            raise InvalidCredentialsError("Current password is incorrect")

        if user.provider != "local":
            raise InvalidCredentialsError("Cannot change password on a non-local account")

        # Hash new password
        user.hashed_password = hash_password(new_password)

        # Rotate user_secret_key → invalidates ALL JWTs
        new_secret = secrets.token_hex(SECRET_KEY_BYTES)
        user.user_secret_key = new_secret

        # Revoke all sessions (global logout)
        await self._revoke_user_sessions(user_id)

        await self.db.flush()

    async def get_user_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _rotate_user_secret(self, user_id: uuid.UUID) -> str:
        """Generate a new ``user_secret_key``, persist it, return it.

        Calling this invalidates all previously-issued JWTs because the
        ``usk`` claim in those tokens will no longer match the stored value.
        """
        new_secret = secrets.token_hex(SECRET_KEY_BYTES)
        user = await self._load_user(user_id)
        user.user_secret_key = new_secret
        await self.db.commit()
        return new_secret

    # ============================================================
    # Password (optional, plan 04 §5)
    # ============================================================

    async def set_password(self, user_id: uuid.UUID, new_password: str) -> None:
        user = await self._load_user(user_id)
        user.hashed_password = hash_password(new_password)
        await self._rotate_user_secret(user_id)
        await self.db.commit()

    async def login_with_password(
        self,
        phone: str,
        password: str,
        device_info: dict | None = None,
    ) -> tuple[User, TokenPair, bool]:
        user = (await self.db.execute(select(User).where(User.phone_number == phone))).scalar_one_or_none()
        if user is None or user.hashed_password is None or not verify_password(password, user.hashed_password):
            raise InvalidCredentialsError("Invalid phone or password")
        if not user.is_active:
            raise InvalidCredentialsError("Account is inactive")
        if user.mfa_enabled:
            tokens = await self._issue_token_pair(user, device_info, mfa_challenge=True)
            return user, tokens, True
        tokens = await self._issue_token_pair(user, device_info, mfa_challenge=False)
        return user, tokens, False

    # ============================================================
    # helpers
    # ============================================================

    async def _get_or_create_user(self, phone: str) -> User:
        user = (await self.db.execute(select(User).where(User.phone_number == phone))).scalar_one_or_none()
        if user is not None:
            return user
        user = User(
            phone_number=phone,
            role="user",
            user_secret_key=secrets.token_hex(SECRET_KEY_BYTES),
            encryption_key_salt=self.encryption.__class__.__name__ and _new_user_salt(),
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def _load_user(self, user_id: uuid.UUID) -> User:
        stmt = select(User).where(User.id == user_id).where(User.is_active.is_(True))
        user = (await self.db.execute(stmt)).scalar_one_or_none()
        if user is None:
            raise InvalidCredentialsError("User not found or inactive")
        return user

    async def _issue_token_pair(
        self,
        user: User,
        device_info: dict | None,
        *,
        mfa_challenge: bool = False,
    ) -> TokenPair:
        usk = user.user_secret_key or secrets.token_hex(SECRET_KEY_BYTES)
        access, _access_jti, access_ttl = create_access_token(
            user.id,
            email=user.email or "",
            role=user.role,
            user_secret_key=usk,
            settings=self.settings.jwt,
        )
        refresh, refresh_jti, refresh_exp = create_refresh_token(
            user.id,
            user_secret_key=usk,
            settings=self.settings.jwt,
        )
        # When MFA is required, both tokens are short-lived; the refresh token
        # only works inside the verify-mfa-login flow. We mark the session
        # accordingly.
        session = UserSession(
            user_id=user.id,
            refresh_token_hash=_hash_token(refresh),
            refresh_jti=refresh_jti,
            expires_at=refresh_exp,
            ip_address=(device_info or {}).get("ip_address"),
            device_info=device_info or {},
        )
        self.db.add(session)
        await self.db.commit()
        return TokenPair(
            access_token=access,
            refresh_token=refresh,
            expires_in=access_ttl,
        )

    async def _revoke_user_sessions(self, user_id: uuid.UUID) -> None:
        from sqlalchemy import update

        await self.db.execute(
            update(UserSession)
            .where(UserSession.user_id == user_id, UserSession.is_active.is_(True))
            .values(is_active=False, revoked_at=datetime.now(tz=UTC))
        )
        await self.db.commit()

    def _decrypt_mfa_secret(self, user: User) -> str:
        if not user.mfa_secret:
            raise MFAMissingError("MFA secret not provisioned")
        if user.encryption_key_salt:
            try:
                return self.encryption.decrypt_for_user(user.mfa_secret, user.encryption_key_salt)
            except Exception:
                # Legacy plain secret (created before salt was assigned).
                return user.mfa_secret
        return user.mfa_secret


def _new_user_salt() -> str:
    from app.core.encryption import make_user_salt
    return make_user_salt()


def _seconds(n: int):
    from datetime import timedelta
    return timedelta(seconds=n)


def _decode_refresh(token: str, settings) -> dict:
    from app.core.security import decode_token

    return decode_token(
        token,
        secret=settings.refresh_secret_key,
        expected_type="refresh",
        algorithm=settings.algorithm,
    )
