from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import asyncio
import uuid

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
    from app.modules.pregnancy import models  # noqa: F401

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


def test_check_pregnancy_reminders_empty(db_session) -> None:
    from app.modules.pregnancy.tasks import check_pregnancy_reminders

    result = check_pregnancy_reminders.delay()

    assert result.successful()
    assert result.result == 0


def test_check_pregnancy_reminders_sends_at_milestone(db_session) -> None:
    from app.modules.pregnancy.tasks import check_pregnancy_reminders

    sm = db_session
    user_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            from app.modules.auth.models import User
            from app.modules.pregnancy.models import PregnancyProfile

            session.add(
                User(id=user_id, email="preg@test.com", provider="local", is_verified=True)
            )
            session.add(
                PregnancyProfile(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    current_week=20,
                    is_active=True,
                )
            )
            await session.commit()

    _run(_seed())

    result = check_pregnancy_reminders.delay()

    assert result.successful()
    assert result.result == 1


def test_check_pregnancy_reminders_skips_non_milestone(db_session) -> None:
    from app.modules.pregnancy.tasks import check_pregnancy_reminders

    sm = db_session
    user_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            from app.modules.auth.models import User
            from app.modules.pregnancy.models import PregnancyProfile

            session.add(
                User(id=user_id, email="preg2@test.com", provider="local", is_verified=True)
            )
            session.add(
                PregnancyProfile(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    current_week=15,
                    is_active=True,
                )
            )
            await session.commit()

    _run(_seed())

    result = check_pregnancy_reminders.delay()

    assert result.successful()
    assert result.result == 0


def test_check_pregnancy_reminders_multiple_profiles(db_session) -> None:
    from app.modules.pregnancy.tasks import check_pregnancy_reminders

    sm = db_session

    async def _seed() -> None:
        async with sm() as session:
            from app.modules.auth.models import User
            from app.modules.pregnancy.models import PregnancyProfile

            for week in (12, 15, 28):
                uid = uuid.uuid4()
                session.add(
                    User(id=uid, email=f"preg{week}@test.com", provider="local", is_verified=True)
                )
                session.add(
                    PregnancyProfile(
                        id=uuid.uuid4(),
                        user_id=uid,
                        current_week=week,
                        is_active=True,
                    )
                )
            await session.commit()

    _run(_seed())

    result = check_pregnancy_reminders.delay()

    assert result.successful()
    assert result.result == 2
