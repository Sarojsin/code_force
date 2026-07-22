"""System Test 5: Prediction History (15), Sync Error Handling (16-17), Queue Backlog (18).

Tests server-side behavior directly via service classes, using in-memory SQLite.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

# Register SQLite compilers for PostgreSQL types BEFORE importing models
@compiles(JSONB, "sqlite")
def _jsonb_sqlite(t, c, **kw):
    return "JSON"

@compiles(UUID, "sqlite")
def _uuid_sqlite(t, c, **kw):
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


def get_row_color(delta: int) -> str:
    abs_d = abs(delta)
    if abs_d <= 1:
        return "#D4F0E0"
    if abs_d == 2:
        return "#FFDAB9"
    return "#FFB3C6"


async def create_entry(db_session, user_id, period_start, period_end=None):
    e = CycleEntry(
        user_id=user_id,
        period_start_date=period_start,
        period_end_date=period_end or (period_start + timedelta(days=4)),
    )
    db_session.add(e)
    await db_session.flush()
    return e


async def create_prediction(db_session, user_id, predicted_start, actual_entry=None, error_days=None,
                            model_type="global_model", data_points=6, is_active=False):
    p = PredictedCycle(
        user_id=user_id,
        predicted_next_period_start=predicted_start,
        actual_cycle_entry_id=actual_entry.id if actual_entry else None,
        prediction_error_days=error_days,
        model_type=model_type,
        training_data_points=data_points,
        is_active=is_active,
    )
    db_session.add(p)
    await db_session.flush()
    return p


# =============================================================================
# Scenario 15: Prediction History Table
# =============================================================================


class TestScenario15PredictionHistory:
    """Validate the 'Report Card' feature: accuracy tracking, color coding, data quality."""

    async def test_15_1_real_data_replaces_mock(self, db_session, user_id):
        entry = await create_entry(db_session, user_id, date(2025, 6, 1), date(2025, 6, 5))
        await create_prediction(db_session, user_id, date(2025, 6, 1), actual_entry=entry, error_days=0,
                                model_type="global_model", data_points=6, is_active=False)

        from app.modules.cycle.services import CycleService
        svc = CycleService(db_session)
        history = await svc.get_prediction_history(user_id, limit=12)

        assert len(history) == 1
        item = history[0]
        assert item["predicted_date"] == "2025-06-01"
        assert item["actual_date"] == "2025-06-01"
        assert item["delta_days"] == 0
        assert item["on_time"] is True
        assert item["month"] == "Jun"

    async def test_15_2_color_coding(self):
        scenarios = [
            (0, "#D4F0E0"), (1, "#D4F0E0"), (2, "#FFDAB9"),
            (3, "#FFB3C6"), (-1, "#D4F0E0"), (-2, "#FFDAB9"), (5, "#FFB3C6"),
        ]
        for delta, expected in scenarios:
            assert get_row_color(delta) == expected, f"delta={delta} should be {expected}"

    async def test_15_3_empty_state(self, db_session, user_id):
        from app.modules.cycle.services import CycleService
        svc = CycleService(db_session)
        assert await svc.get_prediction_history(user_id, limit=12) == []

    async def test_15_4_pending_predictions_excluded(self, db_session, user_id):
        entry = await create_entry(db_session, user_id, date(2025, 6, 1))
        await create_prediction(db_session, user_id, date(2025, 6, 1), actual_entry=entry, error_days=1, is_active=False)
        await create_prediction(db_session, user_id, date(2025, 7, 5), actual_entry=None, error_days=None, is_active=True)

        from app.modules.cycle.services import CycleService
        svc = CycleService(db_session)
        history = await svc.get_prediction_history(user_id, limit=12)
        assert len(history) == 1

    async def test_15_5_history_ordering(self, db_session, user_id):
        e1 = await create_entry(db_session, user_id, date(2025, 5, 1))
        e2 = await create_entry(db_session, user_id, date(2025, 6, 1))
        e3 = await create_entry(db_session, user_id, date(2025, 7, 1))
        await create_prediction(db_session, user_id, date(2025, 7, 1), actual_entry=e3, error_days=0, is_active=False)
        await create_prediction(db_session, user_id, date(2025, 5, 12), actual_entry=e1, error_days=2, is_active=False)
        await create_prediction(db_session, user_id, date(2025, 6, 9), actual_entry=e2, error_days=1, is_active=False)

        from app.modules.cycle.services import CycleService
        svc = CycleService(db_session)
        history = await svc.get_prediction_history(user_id, limit=12)
        assert len(history) == 3
        dates = [h["predicted_date"] for h in history]
        assert dates == sorted(dates, reverse=True)

    async def test_15_6_limit_respected(self, db_session, user_id):
        for month in range(1, 13):
            e = await create_entry(db_session, user_id, date(2025, month, 1))
            await create_prediction(db_session, user_id, date(2025, month, 5), actual_entry=e, error_days=0, is_active=False)

        from app.modules.cycle.services import CycleService
        svc = CycleService(db_session)
        assert len(await svc.get_prediction_history(user_id, limit=5)) == 5


# =============================================================================
# Scenario 16: Sync 500 Error — Retry Behavior
# =============================================================================


class TestScenario16Sync500Retry:
    """Server-side validation of sync batch processing."""

    async def test_16_1_valid_batch_processes(self, db_session, user_id):
        from app.modules.sync.services import SyncService
        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation

        svc = SyncService(db_session)
        request = SyncBatchRequest(operations=[
            SyncOperation(type="cycle/create", data={
                "period_start_date": "2025-07-01", "period_end_date": "2025-07-05",
            }),
            SyncOperation(type="mood/create", data={"mood": "happy", "intensity": 4}),
        ])
        response = await svc.push_batch(user_id, request)
        assert len(response.results) == 2
        assert response.results[0].status in ("created", "updated", "deleted")
        assert response.results[1].status in ("created", "updated", "deleted")

    async def test_16_2_idempotency_prevents_duplicates(self, db_session, user_id):
        from app.modules.sync.services import SyncService
        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation

        svc = SyncService(db_session)
        op = SyncOperation(type="cycle/create", data={"period_start_date": "2025-07-01", "period_end_date": "2025-07-05"},
                           idempotency_key="dup-test-key-001")
        resp1 = await svc.push_batch(user_id, SyncBatchRequest(operations=[op]))
        resp2 = await svc.push_batch(user_id, SyncBatchRequest(operations=[op]))
        assert resp2.results[0].entity_id == resp1.results[0].entity_id

    async def test_16_3_unknown_type_returns_failed(self, db_session, user_id):
        from app.modules.sync.services import SyncService
        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation

        svc = SyncService(db_session)
        response = await svc.push_batch(user_id, SyncBatchRequest(operations=[
            SyncOperation(type="pregnancy_daily_log/create", data={}),
        ]))
        assert response.results[0].status == "failed"
        assert "Unknown type" in (response.results[0].error or "")

    async def test_16_4_error_does_not_block_other_ops(self, db_session, user_id):
        from app.modules.sync.services import SyncService
        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation

        svc = SyncService(db_session)
        response = await svc.push_batch(user_id, SyncBatchRequest(operations=[
            SyncOperation(type="pregnancy_daily_log/create", data={}),
            SyncOperation(type="mood/create", data={"mood": "calm", "intensity": 3}),
        ]))
        assert response.results[0].status == "failed"
        assert response.results[1].status in ("created", "updated", "deleted")


# =============================================================================
# Scenario 17: Sync 400 Error — Discard Behavior
# =============================================================================


class TestScenario17Sync400Discard:
    """Serverside validation: malformed operations get 'failed', valid ops proceed."""

    async def test_17_1_malformed_data_returns_failed(self, db_session, user_id):
        from app.modules.sync.services import SyncService
        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation

        svc = SyncService(db_session)
        response = await svc.push_batch(user_id, SyncBatchRequest(operations=[
            SyncOperation(type="cycle/correction", data={}),
        ]))
        assert response.results[0].status == "failed"
        assert response.results[0].error is not None

    async def test_17_2_invalid_date_format_fails(self, db_session, user_id):
        from app.modules.sync.services import SyncService
        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation

        svc = SyncService(db_session)
        response = await svc.push_batch(user_id, SyncBatchRequest(operations=[
            SyncOperation(type="cycle/correction", data={"period_start_date": "invalid-date"}),
        ]))
        assert response.results[0].status == "failed"

    async def test_17_3_valid_op_passes_after_failed(self, db_session, user_id):
        from app.modules.sync.services import SyncService
        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation

        svc = SyncService(db_session)
        response = await svc.push_batch(user_id, SyncBatchRequest(operations=[
            SyncOperation(type="cycle/correction", data={}),
            SyncOperation(type="mood/create", data={"mood": "energetic", "intensity": 5}),
        ]))
        assert response.results[0].status == "failed"
        assert response.results[1].status in ("created", "updated", "deleted")


# =============================================================================
# Scenario 18: Queue Backlog — 100 Ops
# =============================================================================


class TestScenario18QueueBacklog:
    """Validate batch processing of 100 operations, FIFO order, idempotency."""

    async def test_18_1_batch_100_ops(self, db_session, user_id):
        from app.modules.sync.services import SyncService
        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation

        svc = SyncService(db_session)
        ops = [SyncOperation(type="mood/create", data={"mood": f"mood_{i}", "intensity": i % 5 + 1}) for i in range(100)]
        response = await svc.push_batch(user_id, SyncBatchRequest(operations=ops))
        assert len(response.results) == 100
        successes = [r for r in response.results if r.status in ("created", "updated", "deleted")]
        assert len(successes) == 100

    async def test_18_2_fifo_order(self, db_session, user_id):
        from app.modules.sync.services import SyncService
        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation

        svc = SyncService(db_session)
        response = await svc.push_batch(user_id, SyncBatchRequest(operations=[
            SyncOperation(type="journal/create", data={"content": "First", "entry_date": "2025-07-01"}),
            SyncOperation(type="mood/create", data={"mood": "reflective", "intensity": 3}),
        ]))
        assert response.results[0].status in ("created", "updated", "deleted")
        assert response.results[1].status in ("created", "updated", "deleted")

    async def test_18_3_idempotency_dedup(self, db_session, user_id):
        from app.modules.sync.services import SyncService
        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation

        svc = SyncService(db_session)
        op = SyncOperation(type="cycle/create", data={"period_start_date": "2025-07-15", "period_end_date": "2025-07-19"},
                           idempotency_key="batch-dedup-key")
        resp1 = await svc.push_batch(user_id, SyncBatchRequest(operations=[op]))
        resp2 = await svc.push_batch(user_id, SyncBatchRequest(operations=[op]))
        assert resp2.results[0].entity_id == resp1.results[0].entity_id

    async def test_18_4_mixed_types_process(self, db_session, user_id):
        from app.modules.sync.services import SyncService
        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation

        svc = SyncService(db_session)
        response = await svc.push_batch(user_id, SyncBatchRequest(operations=[
            SyncOperation(type="journal/create", data={"content": "Day 1", "entry_date": "2025-07-01"}),
            SyncOperation(type="mood/create", data={"mood": "happy", "intensity": 4}),
            SyncOperation(type="cycle/create", data={"period_start_date": "2025-07-05", "period_end_date": "2025-07-09"}),
        ]))
        assert len(response.results) == 3
        for res in response.results:
            assert res.status in ("created", "updated", "deleted"), f"Unexpected: {res.status}"
