"""System Test 16 — Scenario 51: Double Correction (Mistake → Fix).

Scenario 51: User corrects 15 -> 12 (mistake), then corrects 12 -> 14 (final).
Tests that FIFO + Client Timestamp Authority (LWW) ensures the final state wins,
mixed offline/online corrections, and stale late corrections are rejected.
"""

from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.database import Base

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")


@compiles(PG_UUID, "sqlite")
def _compile_uuid_sqlite(type_, compiler, **kw):
    return "VARCHAR(32)"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(type_, compiler, **kw):
    return "JSON"


def _import_all_models():
    import app.modules.auth.models  # noqa: F401
    import app.modules.cycle.models  # noqa: F401
    import app.modules.wellness.models  # noqa: F401
    import app.modules.safety.models  # noqa: F401
    import app.modules.pregnancy.models  # noqa: F401
    import app.modules.onboarding.models  # noqa: F401
    import app.modules.chat.models  # noqa: F401
    import app.modules.family.models  # noqa: F401
    import app.modules.nurse_content.models  # noqa: F401
    import app.modules.users.models  # noqa: F401
    import app.modules.admin.models  # noqa: F401


_import_all_models()

UID = "00000000-0000-0000-0000-000000000001"


@asynccontextmanager
async def _noop_lifespan(app):
    yield


@pytest_asyncio.fixture
async def clean_session():
    engine = create_async_engine("sqlite+aiosqlite:///file::memory:?cache=shared&uri=true", echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        await session.run_sync(lambda s: Base.metadata.create_all(s.connection()))
        yield session
    await engine.dispose()


def _hex(uid_str: str) -> str:
    return uuid.UUID(uid_str).hex


async def _insert_user(session, uid: str, email: str):
    await session.execute(
        text("""
            INSERT INTO users (id, email, role, provider, is_verified, failed_login_attempts,
                               mfa_enabled, fcm_tokens, avg_prediction_error_days,
                               total_cycles_logged, is_dirty_for_retraining, is_active,
                               user_secret_key)
            VALUES (:id, :email, :role, :provider, :is_verified, :failed_login_attempts,
                    :mfa_enabled, :fcm_tokens, :avg_prediction_error_days,
                    :total_cycles_logged, :is_dirty_for_retraining, :is_active,
                    :user_secret_key)
        """),
        {
            "id": _hex(uid), "email": email,
            "role": "user", "provider": "local", "is_verified": 0,
            "failed_login_attempts": 0, "mfa_enabled": 0, "fcm_tokens": "[]",
            "avg_prediction_error_days": 0, "total_cycles_logged": 0,
            "is_dirty_for_retraining": 1, "is_active": 1,
            "user_secret_key": "test-secret",
        },
    )


def _real_uid(uid_str: str = UID) -> uuid.UUID:
    return uuid.UUID(uid_str)


def _future_ts(seconds_ahead: int = 240) -> datetime:
    """Return a UTC datetime that is seconds_ahead from now, within the 5-min clamp limit."""
    return datetime.now(UTC) + timedelta(seconds=seconds_ahead)


def _past_ts(hours_ago: int = 1) -> datetime:
    return datetime.now(UTC) - timedelta(hours=hours_ago)


# =============================================================================
# Scenario 51: Double Correction (Mistake → Correction → Final)
# =============================================================================


class TestScenario51DoubleCorrection:

    async def test_51_1_fifo_both_corrections_in_batch_latest_timestamp_wins(self, clean_session):
        """
        Two cycle/update ops in one push_batch: both have client_ts > server_updated_at
        (which was set at creation). The final period_start_date is '2025-06-14'.
        """
        session = clean_session
        await _insert_user(session, UID, "double-fix@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)

        create_op = SyncOperation(
            type="cycle/create",
            data={"period_start_date": "2025-06-15", "period_end_date": "2025-06-19", "symptoms": ["cramps"]},
            temp_id="t51-create",
            idempotency_key="ik-51-create",
            client_updated_at=None,
        )
        create_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        assert create_result.results[0].status in ("created", "updated")
        entity_id = create_result.results[0].entity_id

        t_mistake = _future_ts(30)
        t_fix = _future_ts(60)

        op1 = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "period_start_date": "2025-06-12", "symptoms": ["cramps"]},
            temp_id="t51-mistake",
            idempotency_key="ik-51-mistake",
            client_updated_at=t_mistake,
        )
        op2 = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "period_start_date": "2025-06-14", "symptoms": ["cramps"]},
            temp_id="t51-fix",
            idempotency_key="ik-51-fix",
            client_updated_at=t_fix,
        )

        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[op1, op2]))

        assert len(result.results) == 2
        assert result.results[0].status in ("created", "updated")
        assert result.results[1].status in ("created", "updated")
        assert result.results[0].entity_id == entity_id
        assert result.results[1].entity_id == entity_id

        row = (await session.execute(
            text("SELECT period_start_date, updated_at FROM cycle_entries WHERE id = :id"),
            {"id": _hex(entity_id)},
        )).fetchone()
        assert row is not None
        assert row[0] == "2025-06-14"
        assert row[1] is not None

        count = (await session.execute(
            text("SELECT count(*) FROM cycle_entries WHERE user_id = :uid"),
            {"uid": _hex(UID)},
        )).scalar()
        assert count == 1

    async def test_51_2_offline_mistake_then_online_correction_final_wins(self, clean_session):
        """
        Correction 1 offline push (mistake), Correction 2 online push (fix) — later
        in a separate batch. The fix has a later client_ts and wins.
        """
        session = clean_session
        await _insert_user(session, UID, "mix-fix@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)

        create_op = SyncOperation(
            type="cycle/create",
            data={"period_start_date": "2025-06-15", "period_end_date": "2025-06-19"},
            temp_id="t51-mix-create",
            idempotency_key="ik-51-mix-create",
            client_updated_at=None,
        )
        create_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        assert create_result.results[0].status in ("created", "updated")
        entity_id = create_result.results[0].entity_id

        t_mistake = _future_ts(30)
        op1 = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "period_start_date": "2025-06-12"},
            temp_id="t51-mix-mistake",
            idempotency_key="ik-51-mix-mistake",
            client_updated_at=t_mistake,
        )
        result1 = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[op1]))
        assert result1.results[0].status in ("created", "updated")

        t_fix = _future_ts(90)
        op2 = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "period_start_date": "2025-06-14"},
            temp_id="t51-mix-fix",
            idempotency_key="ik-51-mix-fix",
            client_updated_at=t_fix,
        )
        result2 = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[op2]))
        assert result2.results[0].status in ("created", "updated")

        row = (await session.execute(
            text("SELECT period_start_date FROM cycle_entries WHERE id = :id"),
            {"id": _hex(entity_id)},
        )).fetchone()
        assert row is not None
        assert row[0] == "2025-06-14"

        count = (await session.execute(
            text("SELECT count(*) FROM cycle_entries WHERE user_id = :uid"),
            {"uid": _hex(UID)},
        )).scalar()
        assert count == 1

    async def test_51_3_stale_offline_correction_after_online_fix_is_rejected(self, clean_session):
        """
        User fixes online (14) with a future client_ts, then a stale offline correction
        (12) with a past client_ts arrives. The stale must be rejected (conflict).
        """
        session = clean_session
        await _insert_user(session, UID, "stale-reject@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)

        create_op = SyncOperation(
            type="cycle/create",
            data={"period_start_date": "2025-06-15", "period_end_date": "2025-06-19"},
            temp_id="t51-stale-create",
            idempotency_key="ik-51-stale-create",
            client_updated_at=None,
        )
        create_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        assert create_result.results[0].status in ("created", "updated")
        entity_id = create_result.results[0].entity_id

        online_fix = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "period_start_date": "2025-06-14"},
            temp_id="t51-stale-fix",
            idempotency_key="ik-51-stale-fix",
            client_updated_at=_future_ts(30),
        )
        result_fix = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[online_fix]))
        assert result_fix.results[0].status in ("created", "updated")

        stale_op = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "period_start_date": "2025-06-12"},
            temp_id="t51-stale-late",
            idempotency_key="ik-51-stale-late",
            client_updated_at=_past_ts(1),
        )
        stale_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[stale_op]))

        assert stale_result.results[0].status == "conflict"
        assert stale_result.results[0].server_data is not None
        assert stale_result.results[0].server_data.get("period_start_date") == "2025-06-14"

        row = (await session.execute(
            text("SELECT period_start_date FROM cycle_entries WHERE id = :id"),
            {"id": _hex(entity_id)},
        )).fetchone()
        assert row is not None
        assert row[0] == "2025-06-14"

        count = (await session.execute(
            text("SELECT count(*) FROM cycle_entries WHERE user_id = :uid"),
            {"uid": _hex(UID)},
        )).scalar()
        assert count == 1
