"""System Test 8: Kill-Switch (25) — usk rotation, session revocation, reuse detection.

Scenarios covered:
  S25: user_secret_key rotation invalidates all JWTs (kill-switch),
       password change revokes all sessions, refresh token reuse
       detection revokes entire session family.

@see system_test8.md for full scenario descriptions.
"""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.database import Base
from app.core.encryption import EncryptionService
from app.modules.auth.exceptions import InvalidCredentialsError, TokenRevokedError
from app.modules.auth.models import User, UserSession
from app.modules.auth.services import AuthService
from tests.modules.auth.conftest import FakeTwilio


# ─── Fixtures ────────────────────────────────────────────────────────────────


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


# ─── Helpers ─────────────────────────────────────────────────────────────────


async def _create_phone_user(svc: AuthService, phone: str = "+14155552671") -> User:
    code, _ = await svc.request_otp(phone)
    user, _, _ = await svc.verify_otp(phone, code)
    return user


async def _create_email_user(svc: AuthService) -> User:
    user = await svc.register("test@example.com", "StrongPass1")
    return user


# =============================================================================
# Scenario 25: Kill-Switch — user_secret_key Rotation & Session Revocation
# =============================================================================


@pytest.mark.asyncio
async def test_25_1_usk_rotation_invalidates_access_token(auth_service: AuthService) -> None:
    """Password change rotates usk — old token's usk hash no longer matches."""
    import hashlib

    from app.core.security import decode_token

    user_obj, tokens = await _create_email_user(auth_service)

    await auth_service.change_password(user_obj.id, "StrongPass1", "NewPassword1")

    payload = decode_token(
        tokens.access_token,
        secret=get_settings().jwt.secret_key,
        expected_type="access",
        algorithm=get_settings().jwt.algorithm,
    )
    token_usk_hash = payload.get("usk", "")
    await auth_service.db.refresh(user_obj)
    current_usk_hash = hashlib.sha256(user_obj.user_secret_key.encode()).hexdigest()
    assert token_usk_hash != current_usk_hash, "usk should have changed after password rotation"


@pytest.mark.asyncio
async def test_25_2_password_change_revokes_all_sessions(auth_service: AuthService) -> None:
    """change_password calls _revoke_user_sessions → all sessions become inactive."""
    user_obj, tokens = await _create_email_user(auth_service)

    stmt = select(UserSession).where(
        UserSession.user_id == user_obj.id,
        UserSession.is_active.is_(True),
    )
    sessions_before = (await auth_service.db.execute(stmt)).scalars().all()
    assert len(sessions_before) >= 1

    await auth_service.change_password(user_obj.id, "StrongPass1", "NewPassword2")

    sessions_after = (await auth_service.db.execute(stmt)).scalars().all()
    assert len(sessions_after) == 0


@pytest.mark.asyncio
async def test_25_3_refresh_reuse_revokes_session_family(auth_service: AuthService) -> None:
    """Reusing an already-rotated refresh token revokes all sessions."""
    code, _ = await auth_service.request_otp("+14155552673")
    user, tokens, _ = await auth_service.verify_otp("+14155552673", code)

    # First rotation — valid
    pair1 = await auth_service.rotate_refresh_token(tokens.refresh_token)
    assert pair1.access_token

    # Reuse the same old refresh token — triggers family revocation
    with pytest.raises(TokenRevokedError, match="rotated or revoked"):
        await auth_service.rotate_refresh_token(tokens.refresh_token)

    stmt = select(UserSession).where(
        UserSession.user_id == user.id,
        UserSession.is_active.is_(True),
    )
    sessions = (await auth_service.db.execute(stmt)).scalars().all()
    assert len(sessions) == 0


@pytest.mark.asyncio
async def test_25_4_revoke_user_sessions_clears_all(auth_service: AuthService) -> None:
    """_revoke_user_sessions sets all active sessions to inactive."""
    user = await _create_phone_user(auth_service, "+14155552674")

    # Create a second session
    code2, _ = await auth_service.request_otp("+14155552674")
    await auth_service.verify_otp("+14155552674", code2)

    stmt = select(UserSession).where(
        UserSession.user_id == user.id,
        UserSession.is_active.is_(True),
    )
    before = (await auth_service.db.execute(stmt)).scalars().all()
    assert len(before) >= 2

    await auth_service._revoke_user_sessions(user.id)

    after = (await auth_service.db.execute(stmt)).scalars().all()
    assert len(after) == 0


@pytest.mark.asyncio
async def test_25_5_relogin_works_with_new_usk(auth_service: AuthService) -> None:
    """After password change, user can re-login with new password (new usk)."""
    user_obj, _ = await _create_email_user(auth_service)
    await auth_service.change_password(user_obj.id, "StrongPass1", "NewPassword3")

    user2, tokens2 = await auth_service.login_with_email("test@example.com", "NewPassword3")
    assert tokens2.access_token
    assert tokens2.refresh_token


@pytest.mark.asyncio
async def test_25_6_session_isolation_between_users(auth_service: AuthService) -> None:
    """Revoking user A's sessions does not affect user B's sessions."""
    user_a = await _create_phone_user(auth_service, "+14155552675")
    user_b = await _create_phone_user(auth_service, "+14155552676")

    stmt_a = select(UserSession).where(
        UserSession.user_id == user_a.id,
        UserSession.is_active.is_(True),
    )
    stmt_b = select(UserSession).where(
        UserSession.user_id == user_b.id,
        UserSession.is_active.is_(True),
    )

    sessions_a = (await auth_service.db.execute(stmt_a)).scalars().all()
    sessions_b = (await auth_service.db.execute(stmt_b)).scalars().all()
    assert len(sessions_a) >= 1
    assert len(sessions_b) >= 1

    await auth_service._revoke_user_sessions(user_a.id)

    sessions_a2 = (await auth_service.db.execute(stmt_a)).scalars().all()
    sessions_b2 = (await auth_service.db.execute(stmt_b)).scalars().all()
    assert len(sessions_a2) == 0
    assert len(sessions_b2) >= 1
