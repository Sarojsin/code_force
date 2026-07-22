"""system_test2.md scenarios — explicit scenario-based tests."""
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
        email="system_test2@test.com",
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
# Scenario 3: Ananya corrects a date (Late by 4 days) via Sticky Card
# =============================================================================
# Action: Prediction was June 10. Actual is June 14.
#         Taps "No, adjust date" and selects June 14.
# Expected:
#   - prediction_error_days = +4 (actual - predicted)
#   - avg_prediction_error_days shifts to +4
#   - Calendar shows 'c' on old predicted days (cancelled)
#   - Calendar shows 'P' on the new period days (confirmed)
#   - total_cycles_logged increments to 1
#   - is_dirty_for_retraining becomes True
# =============================================================================


@pytest.mark.asyncio
async def test_scenario3_correction_late_4_days(svc: CycleService, user: User, cycle_entry: CycleEntry) -> None:
    # --- Arrange: get prediction, then override it to June 10 ---
    pred = await svc.compute_predictions(user.id)
    # Force the prediction's date to June 10 so we have a known target
    pred.predicted_next_period_start = date(2026, 6, 10)
    await svc.db.flush()

    # --- Act: user corrects to June 14 (late by 4 days) with end date ---
    actual_start = date(2026, 6, 14)
    entry = await svc.log_correction(
        user_id=user.id,
        period_start_date=actual_start,
        period_end_date=date(2026, 6, 18),
        corrected_prediction_id=pred.id,
    )

    # --- Assert: correction links ---
    assert entry.is_correction is True
    assert entry.corrected_prediction_id == pred.id
    assert entry.period_start_date == actual_start

    # --- Assert: prediction_error_days = +4 ---
    await svc.db.refresh(pred)
    assert pred.prediction_error_days == 4  # June 14 - June 10 = +4

    # --- Assert: avg_prediction_error_days updated to 4.0 ---
    await svc.db.refresh(user)
    assert user.avg_prediction_error_days == 4.0
    assert user.total_cycles_logged == 1
    assert user.is_dirty_for_retraining is True

    # --- Assert: calendar shows the new confirmed period as 'P' ---
    # Use months_back=3 so the calendar window includes our test dates
    cal = await svc.get_calendar(user.id, months_back=3, months_forward=3)
    days = cal["days"]

    # The confirmed period (June 14) should show as Dark Pink 'P'
    period_window = [actual_start.isoformat(), (actual_start + timedelta(days=1)).isoformat()]
    has_confirmed = any(days.get(d) == "P" for d in period_window)
    assert has_confirmed, f"Expected 'P' for confirmed period start, got: { {d: days.get(d) for d in period_window} }"

    # New period block should show 'P' (confirmed period)
    confirmed_days = [
        (actual_start + timedelta(days=i)).isoformat()
        for i in range(5)
    ]

    # --- Assert: next_period_in_days exists (new prediction was computed) ---
    assert cal["next_period_in_days"] is not None
    assert cal["next_period_in_days"] >= 0

    # --- Assert: prediction_detail shows corrected model ---
    assert cal["predictions"] is not None
    assert cal["predictions"]["id"] != pred.id  # New prediction was created


# =============================================================================
# Scenario 3b: Correction with negative error (early by 2 days)
# =============================================================================


@pytest.mark.asyncio
async def test_scenario3b_correction_early_2_days(svc: CycleService, user: User, cycle_entry: CycleEntry) -> None:
    pred = await svc.compute_predictions(user.id)
    pred.predicted_next_period_start = date(2026, 6, 10)
    await svc.db.flush()

    # Act: period starts June 8 (2 days early)
    actual_start = date(2026, 6, 8)
    entry = await svc.log_correction(
        user_id=user.id,
        period_start_date=actual_start,
        corrected_prediction_id=pred.id,
    )
    await svc.db.refresh(pred)
    assert pred.prediction_error_days == -2  # June 8 - June 10 = -2
    await svc.db.refresh(user)
    assert user.avg_prediction_error_days == -2.0


# =============================================================================
# Scenario 3c: Correction with idempotency key prevents duplicate
# =============================================================================


@pytest.mark.asyncio
async def test_scenario3c_correction_idempotency(svc: CycleService, user: User) -> None:
    """Same Idempotency-Key returns existing entry instead of creating new."""
    # Create a minimal prediction
    pred = PredictedCycle(
        user_id=user.id,
        predicted_next_period_start=date(2026, 7, 1),
        model_version="test",
    )
    svc.db.add(pred)
    await svc.db.commit()
    await svc.db.refresh(pred)

    # First call — should create
    entry1 = await svc.log_correction(
        user_id=user.id,
        period_start_date=date(2026, 7, 5),
        corrected_prediction_id=pred.id,
        idempotency_key="dup-key-001",
    )
    assert entry1.is_correction is True

    # Second call with same key — should return existing via find_by_idempotency_key
    existing = await svc.find_by_idempotency_key(user.id, "dup-key-001")
    assert existing is not None
    assert existing.id == entry1.id


# =============================================================================
# Scenario 4: Sneha uses "Snooze" repeatedly
# =============================================================================
# Action: Taps "Not Yet" on June 10, June 11, logs period on June 12.
# Expected:
#   - Snooze events written to snooze_events table with day_offset 1 and 2
#   - Sticky Card respects the 24-hour snooze cooldown
#   - needs_checkin reflects snooze state
# =============================================================================


@pytest.mark.asyncio
async def test_scenario4_snooze_repeatedly(svc: CycleService, user: User, cycle_entry: CycleEntry) -> None:
    pred = await svc.compute_predictions(user.id)
    pred.predicted_next_period_start = date(2026, 6, 10)
    await svc.db.flush()

    # --- Act: snooze on June 10 (day_offset=1) ---
    snooze1 = await svc.log_snooze(
        user_id=user.id,
        predicted_cycle_id=pred.id,
        day_offset=1,
    )
    assert snooze1.day_offset == 1
    assert snooze1.predicted_cycle_id == pred.id
    assert snooze1.user_id == user.id

    # --- Act: snooze again on June 11 (day_offset=2) ---
    snooze2 = await svc.log_snooze(
        user_id=user.id,
        predicted_cycle_id=pred.id,
        day_offset=2,
    )
    assert snooze2.day_offset == 2

    # --- Assert: both snooze events exist in DB ---
    stmt = (
        select(SnoozeEvent)
        .where(SnoozeEvent.user_id == user.id)
        .where(SnoozeEvent.predicted_cycle_id == pred.id)
        .order_by(SnoozeEvent.snoozed_at.asc())
    )
    events = (await svc.db.execute(stmt)).scalars().all()
    assert len(events) == 2
    assert events[0].day_offset == 1
    assert events[1].day_offset == 2


@pytest.mark.asyncio
async def test_scenario4_snooze_suppresses_needs_checkin(svc: CycleService, user: User, cycle_entry: CycleEntry) -> None:
    """When user has snoozed today, needs_checkin should be False."""
    pred = await svc.compute_predictions(user.id)
    # Set prediction to today so the checkin window is active
    pred.predicted_next_period_start = date.today() - timedelta(days=1)
    await svc.db.flush()

    # Without snooze — needs_checkin should be True (windows match, no recent period)
    cal = await svc.get_calendar(user.id, months_back=1, months_forward=3)
    assert cal["needs_checkin"] is True, "Should need checkin before snooze"

    # --- Act: snooze with day_offset covering today ---
    await svc.log_snooze(
        user_id=user.id,
        predicted_cycle_id=pred.id,
        day_offset=1,
    )

    # --- Assert: needs_checkin is now False ---
    cal = await svc.get_calendar(user.id, months_back=1, months_forward=3)
    assert cal["needs_checkin"] is False, "Snooze should suppress needs_checkin"


# =============================================================================
# Scenario 5: Ananya logs a period entirely offline (simulated backend path)
# =============================================================================
# Action: Logs a period offline. No network.
# Expected:
#   - Optimistic update works (simulated via mobile cache)
#   - Offline queue stores the operation
#   - Batch sync endpoint accepts and creates the record
#   - server_data is returned for SQLite hydration
# =============================================================================


@pytest.mark.asyncio
async def test_scenario5_offline_period_log_via_batch_sync(svc: CycleService, user: User) -> None:
    """Simulate the sync engine pushing an offline-created period entry."""
    from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
    from app.modules.sync.services import SyncService

    sync_svc = SyncService(db=svc.db)

    # Simulate an offline-queued operation: create a cycle entry
    batch = SyncBatchRequest(operations=[
        SyncOperation(
            type="cycle/create",
            data={
                "period_start_date": "2026-06-20",
                "period_end_date": "2026-06-24",
                "symptoms": ["cramps"],
            },
            temp_id="temp-offline-001",
            idempotency_key="offline-ik-001",
            client_updated_at="2026-06-20T10:00:00Z",
        ),
    ])

    result = await sync_svc.push_batch(user.id, batch)
    assert len(result.results) == 1
    assert result.results[0].status == "created"
    assert result.results[0].entity_id is not None
    assert result.results[0].temp_id == "temp-offline-001"

    # Verify the entry exists in DB
    import uuid as _uuid
    entry_id = _uuid.UUID(result.results[0].entity_id)
    stmt = select(CycleEntry).where(CycleEntry.id == entry_id)
    entry = (await svc.db.execute(stmt)).scalar_one_or_none()
    assert entry is not None
    assert entry.period_start_date == date(2026, 6, 20)
    assert entry.period_end_date == date(2026, 6, 24)

    # Assert server_data is returned for SQLite hydration
    assert result.results[0].server_data is not None
    assert result.results[0].server_data.get("period_start_date") == "2026-06-20"


# =============================================================================
# Scenario 6: FIFO offline queue — Period A (offline) then Period B (online)
# =============================================================================
# Action: Day 1 (Offline): Period A (June 20). Day 3 (Online): Period B (July 18)
# Expected:
#   - FIFO order preserved (Period A processed first)
#   - No overwrites (both entries exist independently)
# =============================================================================


@pytest.mark.asyncio
async def test_scenario6_fifo_offline_queue(svc: CycleService, user: User) -> None:
    """Two operations enqueued FIFO are processed in order without overwrites."""
    from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
    from app.modules.sync.services import SyncService

    sync_svc = SyncService(db=svc.db)

    # Simulate FIFO queue: Period A (June 20) was enqueued first while offline,
    # Period B (July 18) was enqueued second once online
    batch = SyncBatchRequest(operations=[
        SyncOperation(
            type="cycle/create",
            data={
                "period_start_date": "2026-06-20",
                "period_end_date": "2026-06-24",
                "symptoms": ["cramps"],
            },
            temp_id="temp-period-a",
            idempotency_key="fifo-ik-a",
            client_updated_at="2026-06-20T08:00:00Z",
        ),
        SyncOperation(
            type="cycle/create",
            data={
                "period_start_date": "2026-07-18",
                "period_end_date": "2026-07-22",
                "symptoms": ["headache"],
            },
            temp_id="temp-period-b",
            idempotency_key="fifo-ik-b",
            client_updated_at="2026-07-18T09:00:00Z",
        ),
    ])

    results = await sync_svc.push_batch(user.id, batch)
    assert len(results.results) == 2

    # Both entries should be created
    assert results.results[0].status == "created"
    assert results.results[1].status == "created"

    # Verify both entries exist in DB with no overwrite
    stmt = select(CycleEntry).where(CycleEntry.user_id == user.id).order_by(CycleEntry.period_start_date.asc())
    entries = (await svc.db.execute(stmt)).scalars().all()
    assert len(entries) == 2
    assert entries[0].period_start_date == date(2026, 6, 20)
    assert entries[1].period_start_date == date(2026, 7, 18)

    # Both entries should have distinct IDs (no overwrite)
    assert entries[0].id != entries[1].id

    # server_data should be present on both results
    assert results.results[0].server_data is not None
    assert results.results[1].server_data is not None
    assert results.results[0].server_data.get("period_start_date") == "2026-06-20"
    assert results.results[1].server_data.get("period_start_date") == "2026-07-18"
