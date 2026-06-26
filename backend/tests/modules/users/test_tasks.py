"""Users Celery task tests: prune_audit_logs, anonymize_user_data."""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
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
    import app.core.database as db_module
    from app.modules.auth import models as _auth_models  # noqa: F401
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


# ---------------------------------------------------------------------------
# prune_audit_logs
# ---------------------------------------------------------------------------


def test_prune_audit_logs_empty(db_session) -> None:
    from app.modules.users.tasks import prune_audit_logs

    result = prune_audit_logs.delay()

    assert result.successful()
    assert result.result == 0


def test_prune_audit_logs_prunes_old(db_session) -> None:
    from app.modules.users.tasks import prune_audit_logs

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

    result = prune_audit_logs.delay()

    assert result.successful()
    assert result.result == 1

    async def _verify() -> None:
        from sqlalchemy import select

        from app.modules.users.models import AuditLog

        async with sm() as session:
            log = (await session.execute(select(AuditLog))).scalar()
            assert log is None

    _run(_verify())


def test_prune_audit_logs_skips_recent(db_session) -> None:
    from app.modules.users.tasks import prune_audit_logs

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
                    occurred_at=datetime.now(tz=UTC),
                )
            )
            await session.commit()

    _run(_seed())

    result = prune_audit_logs.delay()

    assert result.successful()
    assert result.result == 0

    async def _verify() -> None:
        from sqlalchemy import select

        from app.modules.users.models import AuditLog

        async with sm() as session:
            logs = (await session.execute(select(AuditLog))).scalars().all()
            assert len(logs) == 1

    _run(_verify())


# ---------------------------------------------------------------------------
# anonymize_user_data
# ---------------------------------------------------------------------------


def test_anonymize_user_data_empty(db_session) -> None:
    from app.modules.users.tasks import anonymize_user_data

    result = anonymize_user_data.delay(str(uuid.uuid4()))

    assert result.successful()


def test_anonymize_user_data_anonymizes(db_session) -> None:
    from app.modules.users.tasks import anonymize_user_data

    sm = db_session
    user_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            from app.modules.auth.models import User

            session.add(
                User(
                    id=user_id,
                    email="anon@test.com",
                    phone_number="+1234567890",
                    display_name="Test User",
                    provider="local",
                    is_verified=True,
                )
            )
            await session.commit()

    _run(_seed())

    result = anonymize_user_data.delay(str(user_id))

    assert result.successful()

    async def _verify() -> None:
        from sqlalchemy import select

        from app.modules.auth.models import User

        async with sm() as session:
            user = (
                await session.execute(select(User).where(User.id == user_id))
            ).scalar_one()
            assert user.phone_number.startswith("anon-")
            assert user.display_name is None
            assert user.is_active is False

    _run(_verify())
