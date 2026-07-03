"""Cycle service tests: correction linking, error calc, snooze events."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from datetime import date, timedelta

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import pytest
import pytest_asyncio
from sqlalchemy import select
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
from app.modules.cycle.models import CycleEntry, PredictedCycle, SnoozeEvent
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
        email="cycle@test.com",
        provider="local",
        user_secret_key="a" * 64,
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
    data = CycleEntryCreate(period_start_date=date(2026, 5, 1), period_end_date=date(2026, 5, 5))
    return await svc.create_entry(user.id, data)


@pytest_asyncio.fixture
async def prediction(svc: CycleService, user: User, cycle_entry: CycleEntry) -> PredictedCycle:
    return await svc.compute_predictions(user.id)


@pytest.mark.asyncio
async def test_create_entry_creates_record(svc: CycleService, user: User) -> None:
    data = CycleEntryCreate(period_start_date=date(2026, 6, 1), period_end_date=date(2026, 6, 5))
    entry = await svc.create_entry(user.id, data)
    assert entry.user_id == user.id
    assert entry.period_start_date == date(2026, 6, 1)
    assert entry.is_correction is False


@pytest.mark.asyncio
async def test_create_entry_unique_constraint_upserts(svc: CycleService, user: User) -> None:
    data = CycleEntryCreate(period_start_date=date(2026, 6, 1), period_end_date=date(2026, 6, 5), flow_intensity="light")
    entry1 = await svc.create_entry(user.id, data)
    data2 = CycleEntryCreate(period_start_date=date(2026, 6, 1), period_end_date=date(2026, 6, 6), flow_intensity="heavy")
    entry2 = await svc.create_entry(user.id, data2)
    assert entry2.id == entry1.id
    assert entry2.flow_intensity == "heavy"


@pytest.mark.asyncio
async def test_compute_predictions_returns_prediction(svc: CycleService, user: User, cycle_entry: CycleEntry) -> None:
    prediction = await svc.compute_predictions(user.id)
    assert prediction.user_id == user.id
    assert prediction.predicted_next_period_start is not None
    assert prediction.model_version is not None


@pytest.mark.asyncio
async def test_compute_initial_prediction_fallback(svc: CycleService, user: User) -> None:
    """When no cycle entries exist, initial prediction should not crash."""
    prediction = await svc.compute_initial_prediction(user.id)
    assert prediction is not None
    assert prediction.predicted_next_period_start is not None
    assert prediction.model_version == "fallback"


@pytest.mark.asyncio
async def test_log_correction_links_prediction(svc: CycleService, user: User, prediction: PredictedCycle) -> None:
    actual_start = prediction.predicted_next_period_start + timedelta(days=3)
    entry = await svc.log_correction(
        user_id=user.id,
        period_start_date=actual_start,
        corrected_prediction_id=prediction.id,
    )
    assert entry.is_correction is True
    assert entry.corrected_prediction_id == prediction.id

    await svc.db.refresh(prediction)
    assert prediction.actual_cycle_entry_id == entry.id
    assert prediction.prediction_error_days == 3


@pytest.mark.asyncio
async def test_log_correction_negative_error(svc: CycleService, user: User, prediction: PredictedCycle) -> None:
    actual_start = prediction.predicted_next_period_start - timedelta(days=2)
    await svc.log_correction(
        user_id=user.id,
        period_start_date=actual_start,
        corrected_prediction_id=prediction.id,
    )
    await svc.db.refresh(prediction)
    assert prediction.prediction_error_days == -2


@pytest.mark.asyncio
async def test_log_correction_no_prediction_link(svc: CycleService, user: User) -> None:
    entry = await svc.log_correction(
        user_id=user.id,
        period_start_date=date(2026, 7, 1),
    )
    assert entry.is_correction is False
    assert entry.corrected_prediction_id is None


@pytest.mark.asyncio
async def test_log_correction_updates_ml_metrics(
    svc: CycleService, user: User, prediction: PredictedCycle,
) -> None:
    actual_start = prediction.predicted_next_period_start + timedelta(days=2)
    await svc.log_correction(
        user_id=user.id,
        period_start_date=actual_start,
        corrected_prediction_id=prediction.id,
    )
    await svc.db.refresh(user)
    assert user.total_cycles_logged == 1
    assert user.avg_prediction_error_days == 2.0
    assert user.is_dirty_for_retraining is True


@pytest.mark.asyncio
async def test_log_correction_updates_avg_error_running(
    svc: CycleService, user: User, prediction: PredictedCycle,
) -> None:
    """Two corrections should compute a running average of prediction errors."""
    actual1 = prediction.predicted_next_period_start + timedelta(days=2)
    await svc.log_correction(user.id, actual1, corrected_prediction_id=prediction.id)

    await svc.db.refresh(user)
    assert user.total_cycles_logged == 1
    assert user.avg_prediction_error_days == 2.0

    new_pred = await svc.compute_predictions(user.id)
    actual2 = new_pred.predicted_next_period_start + timedelta(days=4)
    await svc.log_correction(user.id, actual2, corrected_prediction_id=new_pred.id)

    await svc.db.refresh(user)
    assert user.total_cycles_logged == 2
    assert user.avg_prediction_error_days == 3.0  # (2 + 4) / 2


@pytest.mark.asyncio
async def test_log_snooze_creates_record(svc: CycleService, user: User, prediction: PredictedCycle) -> None:
    snooze = await svc.log_snooze(user.id, prediction.id, day_offset=1)
    assert snooze.user_id == user.id
    assert snooze.predicted_cycle_id == prediction.id
    assert snooze.day_offset == 1


@pytest.mark.asyncio
async def test_log_snooze_with_offset_0(svc: CycleService, user: User, prediction: PredictedCycle) -> None:
    snooze = await svc.log_snooze(user.id, prediction.id, day_offset=0)
    assert snooze.day_offset == 0


@pytest.mark.asyncio
async def test_log_snooze_multiple_events(svc: CycleService, user: User, prediction: PredictedCycle) -> None:
    await svc.log_snooze(user.id, prediction.id, day_offset=0)
    await svc.log_snooze(user.id, prediction.id, day_offset=1)
    await svc.log_snooze(user.id, prediction.id, day_offset=2)
    stmt = select(SnoozeEvent).where(SnoozeEvent.predicted_cycle_id == prediction.id)
    rows = (await svc.db.execute(stmt)).scalars().all()
    assert len(rows) == 3
    assert [r.day_offset for r in rows] == [0, 1, 2]


@pytest.mark.asyncio
async def test_log_snooze_raises_on_bad_prediction(svc: CycleService, user: User) -> None:
    import uuid

    from app.modules.cycle.exceptions import PredictionNotFoundError
    with pytest.raises(PredictionNotFoundError):
        await svc.log_snooze(user.id, uuid.uuid4(), day_offset=1)
