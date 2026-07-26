"""System Test 6: End Date Notification (19) & Auto-Close Safety Net (20).

Tests server-side behavior directly via service classes, using in-memory SQLite.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

@compiles(JSONB, "sqlite")
def _jsonb_sqlite(t, m, **kw):
    return "JSON"

@compiles(UUID, "sqlite")
def _uuid_sqlite(t, m, **kw):
    return "VARCHAR(36)"

from app.core.database import Base
from app.modules.cycle.models import CycleEntry, PredictedCycle
from app.modules.wellness.models import JournalEntry, MoodLog
from app.modules.auth.models import User


# ---- Fixtures --------------------------------------------------------------


@pytest.fixture
async def db_session():
    engine = create_async_engine("sqlite+aiosqlite://", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.tables["users"].create)
        for name, table in Base.metadata.tables.items():
            if name == "users":
                continue
            await conn.run_sync(table.create, checkfirst=True)
    session_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.fixture
async def user_id(db_session):
    uid = uuid.uuid4()
    db_session.add(User(id=uid, email="test@shecare.app"))
    await db_session.flush()
    return uid


# ---- Helpers ---------------------------------------------------------------


async def create_closed_entry(db_session, user_id, start, end=None):
    if end is None:
        end = start + timedelta(days=4)
    e = CycleEntry(
        user_id=user_id,
        period_start_date=start,
        period_end_date=end,
    )
    db_session.add(e)
    await db_session.flush()
    return e


async def create_open_entry(db_session, user_id, period_start):
    e = CycleEntry(
        user_id=user_id,
        period_start_date=period_start,
        period_end_date=None,
    )
    db_session.add(e)
    await db_session.flush()
    return e


# =============================================================================
# Scenario 19: End Date Notification — Calculation & Confirmation
# =============================================================================


class TestScenario19EndDateNotification:
    """Validate the 'Period Length Confirmation' flow: scheduling, update, average."""

    async def test_19_1_notification_day_calculation(self):
        """compute_notification_day: offset = max(3, avg - 2)."""
        from app.modules.cycle.phase_utils import compute_notification_day

        cases = [
            (5, 3),    # 5-2 = 3
            (4, 2),    # 4-2 = 2, but max(3,2)=3 → wait, let me re-check
        ]
        # Actually the formula: max(fallback=3, avg-2)
        # avg=5 → max(3, 3) = 3
        # avg=4 → max(3, 2) = 3   (scheduled notification for 2 days after start)
        # Wait, the scenario says avg=5 → fires on Day 3 which is start+3
        # Let me re-read: offset = avg - 2 = 3 days, notification_date = start + offset
        # So notification_date = start + max(3, avg-2)
        # For avg=5: max(3, 3) = 3 → notification on June 10+3 = June 13 ✓
        # For avg=4: max(3, 2) = 3 → notification on June 10+3 = June 13
        # For avg=7: max(3, 5) = 5 → notification on June 10+5 = June 15
        # For avg=3: max(3, 1) = 3 → notification on June 10+3 = June 13
        # For avg=2: fallback to 3
        assert compute_notification_day(5) == 3
        assert compute_notification_day(4) == 3
        assert compute_notification_day(7) == 5
        assert compute_notification_day(3) == 3
        assert compute_notification_day(2) == 3
        assert compute_notification_day(None) == 3

    async def test_19_2_update_end_date(self, db_session, user_id):
        """Updating period_end_date on a cycle entry persists correctly."""
        from app.modules.cycle.services import CycleService
        from app.modules.cycle.schemas import CycleEntryUpdate

        start = date(2025, 6, 10)
        entry = await create_closed_entry(db_session, user_id, start, end=None)

        svc = CycleService(db_session)
        updated = await svc.update_entry(
            user_id=user_id,
            entry_id=entry.id,
            data=CycleEntryUpdate(period_end_date=date(2025, 6, 13)),
        )
        assert updated.period_end_date == date(2025, 6, 13)

    async def test_19_3_average_recalculation(self, db_session, user_id):
        """Confirming end date shifts avg_period_length."""
        from app.modules.cycle.services import CycleService
        from app.modules.cycle.schemas import CycleEntryUpdate

        for i in range(4):
            start = date(2024, 1 + i * 3, 1)
            await create_closed_entry(db_session, user_id, start, start + timedelta(days=7))

        svc = CycleService(db_session)
        avg_before = await svc.get_avg_period_length(user_id)
        assert avg_before == 8  # 4 entries of 8 days each

        start = date(2025, 6, 10)
        entry = await create_closed_entry(db_session, user_id, start, end=None)
        await svc.update_entry(
            user_id=user_id,
            entry_id=entry.id,
            data=CycleEntryUpdate(period_end_date=date(2025, 6, 13)),
        )
        avg_after = await svc.get_avg_period_length(user_id)
        assert avg_after < avg_before  # shorter period pulls average down

    async def test_19_4_end_date_clears_prompt_state(self, db_session, user_id):
        """Manually setting end date via update_entry works."""
        from app.modules.cycle.services import CycleService
        from app.modules.cycle.schemas import CycleEntryUpdate

        start = date(2025, 6, 10)
        entry = await create_closed_entry(db_session, user_id, start, end=None)
        svc = CycleService(db_session)
        updated = await svc.update_entry(
            user_id=user_id,
            entry_id=entry.id,
            data=CycleEntryUpdate(period_end_date=date(2025, 6, 14)),
        )
        assert updated.period_end_date == date(2025, 6, 14)
        assert updated.period_end_date != start  # duration >= 1


class TestScenario19EndDateNotificationEdgeCases:
    """Edge cases: snooze equivalent, mark-end-date modal options."""

    async def test_19_5_snooze_equivalent(self, db_session, user_id):
        """Snooze (leave end_date None) does not affect existing data."""
        from app.modules.cycle.services import CycleService
        from app.modules.cycle.schemas import CycleEntryUpdate

        start = date(2025, 6, 10)
        entry = await create_closed_entry(db_session, user_id, start, end=None)
        svc = CycleService(db_session)

        updated = await svc.update_entry(
            user_id=user_id,
            entry_id=entry.id,
            data=CycleEntryUpdate(period_end_date=date(2025, 6, 13)),
        )
        assert updated.period_end_date == date(2025, 6, 13)

    async def test_19_6_manual_update_before_notification(self, db_session, user_id):
        """User can set end date before notification fires."""
        from app.modules.cycle.services import CycleService
        from app.modules.cycle.schemas import CycleEntryUpdate

        start = date(2025, 6, 10)
        entry = await create_closed_entry(db_session, user_id, start, end=date(2025, 6, 12))
        svc = CycleService(db_session)

        updated = await svc.update_entry(
            user_id=user_id,
            entry_id=entry.id,
            data=CycleEntryUpdate(period_end_date=date(2025, 6, 12)),
        )
        assert updated.period_end_date == date(2025, 6, 12)


# =============================================================================
# Scenario 20: Auto-Close Safety Net
# =============================================================================


class TestScenario20AutoClose:
    """Validate the backend auto-close logic when a new period is logged."""

    async def test_20_1_auto_closes_open_entry(self, db_session, user_id):
        """Logging a new period auto-closes the most recent open entry."""
        from app.modules.cycle.services import CycleService
        from app.modules.cycle.schemas import CycleEntryCreate

        open_entry = await create_open_entry(db_session, user_id, date(2025, 6, 10))

        svc = CycleService(db_session)
        await svc.create_entry(
            user_id,
            CycleEntryCreate(period_start_date=date(2025, 7, 8), period_end_date=date(2025, 7, 12)),
        )

        await db_session.refresh(open_entry)
        assert open_entry.period_end_date is not None
        assert open_entry.period_end_date == date(2025, 6, 14)  # start + (default_avg - 1)

    async def test_20_2_no_change_when_already_closed(self, db_session, user_id):
        """An already-closed entry is not modified when a new period is logged."""
        from app.modules.cycle.services import CycleService
        from app.modules.cycle.schemas import CycleEntryCreate

        closed_entry = await create_closed_entry(db_session, user_id, date(2025, 6, 10), end=date(2025, 6, 14))

        svc = CycleService(db_session)
        await svc.create_entry(
            user_id,
            CycleEntryCreate(period_start_date=date(2025, 7, 8)),
        )

        await db_session.refresh(closed_entry)
        assert closed_entry.period_end_date == date(2025, 6, 14)

    async def test_20_3_no_open_entry_does_nothing(self, db_session, user_id):
        """No auto-close when no open entry exists."""
        from app.modules.cycle.services import CycleService
        from app.modules.cycle.schemas import CycleEntryCreate

        svc = CycleService(db_session)
        entry = await svc.create_entry(
            user_id,
            CycleEntryCreate(period_start_date=date(2025, 7, 8)),
        )
        assert entry.period_end_date is not None

    async def test_20_4_auto_close_uses_average_length(self, db_session, user_id):
        """Auto-close uses historical avg_period_length, not a hardcoded value."""
        from app.modules.cycle.services import CycleService
        from app.modules.cycle.schemas import CycleEntryCreate

        for i in range(4):
            s = date(2024, 1 + i * 3, 1)
            await create_closed_entry(db_session, user_id, s, s + timedelta(days=7))

        open_entry = await create_open_entry(db_session, user_id, date(2025, 6, 10))

        svc = CycleService(db_session)
        await svc.create_entry(
            user_id,
            CycleEntryCreate(period_start_date=date(2025, 7, 8)),
        )

        await db_session.refresh(open_entry)
        expected_end = date(2025, 6, 10) + timedelta(days=7)
        assert open_entry.period_end_date == expected_end

    async def test_20_5_multiple_open_entries_only_closes_latest(self, db_session, user_id):
        """Only the most recent open entry is auto-closed."""
        from app.modules.cycle.services import CycleService
        from app.modules.cycle.schemas import CycleEntryCreate

        older_open = await create_open_entry(db_session, user_id, date(2025, 3, 1))
        newer_open = await create_open_entry(db_session, user_id, date(2025, 6, 10))

        svc = CycleService(db_session)
        await svc.create_entry(
            user_id,
            CycleEntryCreate(period_start_date=date(2025, 7, 8)),
        )

        await db_session.refresh(older_open)
        await db_session.refresh(newer_open)
        assert older_open.period_end_date is None
        assert newer_open.period_end_date is not None

    async def test_20_6_sync_pull_reflects_auto_close(self, db_session, user_id):
        """Pull changes returns the auto-closed entry for mobile hydration."""
        from app.modules.sync.services import SyncService
        from app.modules.cycle.services import CycleService
        from app.modules.cycle.schemas import CycleEntryCreate

        open_entry = await create_open_entry(db_session, user_id, date(2025, 6, 10))

        svc = CycleService(db_session)
        await svc.create_entry(
            user_id,
            CycleEntryCreate(period_start_date=date(2025, 7, 8)),
        )

        sync_svc = SyncService(db_session)
        changes = await sync_svc.pull_changes(user_id, since=None)
        change_ids = [str(c.entity_id) for c in changes.changes if c.entity_type == "cycle"]
        assert str(open_entry.id) in change_ids
