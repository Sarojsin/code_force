from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("REDIS__URL", "redis://localhost:6379/15")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.celery_app import celery_app
from app.core.database import Base


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(type_, compiler, **kw):
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
    import app.core.database as db_module
    from app.modules.auth import models as _auth_models  # noqa: F401
    from app.modules.family import models  # noqa: F401
    from app.modules.users import models  # noqa: F401

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
    return asyncio.run(coro)


def test_cleanup_already_ran_today(db_session) -> None:
    from app.tasks.retention_cleanup import cleanup

    mock_redis = AsyncMock()
    mock_redis.setnx.return_value = False

    with patch("app.tasks.retention_cleanup.aredis.from_url", return_value=mock_redis):
        result = cleanup.delay()

    assert result.successful()
    assert result.result == {}


def test_cleanup_deletes_old_users(db_session) -> None:
    from app.tasks.retention_cleanup import cleanup

    sm = db_session
    old_user_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            from app.modules.auth.models import User

            session.add(
                User(
                    id=old_user_id,
                    email="old@test.com",
                    phone_number="+1111111111",
                    provider="local",
                    is_verified=True,
                    is_active=False,
                    updated_at=datetime.now(tz=UTC) - timedelta(days=60),
                )
            )
            await session.commit()

    _run(_seed())

    mock_redis = AsyncMock()
    mock_redis.setnx.return_value = True

    with patch("app.tasks.retention_cleanup.aredis.from_url", return_value=mock_redis):
        result = cleanup.delay()

    assert result.successful()
    assert result.result.get("deleted_users", 0) >= 1


def test_cleanup_purges_old_audit_logs(db_session) -> None:
    from app.tasks.retention_cleanup import cleanup

    sm = db_session

    async def _seed() -> None:
        async with sm() as session:
            from app.modules.users.models import AuditLog

            session.add(
                AuditLog(
                    id=uuid.uuid4(),
                    action="test",
                    resource="test",
                    payload={},
                    occurred_at=datetime.now(tz=UTC) - timedelta(days=100),
                )
            )
            await session.commit()

    _run(_seed())

    mock_redis = AsyncMock()
    mock_redis.setnx.return_value = True

    with patch("app.tasks.retention_cleanup.aredis.from_url", return_value=mock_redis):
        result = cleanup.delay()

    assert result.successful()
    assert result.result.get("purged_audit_logs", 0) >= 1


def test_cleanup_deletes_expired_invites(db_session) -> None:
    from app.tasks.retention_cleanup import cleanup

    sm = db_session
    user_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            from app.modules.auth.models import User
            from app.modules.family.models import FamilyLink

            session.add(
                User(id=user_id, email="inviter@test.com", provider="local", is_verified=True)
            )
            session.add(
                FamilyLink(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    invite_token="old-invite",
                    token_expires_at=datetime.now(tz=UTC) - timedelta(days=60),
                    status="pending",
                    is_active=True,
                )
            )
            await session.commit()

    _run(_seed())

    mock_redis = AsyncMock()
    mock_redis.setnx.return_value = True

    with patch("app.tasks.retention_cleanup.aredis.from_url", return_value=mock_redis):
        result = cleanup.delay()

    assert result.successful()
    assert result.result.get("deleted_expired_invites", 0) >= 1


def test_cleanup_skips_recent_users(db_session) -> None:
    from app.tasks.retention_cleanup import cleanup

    sm = db_session
    recent_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            from app.modules.auth.models import User

            session.add(
                User(
                    id=recent_id,
                    email="recent@test.com",
                    phone_number="+1222222222",
                    provider="local",
                    is_verified=True,
                    is_active=False,
                    updated_at=datetime.now(tz=UTC) - timedelta(days=5),
                )
            )
            await session.commit()

    _run(_seed())

    mock_redis = AsyncMock()
    mock_redis.setnx.return_value = True

    with patch("app.tasks.retention_cleanup.aredis.from_url", return_value=mock_redis):
        result = cleanup.delay()

    assert result.successful()
