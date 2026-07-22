"""system_test.md scenarios — 3-state buffer, manual/auto logging, end-date rules."""
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
from unittest.mock import patch

from app.modules.cycle.models import CycleEntry, PredictedCycle
from app.modules.cycle.schemas import CycleEntryCreate
from app.modules.cycle.services import CycleService
from app.modules.cycle.exceptions import PeriodEndDateRequiredError


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
        email="system_test@test.com",
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


# =============================================================================
# 3-State Buffer Tests
# =============================================================================

# State A: Today < Start_Date (future)
@pytest.mark.asyncio
async def test_state_A_future_date_auto_fills_end(svc: CycleService, user: User) -> None:
    """State A: logging a future start date → end date auto-filled."""
    future = date.today() + timedelta(days=10)
    entry = await svc.create_entry(user.id, CycleEntryCreate(period_start_date=future))
    assert entry.period_start_date == future
    assert entry.period_end_date is not None
    assert entry.period_end_date == future + timedelta(days=4)  # avg period length - 1


# State B: Start_Date <= Today <= Start_Date + Avg - 1 (within window)
@pytest.mark.asyncio
async def test_state_B_within_window_auto_fills_end(svc: CycleService, user: User) -> None:
    """State B: logging a start date within avg window → end date auto-filled."""
    today = date.today()
    entry = await svc.create_entry(user.id, CycleEntryCreate(period_start_date=today))
    assert entry.period_start_date == today
    assert entry.period_end_date is not None
    assert entry.period_end_date == today + timedelta(days=4)


# State C: Today > Prediction_End (prediction window has passed) → end date REQUIRED
@pytest.mark.asyncio
async def test_state_C_past_window_requires_end_date(svc: CycleService, user: User) -> None:
    """State C: logging a start date past the prediction window without end date raises error."""
    await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 5, 1), period_end_date=date(2026, 5, 5)),
    )
    pred = await svc.compute_predictions(user.id)
    # pred's predicted_next_period_start is ~May 29, window ends ~June 2.
    # Today (July 22) > pred_end → logging May 29 without end → State C
    with pytest.raises(PeriodEndDateRequiredError):
        await svc.create_entry(user.id, CycleEntryCreate(period_start_date=pred.predicted_next_period_start))


@pytest.mark.asyncio
async def test_state_C_past_window_with_end_date_succeeds(svc: CycleService, user: User) -> None:
    """State C: providing end date for past start succeeds."""
    await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 5, 1), period_end_date=date(2026, 5, 5)),
    )
    pred = await svc.compute_predictions(user.id)
    pred_date = pred.predicted_next_period_start
    entry = await svc.create_entry(
        user.id, CycleEntryCreate(period_start_date=pred_date, period_end_date=pred_date + timedelta(days=5)),
    )
    assert entry.period_start_date == pred_date
    assert entry.period_end_date == pred_date + timedelta(days=5)


# =============================================================================
# Scenario 1: Priya confirms on predicted date (Sticky Card "Yes")
# =============================================================================
# Model predicts June 15. Reality: period starts June 15.
# User taps "Yes, started on June 15."
# Expected: prediction_error_days = 0, avg stays 5 days
# =============================================================================

@pytest.mark.asyncio
async def test_scenario1_confirm_on_predicted_date(
    svc: CycleService, user: User, prediction: PredictedCycle,
) -> None:
    pred_date = prediction.predicted_next_period_start
    entry = await svc.log_correction(
        user_id=user.id,
        period_start_date=pred_date,
        corrected_prediction_id=prediction.id,
    )
    assert entry.is_correction is True
    assert entry.period_start_date == pred_date

    await svc.db.refresh(prediction)
    assert prediction.prediction_error_days == 0  # perfect prediction

    await svc.db.refresh(user)
    assert user.avg_prediction_error_days == 0.0


# =============================================================================
# Scenario 2A: Priya logs manually on Day 3 (State B, no end date)
# =============================================================================
# It is June 17. She logs start=June 15, leaves end empty.
# Expected: auto-linked to prediction, end auto-filled, P shown
# =============================================================================

@pytest.mark.asyncio
async def test_scenario2A_manual_log_within_window_auto_links(
    svc: CycleService, user: User,
) -> None:
    """Scenario 2A: manual log within prediction window auto-links and auto-fills end."""
    await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 5, 15), period_end_date=date(2026, 5, 19)),
    )
    pred = await svc.compute_predictions(user.id)
    pred.predicted_next_period_start = date(2026, 6, 15)
    await svc.db.flush()

    with patch("app.modules.cycle.services.date") as mock_date:
        mock_date.today.return_value = date(2026, 6, 17)
        mock_date.side_effect = lambda *args, **kw: date(*args, **kw)

        entry = await svc.create_entry(
            user.id,
            CycleEntryCreate(period_start_date=date(2026, 6, 15)),
        )
    # Should auto-link to the prediction (within ±5 day window)
    await svc.db.refresh(pred)
    assert entry.period_end_date is not None
    assert pred.actual_cycle_entry_id == entry.id
    cal = await svc.get_calendar(user.id, months_back=3, months_forward=3)
    assert any(v == "P" for v in cal["days"].values())


# =============================================================================
# Scenario 2B: Priya overrides end date (correcting the average)
# =============================================================================
# Period was 7 days instead of 5. She enters start=June 15, end=June 21.
# Expected: period_end_date=June 21, avg_period_length recalculated
# =============================================================================

@pytest.mark.asyncio
async def test_scenario2B_override_end_date_updates_average(
    svc: CycleService, user: User, cycle_entry: CycleEntry,
) -> None:
    await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 6, 10), period_end_date=date(2026, 6, 14)),
    )

    avg_before = await svc.get_avg_period_length(user.id)
    assert avg_before == 5  # both entries are 5 days

    # Now log a 7-day period
    entry = await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 7, 10), period_end_date=date(2026, 7, 16)),
    )
    assert entry.period_end_date == date(2026, 7, 16)

    avg_after = await svc.get_avg_period_length(user.id)
    assert avg_after > 5  # should have increased


# =============================================================================
# Scenario 2C: Priya forgot to log, period already ended (State C)
# =============================================================================
# Today is June 25. Period was June 15-21. She enters both dates.
# Expected: entry created, linked to prediction, avg updated
# =============================================================================

@pytest.mark.asyncio
async def test_scenario2C_forgot_period_ended_both_dates_required(
    svc: CycleService, user: User, prediction: PredictedCycle,
) -> None:
    pred_date = prediction.predicted_next_period_start
    prediction.predicted_next_period_start = pred_date
    await svc.db.flush()

    # Without end date → raises error (State C)
    with pytest.raises(PeriodEndDateRequiredError):
        await svc.create_entry(user.id, CycleEntryCreate(period_start_date=pred_date))

    # With end date → succeeds
    entry = await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=pred_date, period_end_date=pred_date + timedelta(days=6)),
    )
    assert entry.period_end_date == pred_date + timedelta(days=6)


# =============================================================================
# Scenario 4: Priya logs period EARLY (5 days before prediction)
# =============================================================================
# Model predicts June 20. She gets period June 15.
# She taps "No, adjust date" and selects June 15.
# Expected: prediction_error_days = -5, avg shifts negative
# =============================================================================

@pytest.mark.asyncio
async def test_scenario4_early_period_negative_error(
    svc: CycleService, user: User, cycle_entry: CycleEntry,
) -> None:
    pred = await svc.compute_predictions(user.id)
    pred.predicted_next_period_start = date(2026, 6, 20)
    await svc.db.flush()

    actual_start = date(2026, 6, 15)
    entry = await svc.log_correction(
        user_id=user.id,
        period_start_date=actual_start,
        corrected_prediction_id=pred.id,
    )
    assert entry.is_correction is True

    await svc.db.refresh(pred)
    assert pred.prediction_error_days == -5  # June 15 - June 20 = -5

    await svc.db.refresh(user)
    assert user.avg_prediction_error_days == -5.0


# =============================================================================
# Scenario 5: Priya logs a period that ended LAST MONTH (Forgot to log)
# =============================================================================
# Today is June 25. She logs May 10-14.
# Expected: State C enforced, entry stored, avg_cycle_length recalculated
# =============================================================================

@pytest.mark.asyncio
async def test_scenario5_forgot_last_month_state_C_enforced(svc: CycleService, user: User) -> None:
    """Forgotten period from last month — State C requires end date."""
    await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 4, 10), period_end_date=date(2026, 4, 14)),
    )
    # Prediction covers ~May 8-12, window has passed → May 10 is State C
    await svc.compute_predictions(user.id)

    # Try logging May 10 without end date — should fail (State C)
    with pytest.raises(PeriodEndDateRequiredError):
        await svc.create_entry(
            user.id,
            CycleEntryCreate(period_start_date=date(2026, 5, 10)),
        )

    # With end date — should succeed
    entry = await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 5, 10), period_end_date=date(2026, 5, 14)),
    )
    assert entry.period_start_date == date(2026, 5, 10)
    assert entry.period_end_date == date(2026, 5, 14)


# =============================================================================
# Scenario 5b: Old period stored correctly in calendar
# =============================================================================

@pytest.mark.asyncio
async def test_scenario5b_old_period_shows_in_calendar(svc: CycleService, user: User) -> None:
    entry = await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 5, 10), period_end_date=date(2026, 5, 14)),
    )
    cal = await svc.get_calendar(user.id, months_back=6, months_forward=3)
    period_days = [
        (date(2026, 5, 10) + timedelta(days=i)).isoformat()
        for i in range(5)
    ]
    # At least the start day should be 'P'
    assert cal["days"].get(period_days[0]) == "P"
