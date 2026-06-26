from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")
os.environ.setdefault("REDIS__URL", "redis://localhost:6379/15")

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(type_, compiler, **kw):
    return "JSON"


from app.core.config import get_settings
from app.core.database import Base
from app.core.encryption import EncryptionService
from app.modules.auth.exceptions import InvalidCredentialsError, MFAMissingError, OTPInvalidError, TokenRevokedError
from app.modules.auth.models import OTPAttempt, User, UserSession
from app.modules.auth.services import AuthService
from tests.modules.auth.conftest import FakeTwilio


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
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

    class _NoopRevocation:
        async def revoke(self, jti: str, ttl_seconds: int) -> None:
            return None
        async def is_revoked(self, jti: str) -> bool:
            return False

    return AuthService(
        db=db_session,
        twilio=fake_twilio,
        settings=settings,
        encryption=encryption,
        revocation=_NoopRevocation(),
    )


@pytest.fixture
def fake_twilio() -> FakeTwilio:
    return FakeTwilio()


async def _create_phone_user(auth_service: AuthService, phone: str = "+14155552671") -> User:
    code, _ = await auth_service.request_otp(phone)
    user, _, _ = await auth_service.verify_otp(phone, code)
    return user


async def _create_email_user(auth_service: AuthService, email: str = "test@example.com", password: str = "SecurePass1") -> User:
    user, _ = await auth_service.register(email, password)
    return user


@pytest.mark.asyncio
async def test_login_with_password_success(auth_service: AuthService) -> None:
    user = await _create_phone_user(auth_service, "+14155552671")
    await auth_service.set_password(user.id, "MyPassword1")

    result_user, tokens, requires_mfa = await auth_service.login_with_password("+14155552671", "MyPassword1")
    assert result_user.id == user.id
    assert tokens.access_token
    assert tokens.refresh_token
    assert not requires_mfa


@pytest.mark.asyncio
async def test_login_with_password_wrong_phone(auth_service: AuthService) -> None:
    with pytest.raises(InvalidCredentialsError, match="Invalid phone or password"):
        await auth_service.login_with_password("+14155559999", "SomePass1")


@pytest.mark.asyncio
async def test_login_with_password_wrong_password(auth_service: AuthService) -> None:
    user = await _create_phone_user(auth_service, "+14155552671")
    await auth_service.set_password(user.id, "MyPassword1")

    with pytest.raises(InvalidCredentialsError):
        await auth_service.login_with_password("+14155552671", "WrongPassword1")


@pytest.mark.asyncio
async def test_login_with_password_inactive_user(auth_service: AuthService) -> None:
    user = await _create_phone_user(auth_service, "+14155552671")
    await auth_service.set_password(user.id, "MyPassword1")
    user.is_active = False
    await auth_service.db.commit()

    with pytest.raises(InvalidCredentialsError, match="Account is inactive"):
        await auth_service.login_with_password("+14155552671", "MyPassword1")


@pytest.mark.asyncio
async def test_login_with_password_mfa_challenge(auth_service: AuthService, fake_twilio: FakeTwilio) -> None:
    import pyotp

    user = await _create_phone_user(auth_service, "+14155552671")
    await auth_service.set_password(user.id, "MyPassword1")

    secret, _ = await auth_service.enable_mfa(user.id)
    totp = pyotp.TOTP(secret)
    await auth_service.verify_mfa_setup(user.id, totp.now())

    result_user, tokens, requires_mfa = await auth_service.login_with_password("+14155552671", "MyPassword1")
    assert requires_mfa is True
    assert tokens.access_token


@pytest.mark.asyncio
async def test_set_password_new_user(auth_service: AuthService) -> None:
    user = await _create_phone_user(auth_service, "+14155552671")
    old_secret = user.user_secret_key
    await auth_service.set_password(user.id, "BrandNewPass1")
    await auth_service.db.refresh(user)
    assert user.hashed_password is not None
    assert user.user_secret_key != old_secret


@pytest.mark.asyncio
async def test_get_user_profile_returns_user(auth_service: AuthService) -> None:
    user = await _create_email_user(auth_service)
    found = await auth_service.get_user_profile(user.id)
    assert found is not None
    assert found.id == user.id


@pytest.mark.asyncio
async def test_get_user_profile_inactive_returns_none(auth_service: AuthService) -> None:
    user = await _create_email_user(auth_service)
    user.is_active = False
    await auth_service.db.commit()
    found = await auth_service.get_user_profile(user.id)
    assert found is None


@pytest.mark.asyncio
async def test_get_user_profile_nonexistent_returns_none(auth_service: AuthService) -> None:
    found = await auth_service.get_user_profile(uuid.uuid4())
    assert found is None


@pytest.mark.asyncio
async def test_get_user_by_email_found(auth_service: AuthService) -> None:
    user = await _create_email_user(auth_service)
    found = await auth_service.get_user_by_email("test@example.com")
    assert found is not None
    assert found.id == user.id


@pytest.mark.asyncio
async def test_get_user_by_email_normalized(auth_service: AuthService) -> None:
    await _create_email_user(auth_service, email="  Alice@Example.COM ")
    found = await auth_service.get_user_by_email("alice@example.com")
    assert found is not None


@pytest.mark.asyncio
async def test_get_user_by_email_not_found(auth_service: AuthService) -> None:
    found = await auth_service.get_user_by_email("nobody@example.com")
    assert found is None


@pytest.mark.asyncio
async def test_logout_revokes_access_and_sessions(auth_service: AuthService) -> None:
    user = await _create_phone_user(auth_service, "+14155552671")
    code, _ = await auth_service.request_otp("+14155552671")
    _, tokens, _ = await auth_service.verify_otp("+14155552671", code)

    stmt = select(UserSession).where(UserSession.user_id == user.id, UserSession.is_active.is_(True))
    sessions_before = (await auth_service.db.execute(stmt)).scalars().all()
    assert len(sessions_before) >= 1

    await auth_service.logout(user.id, tokens.access_token)

    stmt2 = select(UserSession).where(UserSession.user_id == user.id, UserSession.is_active.is_(True))
    sessions_after = (await auth_service.db.execute(stmt2)).scalars().all()
    assert len(sessions_after) == 0


@pytest.mark.asyncio
async def test_logout_session_revokes_specific_session(auth_service: AuthService) -> None:
    user = await _create_phone_user(auth_service, "+14155552671")
    code, _ = await auth_service.request_otp("+14155552671")
    _, tokens, _ = await auth_service.verify_otp("+14155552671", code)

    stmt = select(UserSession).where(UserSession.user_id == user.id, UserSession.is_active.is_(True))
    session = (await auth_service.db.execute(stmt)).scalars().first()

    await auth_service.logout_session(user.id, session.id)

    await auth_service.db.refresh(session)
    assert session.is_active is False
    assert session.revoked_at is not None


@pytest.mark.asyncio
async def test_verify_otp_twilio_fallback_no_local_attempt(auth_service: AuthService, fake_twilio: FakeTwilio) -> None:
    fake_twilio.approve_codes.add("999999")
    user, tokens, _ = await auth_service.verify_otp("+14155552671", "999999")
    assert user.phone_number == "+14155552671"
    assert tokens.access_token


@pytest.mark.asyncio
async def test_verify_otp_twilio_fallback_fails(auth_service: AuthService, fake_twilio: FakeTwilio) -> None:
    with pytest.raises(OTPInvalidError):
        await auth_service.verify_otp("+14155552671", "000000")


@pytest.mark.asyncio
async def test_verify_otp_hash_mismatch_twilio_success(auth_service: AuthService, fake_twilio: FakeTwilio) -> None:
    code, _ = await auth_service.request_otp("+14155552671")
    fake_twilio.has_credentials = True
    fake_twilio.approve_codes.add(code)

    user, tokens, _ = await auth_service.verify_otp("+14155552671", code)
    assert user.phone_number == "+14155552671"
    assert tokens.access_token


@pytest.mark.asyncio
async def test_verify_otp_hash_mismatch_twilio_no_credentials(auth_service: AuthService, fake_twilio: FakeTwilio) -> None:
    code, _ = await auth_service.request_otp("+14155552671")
    fake_twilio.has_credentials = False
    fake_twilio.approve_codes.discard(code)

    with pytest.raises(OTPInvalidError):
        await auth_service.verify_otp("+14155552671", "wrongcode")


@pytest.mark.asyncio
async def test_rotate_refresh_token_usk_kill_switch(auth_service: AuthService) -> None:
    code, _ = await auth_service.request_otp("+14155552671")
    user, tokens, _ = await auth_service.verify_otp("+14155552671", code)

    await auth_service.set_password(user.id, "NewPasswordAfter1")

    with pytest.raises(TokenRevokedError, match="Session expired"):
        await auth_service.rotate_refresh_token(tokens.refresh_token)


@pytest.mark.asyncio
async def test_enable_mfa_dev_fallback_no_salt(auth_service: AuthService) -> None:
    user = await _create_phone_user(auth_service, "+14155552671")
    user.encryption_key_salt = None
    await auth_service.db.commit()

    secret, otpauth = await auth_service.enable_mfa(user.id)
    assert secret
    assert otpauth.startswith("otpauth://")


@pytest.mark.asyncio
async def test_decrypt_mfa_secret_legacy_fallback(auth_service: AuthService) -> None:
    user = await _create_phone_user(auth_service, "+14155552671")
    user.encryption_key_salt = "some_salt"
    user.mfa_secret = "plaintext_legacy_secret"
    await auth_service.db.commit()

    secret = auth_service._decrypt_mfa_secret(user)
    assert secret == "plaintext_legacy_secret"


@pytest.mark.asyncio
async def test_decrypt_mfa_secret_missing_raises(auth_service: AuthService) -> None:
    user = await _create_phone_user(auth_service, "+14155552671")
    user.mfa_secret = None
    await auth_service.db.commit()

    with pytest.raises(MFAMissingError):
        auth_service._decrypt_mfa_secret(user)
