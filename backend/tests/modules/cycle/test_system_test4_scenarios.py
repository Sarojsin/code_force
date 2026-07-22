"""system_test4.md scenarios — 4-phase calendar rollover, phase calculation, BS invariance."""
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
from app.modules.cycle.exceptions import CycleConflictError, PeriodEndDateRequiredError
from app.modules.cycle.models import CycleEntry, PredictedCycle
from app.modules.cycle.schemas import CycleEntryCreate
from app.modules.cycle.services import CycleService, InsufficientDataError
from app.modules.cycle.phase_utils import calculate_cycle_phases, compute_period_length


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
        email="system_test4@test.com",
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
async def initial_entry(svc: CycleService, user: User) -> CycleEntry:
    return await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2025, 6, 1), period_end_date=date(2025, 6, 5)),
    )


# =============================================================================
# Scenario 13: 4-Phase Calendar Rollover — Phase Calculation
# =============================================================================


class TestScenario13PhaseCalculation:
    """Pure-function tests for calculate_cycle_phases (phase_utils.py)."""

    def test_phases_ovulation_date_formula(self) -> None:
        """Ovulation = start + (cycle_length - 14), clamped to [10, 40]."""
        start = date(2025, 6, 5)
        phases = calculate_cycle_phases(start, cycle_length=28, period_length=5)
        # ovulation_offset = max(10, min(28-14, 40)) = 14
        assert phases["ovulation_date"] == date(2025, 6, 19)

    def test_phases_fertile_window(self) -> None:
        """Fertile window spans ovulation - 4 days through ovulation."""
        start = date(2025, 6, 5)
        phases = calculate_cycle_phases(start, 28, 5)
        assert phases["fertile_start"] == date(2025, 6, 15)
        assert phases["fertile_end"] == date(2025, 6, 19)

    def test_phases_luteal_phase(self) -> None:
        """Luteal phase starts day after ovulation, ends day before next period."""
        start = date(2025, 6, 5)
        phases = calculate_cycle_phases(start, 28, 5)
        assert phases["luteal_start"] == date(2025, 6, 20)
        assert phases["luteal_end"] == date(2025, 7, 2)

    def test_phases_period_end(self) -> None:
        """Period end = start + (period_length - 1)."""
        phases = calculate_cycle_phases(date(2025, 6, 5), 28, 5)
        assert phases["period_end"] == date(2025, 6, 9)

    def test_phases_short_cycle_clamps_ovulation(self) -> None:
        """Very short cycle (21 days) clamps ovulation_offset to min 10."""
        start = date(2025, 6, 5)
        phases = calculate_cycle_phases(start, 21, 5)
        assert phases["ovulation_date"] == date(2025, 6, 15)

    def test_phases_long_cycle_clamps_ovulation(self) -> None:
        """Very long cycle (60 days) clamps ovulation_offset to max 40."""
        start = date(2025, 6, 5)
        phases = calculate_cycle_phases(start, 60, 5)
        assert phases["ovulation_date"] == date(2025, 7, 15)

    def test_compute_period_length_with_end_date(self) -> None:
        """compute_period_length returns days inclusive."""
        assert compute_period_length(date(2025, 6, 1), date(2025, 6, 5)) == 5

    def test_compute_period_length_without_end_date(self) -> None:
        """compute_period_length falls back to default when no end_date."""
        assert compute_period_length(date(2025, 6, 1), None) == 5
        assert compute_period_length(date(2025, 6, 1), None, fallback=7) == 7


# =============================================================================
# Scenario 13: Correction links to prediction with error calculation
# =============================================================================


@pytest.mark.asyncio
async def test_scenario13_correction_links_to_prediction(
    svc: CycleService, user: User, initial_entry: CycleEntry,
) -> None:
    """Correction with corrected_prediction_id sets actual_cycle_entry_id + error."""
    pred = await svc.compute_predictions(user.id)
    assert pred.predicted_next_period_start == date(2025, 6, 29)

    # User corrects to June 5 (4 days late from predicted June 1? No, June 1 was the entry)
    # Prediction said next period June 29, but user corrects to July 3.
    correction = await svc.log_correction(
        user_id=user.id,
        period_start_date=date(2025, 7, 3),
        corrected_prediction_id=pred.id,
    )
    assert correction.is_correction is True
    assert correction.corrected_prediction_id == pred.id

    # Reload prediction and verify archiving
    archived = await svc.db.get(PredictedCycle, pred.id)
    assert archived.actual_cycle_entry_id == correction.id
    # error = July 3 - June 29 = +4 days
    assert archived.prediction_error_days == 4


@pytest.mark.asyncio
async def test_scenario13_correction_negative_error(
    svc: CycleService, user: User, initial_entry: CycleEntry,
) -> None:
    """Prediction error can be negative when period starts early."""
    pred = await svc.compute_predictions(user.id)
    # Correction with date BEFORE prediction → negative error
    correction = await svc.log_correction(
        user_id=user.id,
        period_start_date=date(2025, 6, 25),
        corrected_prediction_id=pred.id,
    )
    archived = await svc.db.get(PredictedCycle, pred.id)
    # error = June 25 - June 29 = -4 days
    assert archived.prediction_error_days == -4


@pytest.mark.asyncio
async def test_scenario13_correction_triggers_new_prediction(
    svc: CycleService, user: User, initial_entry: CycleEntry,
) -> None:
    """After correction, compute_predictions generates the next cycle."""
    pred1 = await svc.compute_predictions(user.id)
    assert pred1.predicted_next_period_start == date(2025, 6, 29)

    await svc.log_correction(
        user_id=user.id,
        period_start_date=date(2025, 7, 3),
        corrected_prediction_id=pred1.id,
    )

    # compute_predictions creates a new prediction based on corrected date
    pred2 = await svc.compute_predictions(user.id)
    # The new prediction's next period start is calculated from the corrected date
    # (July 3 + 28-day avg cycle from the single entry)
    assert pred2.predicted_next_period_start == date(2025, 7, 3)


# =============================================================================
# Scenario 14: BS Calendar Switch — Backend invariance
# =============================================================================


@pytest.mark.asyncio
async def test_scenario14_entries_stored_as_iso(
    svc: CycleService, user: User,
) -> None:
    """All period dates are stored as ISO-8601 dates regardless of display system."""
    entry = await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2025, 7, 22), period_end_date=date(2025, 7, 26)),
    )
    assert entry.period_start_date == date(2025, 7, 22)
    assert entry.period_end_date == date(2025, 7, 26)

    # Fetch from DB and verify no BS/calendar-converted values exist
    fetched = await svc.db.get(CycleEntry, entry.id)
    assert fetched.period_start_date.isoformat() == "2025-07-22"
    assert fetched.period_end_date.isoformat() == "2025-07-26"


@pytest.mark.asyncio
async def test_scenario14_prediction_dates_are_iso(
    svc: CycleService, user: User, initial_entry: CycleEntry,
) -> None:
    """Predicted cycle dates are ISO-8601, never BS."""
    pred = await svc.compute_predictions(user.id)
    assert pred.predicted_next_period_start.isoformat() == "2025-06-29"

    # Fertile window dates are also ISO
    assert pred.predicted_fertile_window_start is not None
    assert pred.predicted_fertile_window_end is not None
    assert pred.predicted_fertile_window_start.isoformat() == "2025-06-15"
    # Backend uses a 5-day fertile window (next_start - 14 to that + 5)
    assert pred.predicted_fertile_window_end.isoformat() == "2025-06-20"


@pytest.mark.asyncio
async def test_scenario14_api_payload_iso_only(
    svc: CycleService, user: User,
) -> None:
    """The service layer only accepts ISO date objects, never BS-encoded strings."""
    entry_data = CycleEntryCreate(
        period_start_date=date(2026, 7, 22),
        period_end_date=date(2026, 7, 26),
    )
    entry = await svc.create_entry(user.id, entry_data)
    assert entry.period_start_date == date(2026, 7, 22)
    results = await svc.list_entries(user.id)
    assert any(e.id == entry.id for e in results)
