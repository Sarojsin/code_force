from __future__ import annotations

import os
from collections.abc import AsyncIterator
from datetime import date

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import uuid

import pytest
import pytest_asyncio
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.database import Base
from app.modules.auth.models import User


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(type_, compiler, **kw):
    return "JSON"
from app.modules.cycle.exceptions import PredictionNotFoundError
from app.modules.cycle.models import CycleEntry
from app.modules.cycle.schemas import CycleEntryCreate
from app.modules.cycle.services import CycleService


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models as _auth_models  # noqa: F401
        from app.modules.cycle import models as _cycle_models  # noqa: F401
        from app.modules.onboarding import models as _onboard_models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def user(db_session: AsyncSession) -> User:
    u = User(
        email="cycle-extra@test.com",
        provider="local",
        user_secret_key="b" * 64,
    )
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> CycleService:
    return CycleService(db=db_session)


@pytest_asyncio.fixture
async def cycle_entry(svc: CycleService, user: User) -> CycleEntry:
    data = CycleEntryCreate(period_start_date=date(2026, 1, 1), period_end_date=date(2026, 1, 5))
    return await svc.create_entry(user.id, data)


@pytest.mark.asyncio
async def test_get_predictions_returns_list(svc: CycleService, user: User, cycle_entry: CycleEntry) -> None:
    await svc.compute_predictions(user.id)
    predictions = await svc.get_predictions(user.id)
    assert len(predictions) > 0
    assert predictions[0].user_id == user.id


@pytest.mark.asyncio
async def test_get_predictions_not_found(svc: CycleService, user: User) -> None:
    with pytest.raises(PredictionNotFoundError):
        await svc.get_predictions(user.id)


@pytest.mark.asyncio
async def test_get_prediction_by_id_success(svc: CycleService, user: User, cycle_entry: CycleEntry) -> None:
    pred = await svc.compute_predictions(user.id)
    found = await svc.get_prediction_by_id(pred.id, user.id)
    assert found.id == pred.id


@pytest.mark.asyncio
async def test_get_prediction_by_id_not_found(svc: CycleService, user: User) -> None:
    with pytest.raises(PredictionNotFoundError):
        await svc.get_prediction_by_id(uuid.uuid4(), user.id)


@pytest.mark.asyncio
async def test_get_predictions_with_cycle_lengths(svc: CycleService, user: User) -> None:
    data1 = CycleEntryCreate(period_start_date=date(2026, 2, 1), period_end_date=date(2026, 2, 5))
    await svc.create_entry(user.id, data1)
    data2 = CycleEntryCreate(period_start_date=date(2026, 3, 1), period_end_date=date(2026, 3, 6))
    await svc.create_entry(user.id, data2)
    data3 = CycleEntryCreate(period_start_date=date(2026, 4, 2), period_end_date=date(2026, 4, 7))
    await svc.create_entry(user.id, data3)
    await svc.compute_predictions(user.id)
    predictions = await svc.get_predictions(user.id)
    assert len(predictions) == 3


@pytest.mark.asyncio
async def test_compute_initial_prediction_updates_existing(svc: CycleService, user: User) -> None:
    first = await svc.compute_initial_prediction(user.id)
    assert first is not None
    assert first.user_id == user.id
    second = await svc.compute_initial_prediction(user.id)
    assert second.id == first.id


@pytest.mark.asyncio
async def test_global_model_exists_no_config(svc: CycleService) -> None:
    result = await svc._global_model_exists()
    assert result is False


@pytest.mark.asyncio
async def test_load_active_model_no_config(svc: CycleService) -> None:
    result = await svc._load_active_model()
    assert result is None


@pytest.mark.asyncio
async def test_compute_predictions_insufficient_data(svc: CycleService, user: User) -> None:
    from app.modules.cycle.exceptions import InsufficientDataError
    with pytest.raises(InsufficientDataError):
        await svc.compute_predictions(user.id)
