"""Cycle Celery task tests: update_cycle_predictions, train_global_model."""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import asyncio
import uuid
from datetime import UTC, date, datetime
from unittest.mock import AsyncMock, patch

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


# ---------------------------------------------------------------------------
# update_cycle_predictions
# ---------------------------------------------------------------------------


def test_update_cycle_predictions_empty(db_session) -> None:
    from app.modules.cycle.tasks import update_cycle_predictions

    result = update_cycle_predictions.delay()

    assert result.successful()
    assert result.result == 0


def test_update_cycle_predictions_with_data(db_session) -> None:
    from app.modules.cycle.tasks import update_cycle_predictions

    sm = db_session
    user_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            from app.modules.auth.models import User
            from app.modules.cycle.models import CycleEntry

            session.add(
                User(id=user_id, email="cycle@test.com", provider="local", is_verified=True)
            )
            session.add(
                CycleEntry(id=uuid.uuid4(), user_id=user_id, period_start_date=date(2025, 1, 1))
            )
            await session.commit()

    _run(_seed())

    with patch(
        "app.modules.cycle.services.CycleService.compute_predictions", new_callable=AsyncMock
    ) as mock_cp:
        result = update_cycle_predictions.delay()

    assert result.successful()
    assert result.result == 1
    mock_cp.assert_awaited_once_with(user_id)


def test_update_cycle_predictions_partial_failure(db_session) -> None:
    from app.modules.cycle.tasks import update_cycle_predictions

    sm = db_session
    good_id = uuid.uuid4()
    bad_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            from app.modules.auth.models import User
            from app.modules.cycle.models import CycleEntry

            session.add(
                User(id=good_id, email="good@cycle.com", provider="local", is_verified=True)
            )
            session.add(
                User(id=bad_id, email="bad@cycle.com", provider="local", is_verified=True)
            )
            session.add(
                CycleEntry(id=uuid.uuid4(), user_id=good_id, period_start_date=date(2025, 1, 1))
            )
            session.add(
                CycleEntry(id=uuid.uuid4(), user_id=bad_id, period_start_date=date(2025, 3, 1))
            )
            await session.commit()

    _run(_seed())

    with patch(
        "app.modules.cycle.services.CycleService.compute_predictions", new_callable=AsyncMock
    ) as mock_cp:
        mock_cp.side_effect = [Exception("compute error"), None]
        result = update_cycle_predictions.delay()

    assert result.successful()
    assert result.result == 1
    assert mock_cp.await_count == 2


# ---------------------------------------------------------------------------
# train_global_model
# ---------------------------------------------------------------------------


def test_train_global_model(db_session) -> None:
    from app.modules.cycle.tasks import train_global_model

    with patch("scripts.train_global_model.train_global_model", return_value=True) as mock_train:
        result = train_global_model.delay()

    assert result.successful()
    assert result.result is True
    mock_train.assert_called_once_with()
