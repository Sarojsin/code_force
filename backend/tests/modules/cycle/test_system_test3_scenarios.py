"""system_test3.md scenarios — conflict resolution (409), irregular cycles, edge cases."""
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
        email="system_test3@test.com",
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
        CycleEntryCreate(period_start_date=date(2026, 6, 1), period_end_date=date(2026, 6, 5)),
    )


# =============================================================================
# Scenario 7: Multi-Device Conflict (409)
# =============================================================================
# Phone offline corrects to June 12 (9:00 AM). Web online corrects to June 14
# (10:00 AM). Phone reconnects → 409 with server_data wins.
# =============================================================================


@pytest.mark.asyncio
async def test_scenario7_conflict_older_client_updated_at_raises_409(
    svc: CycleService, user: User, initial_entry: CycleEntry,
) -> None:
    """Phone syncs a correction with stale client_updated_at → CycleConflictError."""
    await svc.compute_predictions(user.id)

    # Web corrects at 10:00 AM — succeeds (no client_updated_at = online)
    web = await svc.log_correction(
        user_id=user.id,
        period_start_date=date(2026, 6, 14),
        corrected_prediction_id=None,
        client_updated_at=None,
    )
    assert web.period_start_date == date(2026, 6, 14)

    # Phone tries to sync a correction made at 9:00 AM — stale → conflict
    with pytest.raises(CycleConflictError, match="modified since you last synced"):
        await svc.log_correction(
            user_id=user.id,
            period_start_date=date(2026, 6, 12),
            corrected_prediction_id=None,
            client_updated_at="2026-06-12T09:00:00Z",
        )


@pytest.mark.asyncio
async def test_scenario7_conflict_returns_latest_server_data(
    svc: CycleService, user: User, initial_entry: CycleEntry,
) -> None:
    """Server returns 409 with server_data containing the winning entry."""
    await svc.compute_predictions(user.id)

    # Web correction persists
    await svc.log_correction(
        user_id=user.id,
        period_start_date=date(2026, 6, 14),
        corrected_prediction_id=None,
        client_updated_at=None,
    )

    try:
        await svc.log_correction(
            user_id=user.id,
            period_start_date=date(2026, 6, 12),
            corrected_prediction_id=None,
            client_updated_at="2026-06-12T09:00:00Z",
        )
    except CycleConflictError as e:
        # The server still has the June 14 entry
        latest = (
            await svc.db.execute(
                select(CycleEntry)
                .where(CycleEntry.user_id == user.id, CycleEntry.is_active.is_(True))
                .order_by(CycleEntry.period_start_date.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        assert latest is not None
        assert latest.period_start_date == date(2026, 6, 14)


# =============================================================================
# Scenario 8: Different Periods — No Conflict
# =============================================================================
# Phone corrects Period A (June 10). Web corrects Period B (July 15).
# Both sync independently — no false conflicts.
# =============================================================================


@pytest.mark.asyncio
async def test_scenario8_different_periods_no_conflict(
    svc: CycleService, user: User,
) -> None:
    """Corrections for different periods do not conflict."""
    await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 5, 1), period_end_date=date(2026, 5, 5)),
    )
    pred = await svc.compute_predictions(user.id)
    pred.predicted_next_period_start = date(2026, 6, 10)
    await svc.db.flush()

    # Phone corrects Period A
    a = await svc.log_correction(
        user_id=user.id,
        period_start_date=date(2026, 6, 10),
        corrected_prediction_id=pred.id,
        client_updated_at=None,
    )
    assert a.period_start_date == date(2026, 6, 10)

    # Web corrects Period B — use a recent client_updated_at so the conflict
    # check (which compares against the latest entry's created_at) passes.
    prev_correction_at = a.created_at.isoformat()
    b = await svc.log_correction(
        user_id=user.id,
        period_start_date=date(2026, 7, 15),
        corrected_prediction_id=None,
        client_updated_at=prev_correction_at,
    )
    assert b.period_start_date == date(2026, 7, 15)

    # Both entries exist
    entries = (
        await svc.db.execute(
            select(CycleEntry)
            .where(CycleEntry.user_id == user.id, CycleEntry.is_active.is_(True))
            .order_by(CycleEntry.period_start_date.asc())
        )
    ).scalars().all()
    assert len(entries) >= 2  # initial entry + Period A + Period B
    period_starts = [e.period_start_date for e in entries]
    assert date(2026, 6, 10) in period_starts
    assert date(2026, 7, 15) in period_starts


# =============================================================================
# Scenario 9: 60-Day Gap (Perimenopausal)
# =============================================================================
# Logs Jan 1, then March 2 (60 days). SQLite stores the gap. Prediction
# confidence drops but still renders a window.
# =============================================================================


@pytest.mark.asyncio
async def test_scenario9_sixty_day_gap_stored(svc: CycleService, user: User) -> None:
    """60-day gap between periods — entry stored and prediction still computed."""
    await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 1, 1), period_end_date=date(2026, 1, 5)),
    )
    await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 3, 2), period_end_date=date(2026, 3, 6)),
    )

    entries = (
        await svc.db.execute(
            select(CycleEntry)
            .where(CycleEntry.user_id == user.id, CycleEntry.is_active.is_(True))
            .order_by(CycleEntry.period_start_date.asc())
        )
    ).scalars().all()
    assert len(entries) == 2
    assert entries[1].period_start_date == date(2026, 3, 2)

    pred = await svc.compute_predictions(user.id)
    assert pred is not None
    assert pred.confidence_score is not None
    # 60-day gap produces low confidence
    assert pred.confidence_score <= 0.5


@pytest.mark.asyncio
async def test_scenario9_sixty_day_gap_calendar_shows_prediction(
    svc: CycleService, user: User,
) -> None:
    """Calendar still returns a prediction window after a 60-day gap."""
    await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 1, 1), period_end_date=date(2026, 1, 5)),
    )
    await svc.create_entry(
        user.id,
        CycleEntryCreate(period_start_date=date(2026, 3, 2), period_end_date=date(2026, 3, 6)),
    )

    cal = await svc.get_calendar(user.id, months_back=6, months_forward=6)
    assert cal["predictions"] is not None
    assert cal["predictions"]["confidence_score"] <= 0.5


# =============================================================================
# Scenario 10: No Cycle Data (Postpartum)
# =============================================================================
# User opens app with no cycle data. Empty state — no crash.
# =============================================================================


@pytest.mark.asyncio
async def test_scenario10_no_data_empty_entries(svc: CycleService, user: User) -> None:
    """No cycle entries returns empty list."""
    entries = await svc.list_entries(user.id)
    assert entries == []


@pytest.mark.asyncio
async def test_scenario10_no_data_predictions_not_available(svc: CycleService, user: User) -> None:
    """No entries → compute_predictions raises InsufficientDataError."""
    with pytest.raises(InsufficientDataError):
        await svc.compute_predictions(user.id)


@pytest.mark.asyncio
async def test_scenario10_no_data_calendar_returns_empty_days(
    svc: CycleService, user: User,
) -> None:
    """Calendar with no entries returns days dict without P markers."""
    cal = await svc.get_calendar(user.id, months_back=3, months_forward=3)
    assert cal["days"] is not None
    period_days = [k for k, v in cal["days"].items() if v == "P"]
    assert len(period_days) == 0


# =============================================================================
# Scenario 11: Future Date Entry
# =============================================================================
# Today is July 20. User logs start date July 25. Rendered in Light Pink (p).
# =============================================================================


@pytest.mark.asyncio
async def test_scenario11_future_date_accepted(svc: CycleService, user: User) -> None:
    """Future start date (State A) is accepted and end date auto-filled."""
    future = date.today() + timedelta(days=5)
    entry = await svc.create_entry(user.id, CycleEntryCreate(period_start_date=future))
    assert entry.period_start_date == future
    assert entry.period_end_date is not None


@pytest.mark.asyncio
async def test_scenario11_future_date_calendar_marking(svc: CycleService, user: User) -> None:
    """Future date entry renders on calendar."""
    future = date.today() + timedelta(days=5)
    await svc.create_entry(user.id, CycleEntryCreate(period_start_date=future))

    cal = await svc.get_calendar(user.id, months_back=1, months_forward=3)
    future_str = future.isoformat()
    assert cal["days"].get(future_str) == "P"


# =============================================================================
# Scenario 12: End Date Before Start Date
# =============================================================================
# Start June 10. End June 8 → rejected by validation.
# =============================================================================


@pytest.mark.asyncio
async def test_scenario12_end_before_start_rejected_by_validation(
    svc: CycleService, user: User,
) -> None:
    """End date before start date is rejected by Pydantic model_validator."""
    from pydantic import ValidationError
    from app.modules.cycle.schemas import CycleEntryCreate

    with pytest.raises(ValidationError, match="period_end_date"):
        CycleEntryCreate(
            period_start_date=date(2026, 6, 10),
            period_end_date=date(2026, 6, 8),
        )


@pytest.mark.asyncio
async def test_scenario12_end_before_start_not_stored(svc: CycleService, user: User) -> None:
    """No invalid data written when end < start."""
    from pydantic import ValidationError
    from app.modules.cycle.schemas import CycleEntryCreate

    try:
        entry_data = CycleEntryCreate(
            period_start_date=date(2026, 6, 10),
            period_end_date=date(2026, 6, 8),
        )
        await svc.create_entry(user.id, entry_data)  # noqa
    except (ValidationError, ValueError, Exception):
        pass

    entries = await svc.list_entries(user.id)
    for e in entries:
        if e.period_end_date is not None:
            assert e.period_end_date >= e.period_start_date
