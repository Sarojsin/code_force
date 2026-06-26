"""Auth Celery task tests: anonymize_deleted_users, prune_expired_sessions."""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.celery_app import celery_app
from app.core.database import Base


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@pytest.fixture(autouse=True)
def eager_celery() -> None:
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = True
    yield
    celery_app.conf.task_always_eager = False
    celery_app.conf.task_eager_propagates = False


@pytest.fixture
def db_session():
    """Create in-memory SQLite engine, patch AsyncSessionLocal, yield sessionmaker."""
    import app.core.database as db_module
    from app.modules.auth import models as _auth_models  # noqa: F401

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    async def _init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_init())

    sm = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    original = db_module.AsyncSessionLocal
    db_module.AsyncSessionLocal = sm

    yield sm

    db_module.AsyncSessionLocal = original
    asyncio.run(engine.dispose())


def _run(coro):
    """Execute an async coroutine from a synchronous test context."""
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# anonymize_deleted_users
# ---------------------------------------------------------------------------


def test_anonymize_deleted_users_empty(db_session) -> None:
    from app.modules.auth.tasks import anonymize_deleted_users

    result = anonymize_deleted_users.delay()

    assert result.successful()
    assert result.result == 0


def test_anonymize_deleted_users_anonymizes_old(db_session) -> None:
    from app.modules.auth.tasks import anonymize_deleted_users
    from app.modules.auth.models import User

    sm = db_session
    user_id = uuid.uuid4()
    old_date = datetime.now(tz=UTC) - timedelta(days=60)

    async def _seed() -> None:
        async with sm() as session:
            session.add(
                User(
                    id=user_id,
                    email="old@deleted.com",
                    phone_number="+1234567890",
                    display_name="Old User",
                    provider="local",
                    is_verified=True,
                    is_active=False,
                    updated_at=old_date,
                    fcm_tokens=["token1"],
                    mfa_secret="mfa-secret",
                    hashed_password="hashed-pw",
                    encryption_key_salt="salt",
                )
            )
            await session.commit()

    _run(_seed())

    result = anonymize_deleted_users.delay()

    assert result.successful()
    assert result.result == 1

    async def _verify() -> None:
        async with sm() as session:
            user = (await session.execute(select(User).where(User.id == user_id))).scalar_one()
            assert user.phone_number.startswith("anon-")
            assert user.display_name is None
            assert user.fcm_tokens == []
            assert user.mfa_secret is None
            assert user.hashed_password is None
            assert user.encryption_key_salt is None

    _run(_verify())


def test_anonymize_deleted_users_skips_recent(db_session) -> None:
    from app.modules.auth.tasks import anonymize_deleted_users
    from app.modules.auth.models import User

    sm = db_session
    user_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            session.add(
                User(
                    id=user_id,
                    email="recent@deleted.com",
                    display_name="Recent User",
                    provider="local",
                    is_verified=True,
                    is_active=False,
                )
            )
            await session.commit()

    _run(_seed())

    result = anonymize_deleted_users.delay()

    assert result.successful()
    assert result.result == 0

    async def _verify() -> None:
        async with sm() as session:
            user = (await session.execute(select(User).where(User.id == user_id))).scalar_one()
            assert user.display_name == "Recent User"

    _run(_verify())


def test_anonymize_deleted_users_drops_sessions(db_session) -> None:
    from app.modules.auth.tasks import anonymize_deleted_users
    from app.modules.auth.models import User, UserSession

    sm = db_session
    user_id = uuid.uuid4()
    session_id = uuid.uuid4()
    old_date = datetime.now(tz=UTC) - timedelta(days=60)

    async def _seed() -> None:
        async with sm() as session:
            session.add(
                User(
                    id=user_id,
                    email="sessions@deleted.com",
                    display_name="Session User",
                    provider="local",
                    is_verified=True,
                    is_active=False,
                    updated_at=old_date,
                )
            )
            session.add(
                UserSession(
                    id=session_id,
                    user_id=user_id,
                    refresh_token_hash="hash",
                    refresh_jti="jti",
                    expires_at=datetime.now(tz=UTC) + timedelta(days=30),
                    is_active=True,
                )
            )
            await session.commit()

    _run(_seed())

    result = anonymize_deleted_users.delay()

    assert result.successful()
    assert result.result == 1

    async def _verify() -> None:
        async with sm() as session:
            sess = (
                await session.execute(select(UserSession).where(UserSession.id == session_id))
            ).scalar_one()
            assert not sess.is_active
            assert sess.revoked_at is not None

    _run(_verify())


# ---------------------------------------------------------------------------
# prune_expired_sessions
# ---------------------------------------------------------------------------


def test_prune_expired_sessions_empty(db_session) -> None:
    from app.modules.auth.tasks import prune_expired_sessions

    result = prune_expired_sessions.delay()

    assert result.successful()
    assert result.result == 0


def test_prune_expired_sessions_prunes_expired(db_session) -> None:
    from app.modules.auth.tasks import prune_expired_sessions
    from app.modules.auth.models import User, UserSession

    sm = db_session
    user_id = uuid.uuid4()
    session_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            session.add(
                User(id=user_id, email="expired@test.com", provider="local", is_verified=True)
            )
            session.add(
                UserSession(
                    id=session_id,
                    user_id=user_id,
                    refresh_token_hash="hash",
                    refresh_jti="jti",
                    expires_at=datetime.now(tz=UTC) - timedelta(days=30),
                    is_active=True,
                )
            )
            await session.commit()

    _run(_seed())

    result = prune_expired_sessions.delay()

    assert result.successful()
    assert result.result == 1

    async def _verify() -> None:
        async with sm() as session:
            sess = (
                await session.execute(select(UserSession).where(UserSession.id == session_id))
            ).scalar_one()
            assert not sess.is_active

    _run(_verify())


def test_prune_expired_sessions_skips_active(db_session) -> None:
    from app.modules.auth.tasks import prune_expired_sessions
    from app.modules.auth.models import User, UserSession

    sm = db_session
    user_id = uuid.uuid4()
    session_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            session.add(
                User(id=user_id, email="active@test.com", provider="local", is_verified=True)
            )
            session.add(
                UserSession(
                    id=session_id,
                    user_id=user_id,
                    refresh_token_hash="hash",
                    refresh_jti="jti",
                    expires_at=datetime.now(tz=UTC) + timedelta(days=30),
                    is_active=True,
                )
            )
            await session.commit()

    _run(_seed())

    result = prune_expired_sessions.delay()

    assert result.successful()
    assert result.result == 0

    async def _verify() -> None:
        async with sm() as session:
            sess = (
                await session.execute(select(UserSession).where(UserSession.id == session_id))
            ).scalar_one()
            assert sess.is_active

    _run(_verify())
