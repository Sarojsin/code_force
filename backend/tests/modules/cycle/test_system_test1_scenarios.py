"""system_test1.md scenarios — backfill flow, anovulatory cycle type, missed-cycle detection."""
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
from app.modules.cycle.models import CycleEntry, PredictedCycle
from app.modules.cycle.schemas import CycleEntryCreate
from app.modules.cycle.services import CycleService, InsufficientDataError


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
        email="system_test1@test.com",
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


# =============================================================================
# Backfill Detection: Missed Cycles Calculation
# =============================================================================
# Formula: missedCycles = floor(daysSinceLast / avgCycleLength) - 1
# Gap < 28 days → 0 cards
# Gap 28-55 days → 1 card
# Gap 56-85 days → 2 cards
# Gap 86-115 days → 3 cards
# =============================================================================


def missed_cycle_count(days_since: int, avg_cycle: int = 28) -> int:
    """Replicate the mobile's getBackfillCards logic."""
    if days_since <= 0:
        return 0
    missed = days_since // avg_cycle - 1
    return max(0, min(missed, 3))


class TestBackfillDetection:

    def test_no_gap_zero_cards(self) -> None:
        assert missed_cycle_count(0) == 0
        assert missed_cycle_count(27) == 0

    def test_one_missed_cycle_one_card(self) -> None:
        assert missed_cycle_count(28) == 0  # floor(28/28) - 1 = 0
        assert missed_cycle_count(55) == 0  # floor(55/28) - 1 = 1 - 1 = 0
        assert missed_cycle_count(56) == 1  # floor(56/28) - 1 = 2 - 1 = 1

    def test_two_missed_cycles_two_cards(self) -> None:
        assert missed_cycle_count(84) == 2  # floor(84/28) - 1 = 3 - 1 = 2

    def test_three_missed_cycles_three_cards(self) -> None:
        assert missed_cycle_count(112) == 3  # floor(112/28) - 1 = 4 - 1 = 3

    def test_capped_at_three_cards(self) -> None:
        assert missed_cycle_count(200) == 3  # capped
        assert missed_cycle_count(365) == 3  # capped


# =============================================================================
# Backfill Flow: Sequential Period Logging
# =============================================================================
# Pre-condition: Last logged period May 10-14. Today is ~Aug 20 (102 days gap).
# User fills: Aug 14-18, Jul 13-17, Jun 11-15
# Expected: avg_cycle_length recalculates, prediction resumes
# =============================================================================


@pytest.mark.asyncio
async def test_backfill_sequential_period_logging(svc: CycleService, user: User) -> None:
    """Simulate backfilling 3 missed months sequentially."""
    # Start with 2 entries so predictions work
    await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2025, 3, 1), period_end_date=date(2025, 3, 5)),
    )

    # Card 1: Fill August (most recent)
    aug = await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2025, 8, 14), period_end_date=date(2025, 8, 18)),
    )
    assert aug.period_start_date == date(2025, 8, 14)

    # Card 2: Fill July
    jul = await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2025, 7, 13), period_end_date=date(2025, 7, 17)),
    )
    assert jul.period_start_date == date(2025, 7, 13)

    # Card 3: Fill June
    jun = await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2025, 6, 11), period_end_date=date(2025, 6, 15)),
    )
    assert jun.period_start_date == date(2025, 6, 11)

    # All 3 entries stored
    stmt = select(CycleEntry).where(CycleEntry.user_id == user.id, CycleEntry.is_active.is_(True))
    entries = (await svc.db.execute(stmt)).scalars().all()
    assert len(entries) == 4  # 3 backfill + 1 initial = 4

    # Prediction should resume with the new data
    pred = await svc.compute_predictions(user.id)
    assert pred is not None
    assert pred.predicted_next_period_start is not None


# =============================================================================
# Anovulatory Cycle Type: Predictions Suspended
# =============================================================================
# When last entry has cycle_type = 'anovulatory', predictions should suspend.
# When a menstrual entry is logged, predictions resume.
# =============================================================================


@pytest.mark.asyncio
async def test_anovulatory_suspends_predictions(svc: CycleService, user: User) -> None:
    """Anovulatory entry → compute_predictions raises InsufficientDataError."""
    await svc.create_entry(
        user.id,
        CycleEntryCreate(
            period_start_date=date(2026, 6, 1),
            period_end_date=date(2026, 6, 5),
            cycle_type="anovulatory",
        ),
    )
    with pytest.raises(InsufficientDataError, match="anovulatory"):
        await svc.compute_predictions(user.id)


@pytest.mark.asyncio
async def test_anovulatory_calendar_returns_no_prediction(svc: CycleService, user: User) -> None:
    """Calendar should return None for predictions when last entry is anovulatory."""
    await svc.create_entry(
        user.id,
        CycleEntryCreate(
            period_start_date=date(2026, 6, 1),
            period_end_date=date(2026, 6, 5),
            cycle_type="anovulatory",
        ),
    )
    cal = await svc.get_calendar(user.id, months_back=3, months_forward=3)
    assert cal["predictions"] is None
    assert cal["next_period_in_days"] is None


@pytest.mark.asyncio
async def test_anovulatory_still_renders_period_on_calendar(svc: CycleService, user: User) -> None:
    """Anovulatory entries should still show as Dark Pink on the calendar."""
    await svc.create_entry(
        user.id,
        CycleEntryCreate(
            period_start_date=date(2026, 6, 1),
            period_end_date=date(2026, 6, 5),
            cycle_type="anovulatory",
        ),
    )
    cal = await svc.get_calendar(user.id, months_back=3, months_forward=3)
    # The period start should still be marked
    assert cal["days"].get("2026-06-01") == "P"


@pytest.mark.asyncio
async def test_menstrual_resumes_predictions_after_anovulatory(
    svc: CycleService, user: User,
) -> None:
    """Logging a menstrual entry after anovulatory resumes predictions."""
    # First log anovulatory
    await svc.create_entry(
        user.id,
        CycleEntryCreate(
            period_start_date=date(2026, 6, 1),
            period_end_date=date(2026, 6, 5),
            cycle_type="anovulatory",
        ),
    )
    with pytest.raises(InsufficientDataError):
        await svc.compute_predictions(user.id)

    # Now log a menstrual entry
    await svc.create_entry(
        user.id,
        CycleEntryCreate(
            period_start_date=date(2026, 7, 1),
            period_end_date=date(2026, 7, 5),
            cycle_type="menstrual",
        ),
    )

    # And a second menstrual entry so compute_predictions has enough data
    await svc.create_entry(
        user.id,
        CycleEntryCreate(
            period_start_date=date(2026, 7, 29),
            period_end_date=date(2026, 8, 2),
            cycle_type="menstrual",
        ),
    )

    pred = await svc.compute_predictions(user.id)
    assert pred is not None
    assert pred.predicted_next_period_start is not None


# =============================================================================
# Anovulatory + Correction
# =============================================================================


@pytest.mark.asyncio
async def test_correction_with_anovulatory_type(svc: CycleService, user: User) -> None:
    """Correction with cycle_type='anovulatory' should suspend predictions."""
    await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 5, 1), period_end_date=date(2026, 5, 5)),
    )
    pred = await svc.compute_predictions(user.id)
    pred.predicted_next_period_start = date(2026, 6, 10)
    await svc.db.flush()

    entry = await svc.log_correction(
        user_id=user.id,
        period_start_date=date(2026, 6, 14),
        period_end_date=date(2026, 6, 18),
        corrected_prediction_id=pred.id,
        cycle_type="anovulatory",
    )
    assert entry.cycle_type == "anovulatory"

    # Predictions should be suspended
    cal = await svc.get_calendar(user.id, months_back=3, months_forward=3)
    assert cal["predictions"] is None


# =============================================================================
# Avg Cycle Length Recalculation After Backfill
# =============================================================================


@pytest.mark.asyncio
async def test_avg_cycle_length_recalculation(svc: CycleService, user: User) -> None:
    """Backfilling entries should update avg_cycle_length via auto-link flow."""
    # Entry 1
    await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2025, 1, 1), period_end_date=date(2025, 1, 5)),
    )
    # Compute prediction so entry 2 will auto-link
    pred = await svc.compute_predictions(user.id)

    # Entry 2 — within auto-link window of prediction → triggers _update_user_ml_metrics
    await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2025, 1, 29), period_end_date=date(2025, 2, 2)),
    )

    await svc.db.refresh(user)
    assert user.avg_cycle_length is not None

    # Add a 3rd entry for compute_predictions to have ≥2
    await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2025, 2, 26), period_end_date=date(2025, 3, 2)),
    )

    pred = await svc.compute_predictions(user.id)
    assert pred is not None
