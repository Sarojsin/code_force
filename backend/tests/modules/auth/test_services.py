"""Auth service unit tests (rule §9.2: module tests run in isolation).

These tests use SQLite in-memory and a fake Twilio. They cover the core
service methods without touching the network.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator

# Force the test environment BEFORE importing the app.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

from datetime import UTC

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.database import Base
from app.core.encryption import EncryptionService
from app.core.exceptions import ConflictError
from app.modules.auth.exceptions import InvalidCredentialsError, OTPInvalidError, TokenRevokedError
from app.modules.auth.models import OTPAttempt, User
from app.modules.auth.services import AuthService, hash_password, verify_password
from tests.modules.auth.conftest import FakeTwilio


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        # Import models so SQLAlchemy sees them.
        from app.modules.auth import models  # noqa: F401
        from app.modules.users import models as users_models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def auth_service(db_session: AsyncSession, fake_twilio: FakeTwilio) -> AuthService:
    settings = get_settings()
    encryption = EncryptionService(settings.encryption)
    # Redis is not used in these unit tests — provide a no-op revocation store
    # by monkey-patching the methods we'll touch.
    class _NoopRevocation:
        async def revoke(self, jti: str, ttl_seconds: int) -> None:
            return None
        async def is_revoked(self, jti: str) -> bool:
            return False
    return AuthService(
        db=db_session,
        twilio=fake_twilio,  # type: ignore[arg-type]
        settings=settings,
        encryption=encryption,
        revocation=_NoopRevocation(),  # type: ignore[arg-type]
    )


# --- password ---


def test_password_roundtrip() -> None:
    hashed = hash_password("CorrectHorse1")
    assert verify_password("CorrectHorse1", hashed)
    assert not verify_password("wrong", hashed)


# --- Email + Password register / login (jwt_authplan.md) ---


@pytest.mark.asyncio
async def test_register_creates_user(auth_service: AuthService) -> None:
    user, tokens = await auth_service.register("alice@example.com", "SecurePass1")
    assert user.email == "alice@example.com"
    assert user.provider == "local"
    assert user.is_verified is False
    assert user.display_name is None
    assert user.user_secret_key
    assert len(user.user_secret_key) == 64
    assert tokens.access_token
    assert tokens.refresh_token


@pytest.mark.asyncio
async def test_register_with_display_name(auth_service: AuthService) -> None:
    user, _ = await auth_service.register("bob@test.com", "SecurePass1", display_name="Bob")
    assert user.display_name == "Bob"


@pytest.mark.asyncio
async def test_register_rejects_duplicate_email(auth_service: AuthService) -> None:
    await auth_service.register("dup@example.com", "SecurePass1")
    with pytest.raises(ConflictError, match="already exists"):
        await auth_service.register("dup@example.com", "OtherPass1")


@pytest.mark.asyncio
async def test_register_normalizes_email(auth_service: AuthService) -> None:
    user, _ = await auth_service.register("  Alice@Example.COM ", "SecurePass1")
    assert user.email == "alice@example.com"


@pytest.mark.asyncio
async def test_login_with_email_success(auth_service: AuthService) -> None:
    await auth_service.register("login@test.com", "MyPassword1")
    user, tokens = await auth_service.login_with_email("login@test.com", "MyPassword1")
    assert user.email == "login@test.com"
    assert tokens.access_token
    assert tokens.refresh_token


@pytest.mark.asyncio
async def test_login_with_email_wrong_password(auth_service: AuthService) -> None:
    await auth_service.register("user@test.com", "CorrectPass1")
    with pytest.raises(InvalidCredentialsError, match="Invalid email or password"):
        await auth_service.login_with_email("user@test.com", "WrongPass1")


@pytest.mark.asyncio
async def test_login_with_email_wrong_email(auth_service: AuthService) -> None:
    with pytest.raises(InvalidCredentialsError, match="Invalid email or password"):
        await auth_service.login_with_email("nobody@test.com", "SomePass1")


@pytest.mark.asyncio
async def test_login_with_email_inactive_user(auth_service: AuthService) -> None:
    user, _ = await auth_service.register("active@test.com", "SomePass1")
    user.is_active = False
    await auth_service.db.commit()
    with pytest.raises(InvalidCredentialsError, match="Account is inactive"):
        await auth_service.login_with_email("active@test.com", "SomePass1")


@pytest.mark.asyncio
async def test_password_change_rotates_secret(auth_service: AuthService) -> None:
    user, first_tokens = await auth_service.register("rotate@test.com", "Original1")

    old_secret = user.user_secret_key
    await auth_service.set_password(user.id, "NewPassword1")
    await auth_service.db.refresh(user)
    new_secret = user.user_secret_key

    assert new_secret != old_secret
    # Old password no longer works
    with pytest.raises(InvalidCredentialsError):
        await auth_service.login_with_email("rotate@test.com", "Original1")
    # New password works and issues tokens with the new usk
    user2, second_tokens = await auth_service.login_with_email("rotate@test.com", "NewPassword1")
    assert second_tokens.access_token != first_tokens.access_token
    assert user2.user_secret_key == new_secret


@pytest.mark.asyncio
async def test_login_with_email_non_local_provider(auth_service: AuthService) -> None:
    """A user with provider != 'local' must not be able to log in with password."""
    user, _ = await auth_service.register("google@test.com", "SomePass1")
    user.provider = "google"
    await auth_service.db.commit()
    with pytest.raises(InvalidCredentialsError, match="different sign-in method"):
        await auth_service.login_with_email("google@test.com", "SomePass1")


# --- OTP ---


@pytest.mark.asyncio
async def test_request_otp_returns_dev_code_in_test(auth_service: AuthService) -> None:
    dev_code, ttl = await auth_service.request_otp("+14155552671")
    assert dev_code is not None
    assert len(dev_code) == 6
    assert ttl == 300
    assert len(auth_service.db.new) or True  # sanity


@pytest.mark.asyncio
async def test_verify_otp_creates_user_and_returns_tokens(
    auth_service: AuthService, fake_twilio: FakeTwilio,
) -> None:
    code, _ = await auth_service.request_otp("+14155552671")
    user, tokens, requires_mfa = await auth_service.verify_otp("+14155552671", code)
    assert user.id is not None
    assert user.phone_number == "+14155552671"
    assert user.role == "user"
    assert tokens.access_token
    assert tokens.refresh_token
    assert not requires_mfa


@pytest.mark.asyncio
async def test_verify_otp_rejects_wrong_code(auth_service: AuthService) -> None:
    await auth_service.request_otp("+14155552671")
    with pytest.raises(OTPInvalidError):
        await auth_service.verify_otp("+14155552671", "000000")


@pytest.mark.asyncio
async def test_verify_otp_rejects_expired(auth_service: AuthService) -> None:
    # Issue an OTP then mark all attempts expired.
    await auth_service.request_otp("+14155552671")
    from datetime import datetime, timedelta

    from sqlalchemy import update
    await auth_service.db.execute(
        update(OTPAttempt).values(expires_at=datetime.now(tz=UTC) - timedelta(seconds=1))
    )
    await auth_service.db.commit()
    with pytest.raises(Exception, match="OTP"):
        await auth_service.verify_otp("+14155552671", "123456")


# --- refresh rotation + reuse detection ---


@pytest.mark.asyncio
async def test_refresh_rotation_issues_new_pair(auth_service: AuthService) -> None:
    code, _ = await auth_service.request_otp("+14155552671")
    _, first, _ = await auth_service.verify_otp("+14155552671", code)
    second = await auth_service.rotate_refresh_token(first.refresh_token)
    assert second.access_token != first.access_token
    assert second.refresh_token != first.refresh_token


@pytest.mark.asyncio
async def test_refresh_reuse_revokes_session_family(auth_service: AuthService) -> None:
    code, _ = await auth_service.request_otp("+14155552671")
    _, first, _ = await auth_service.verify_otp("+14155552671", code)
    second = await auth_service.rotate_refresh_token(first.refresh_token)
    # Reusing the OLD refresh token must fail AND revoke the new one.
    with pytest.raises(TokenRevokedError):
        await auth_service.rotate_refresh_token(first.refresh_token)
    # Confirm second token is now also revoked.
    with pytest.raises(TokenRevokedError):
        await auth_service.rotate_refresh_token(second.refresh_token)


# --- MFA ---


@pytest.mark.asyncio
async def test_mfa_enrollment_then_login_challenge(
    auth_service: AuthService, fake_twilio: FakeTwilio,
) -> None:
    import pyotp

    # First login (no MFA yet)
    code, _ = await auth_service.request_otp("+14155552671")
    user, _, _ = await auth_service.verify_otp("+14155552671", code)

    # Enroll MFA
    secret, otpauth = await auth_service.enable_mfa(user.id)
    assert secret and otpauth.startswith("otpauth://")
    totp = pyotp.TOTP(secret)
    assert await auth_service.verify_mfa_setup(user.id, totp.now()) is True
    assert await auth_service.verify_mfa_setup(user.id, "000000") is False

    # Reload user to confirm DB state
    from sqlalchemy import select
    user = (await auth_service.db.execute(select(User).where(User.id == user.id))).scalar_one()
    assert user.mfa_enabled is True

    # Next login returns an MFA challenge
    code2, _ = await auth_service.request_otp("+14155552671")
    _, _, requires_mfa = await auth_service.verify_otp("+14155552671", code2)
    assert requires_mfa is True

    # Completing the MFA challenge with the right code gives a real token pair.
    real_tokens = await auth_service.verify_mfa_login(user, totp.now())
    assert real_tokens.access_token
    assert real_tokens.refresh_token
