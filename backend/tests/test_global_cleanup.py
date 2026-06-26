from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

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
    from app.modules.cycle import models  # noqa: F401

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


def test_prune_expired_tokens_raises(db_session) -> None:
    from app.tasks.global_cleanup import prune_expired_tokens

    with pytest.raises(NotImplementedError):
        prune_expired_tokens.delay()


def test_anonymize_deleted_users_raises(db_session) -> None:
    from app.tasks.global_cleanup import anonymize_deleted_users

    with pytest.raises(NotImplementedError):
        anonymize_deleted_users.delay()


def test_prune_snooze_events_empty(db_session) -> None:
    from app.tasks.global_cleanup import prune_snooze_events

    result = prune_snooze_events.delay()

    assert result.successful()
    assert result.result in (0, None)


def test_prune_snooze_events_prunes_old(db_session) -> None:
    from app.tasks.global_cleanup import prune_snooze_events

    sm = db_session
    user_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            from app.modules.auth.models import User
            from app.modules.cycle.models import SnoozeEvent

            session.add(
                User(id=user_id, email="cycle@test.com", provider="local", is_verified=True)
            )
            session.add(
                SnoozeEvent(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    predicted_cycle_id=uuid.uuid4(),
                    day_offset=3,
                    snoozed_at=datetime.now(tz=UTC) - timedelta(days=100),
                )
            )
            await session.commit()

    _run(_seed())

    result = prune_snooze_events.delay()

    assert result.successful()
    assert result.result >= 1


def test_prune_snooze_events_skips_recent(db_session) -> None:
    from app.tasks.global_cleanup import prune_snooze_events

    sm = db_session
    user_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            from app.modules.auth.models import User
            from app.modules.cycle.models import SnoozeEvent

            session.add(
                User(id=user_id, email="cycle2@test.com", provider="local", is_verified=True)
            )
            session.add(
                SnoozeEvent(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    predicted_cycle_id=uuid.uuid4(),
                    day_offset=1,
                    snoozed_at=datetime.now(tz=UTC),
                )
            )
            await session.commit()

    _run(_seed())

    result = prune_snooze_events.delay()

    assert result.successful()
    assert result.result in (0, None)
