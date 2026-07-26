"""System Test 15 — Network Flapping (46), Rapid Fire Tapping (47),
Slow Network Abort (48), Desync (49), DST/Midnight Rollover (50).

Scenario 46: Network Flapping — Rapid offline/online toggle.
  Tests idempotency dedup when server processed request but client never
  received response (zombie response pattern).

Scenario 47: Rapid Fire Tapping — Double-tap mutation.
  Tests that identical mutations with same idempotency_key produce exactly
  one row; idempotency is the server-side safety net.

Scenario 48: Slow Network / Abort (mobile-only) — skipped.

Scenario 49: Desync — SQLite vs Backend Timestamp Conflict.
  Tests server-side conflict detection when server_updated_at > client_ts,
  client wins when newer, and future timestamp clamping.

Scenario 50: DST/Midnight Rollover.
  Tests that dates are stored as YYYY-MM-DD ISO strings without time
  component, and returned as-is regardless of timezone.
"""

from __future__ import annotations

import json
import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import uuid
from datetime import UTC, datetime, date, timedelta
from contextlib import asynccontextmanager

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.database import Base
from app.core.event_bus import event_bus


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
            "is_dirty_for_retraining": 0, "is_active": 1,
            "user_secret_key": "test-secret",
        },
    )


def _real_uid(uid_str: str = UID) -> uuid.UUID:
    return uuid.UUID(uid_str)


# =============================================================================
# Scenario 46: Network Flapping — Idempotency Retry After Interrupted Push
# =============================================================================


class TestScenario46NetworkFlapping:

    async def test_46_1_zombie_response_idempotency_returns_cached(self, clean_session):
        """Server processed request but client never received 200 → retry with
        same idempotency_key returns cached result, no duplicate row."""
        session = clean_session
        await _insert_user(session, UID, "flapping@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        ik = "ik-46-zombie"
        op = SyncOperation(
            type="journal/create",
            data={"content": "zombie response test", "entry_date": "2025-08-01"},
            temp_id="t46-zombie", idempotency_key=ik,
            client_updated_at=datetime(2099, 8, 1, tzinfo=UTC),
        )
        payload = SyncBatchRequest(operations=[op])

        first = await svc.push_batch(_real_uid(), payload)
        assert first.results[0].status in ("created", "updated")
        first_id = first.results[0].entity_id

        rows_before = (await session.execute(
            text("SELECT count(*) FROM journal_entries"),
        )).scalar()
        assert rows_before == 1

        second = await svc.push_batch(_real_uid(), payload)
        assert second.results[0].entity_id == first_id
        assert second.results[0].server_data is not None

        rows_after = (await session.execute(
            text("SELECT count(*) FROM journal_entries"),
        )).scalar()
        assert rows_after == 1, "Zombie retry created duplicate row"

    async def test_46_2_flapping_retry_chain_preserves_data(self, clean_session):
        """Multiple retries of the same idempotency_key all return same entity."""
        session = clean_session
        await _insert_user(session, UID, "flapping-chain@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        ik = "ik-46-chain"
        op = SyncOperation(
            type="mood/create",
            data={"mood": "anxious", "intensity": 4},
            temp_id="t46-chain", idempotency_key=ik,
            client_updated_at=datetime(2099, 8, 2, tzinfo=UTC),
        )
        payload = SyncBatchRequest(operations=[op])

        first = await svc.push_batch(_real_uid(), payload)
        first_id = first.results[0].entity_id

        for i in range(3):
            retry = await svc.push_batch(_real_uid(), payload)
            assert retry.results[0].entity_id == first_id, f"Retry {i} returned different entity_id"
            assert retry.results[0].server_data is not None

        rows = (await session.execute(
            text("SELECT count(*) FROM mood_logs"),
        )).scalar()
        assert rows == 1, "Retry chain created duplicate rows"

    async def test_46_3_concurrent_ops_with_different_keys_all_succeed(self, clean_session):
        """During flapping, multiple unique operations all get processed."""
        session = clean_session
        await _insert_user(session, UID, "flapping-multi@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        ops = [
            SyncOperation(
                type="journal/create",
                data={"content": f"flap {i}", "entry_date": "2025-08-10"},
                temp_id=f"t46-{i}", idempotency_key=f"ik-46-{i}",
                client_updated_at=datetime(2099, 8, 10, tzinfo=UTC),
            )
            for i in range(5)
        ]
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=ops))
        assert len(result.results) == 5
        for r in result.results:
            assert r.status in ("created", "updated")

        rows = (await session.execute(
            text("SELECT count(*) FROM journal_entries"),
        )).scalar()
        assert rows == 5


# =============================================================================
# Scenario 47: Rapid Fire Tapping — Double-tap Mutation Dedup
# =============================================================================


class TestScenario47RapidFireTapping:

    async def test_47_1_idempotency_prevents_duplicate_from_double_tap(self, clean_session):
        """Two identical mutation calls with same idempotency_key → single row."""
        session = clean_session
        await _insert_user(session, UID, "doubletap@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        ik = "ik-47-doubletap"
        op = SyncOperation(
            type="cycle/create",
            data={"period_start_date": "2025-09-01", "period_end_date": "2025-09-05"},
            temp_id="t47-dt", idempotency_key=ik,
            client_updated_at=datetime(2099, 9, 1, tzinfo=UTC),
        )
        payload = SyncBatchRequest(operations=[op])

        first = await svc.push_batch(_real_uid(), payload)
        first_id = first.results[0].entity_id

        second = await svc.push_batch(_real_uid(), payload)
        assert second.results[0].entity_id == first_id

        rows = (await session.execute(
            text("SELECT count(*) FROM cycle_entries"),
        )).scalar()
        assert rows == 1

    async def test_47_2_different_idempotency_keys_allow_distinct_entries(self, clean_session):
        """Second tap with different key (no UI disable) creates two rows."""
        session = clean_session
        await _insert_user(session, UID, "doubletap-two@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        ops = [
            SyncOperation(
                type="journal/create",
                data={"content": "rapid tap", "entry_date": "2025-09-10"},
                temp_id="t47-a", idempotency_key="ik-47-a",
                client_updated_at=datetime(2099, 9, 10, tzinfo=UTC),
            ),
            SyncOperation(
                type="journal/create",
                data={"content": "rapid tap", "entry_date": "2025-09-10"},
                temp_id="t47-b", idempotency_key="ik-47-b",
                client_updated_at=datetime(2099, 9, 10, tzinfo=UTC),
            ),
        ]
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=ops))
        assert result.results[0].entity_id != result.results[1].entity_id

        rows = (await session.execute(
            text("SELECT count(*) FROM journal_entries"),
        )).scalar()
        assert rows == 2

    async def test_47_3_same_content_different_keys_creates_separate_rows(self, clean_session):
        """Even with identical data, different idempotency_keys = separate rows."""
        session = clean_session
        await _insert_user(session, UID, "same-content@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        op1 = SyncOperation(
            type="mood/create",
            data={"mood": "happy", "intensity": 5},
            temp_id="t47-c1", idempotency_key="ik-47-c1",
            client_updated_at=datetime(2099, 9, 15, tzinfo=UTC),
        )
        op2 = SyncOperation(
            type="mood/create",
            data={"mood": "happy", "intensity": 5},
            temp_id="t47-c2", idempotency_key="ik-47-c2",
            client_updated_at=datetime(2099, 9, 15, tzinfo=UTC),
        )
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[op1, op2]))
        assert len(result.results) == 2
        assert result.results[0].entity_id != result.results[1].entity_id

        rows = (await session.execute(
            text("SELECT count(*) FROM mood_logs"),
        )).scalar()
        assert rows == 2


# =============================================================================
# Scenario 48: Slow Network / Abort (mobile-only) — SKIPPED
# =============================================================================


# =============================================================================
# Scenario 49: Desync — SQLite vs Backend Timestamp Conflict
# =============================================================================


class TestScenario49DesyncTimestampConflict:

    async def test_49_1_server_newer_returns_conflict(self, clean_session):
        """Server updated_at > client_updated_at → 409 conflict with server_data."""
        session = clean_session
        await _insert_user(session, UID, "desync@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)

        create_op = SyncOperation(
            type="cycle/create",
            data={"period_start_date": "2025-10-01"},
            temp_id="t49-create", idempotency_key="ik-49-create",
            client_updated_at=datetime(2099, 10, 1, tzinfo=UTC),
        )
        created = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        entity_id = created.results[0].entity_id
        assert created.results[0].status in ("created", "updated")

        await session.execute(
            text("UPDATE cycle_entries SET updated_at = :ts WHERE id = :id"),
            {"ts": datetime(2099, 6, 15, 12, 0, 0, tzinfo=UTC), "id": _hex(entity_id)},
        )
        await session.commit()

        update_op = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "period_end_date": "2025-10-10"},
            temp_id="t49-update", idempotency_key="ik-49-update",
            client_updated_at=datetime(2025, 10, 5, tzinfo=UTC),
        )
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[update_op]))
        assert result.results[0].status == "conflict"
        assert result.results[0].server_data is not None
        assert result.results[0].server_data.get("period_end_date") is None

    async def test_49_2_client_newer_accepted(self, clean_session):
        """client_updated_at > server_updated_at → update accepted (200)."""
        session = clean_session
        await _insert_user(session, UID, "newer-client@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)

        create_op = SyncOperation(
            type="journal/create",
            data={"content": "before edit", "entry_date": "2025-11-01"},
            temp_id="t49-newer", idempotency_key="ik-49-newer",
            client_updated_at=datetime(2025, 11, 1, tzinfo=UTC),
        )
        created = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        entity_id = created.results[0].entity_id

        update_op = SyncOperation(
            type="journal/update",
            data={"id": entity_id, "content": "after edit"},
            temp_id="t49-newer-upd", idempotency_key="ik-49-newer-upd",
            client_updated_at=datetime.now(UTC) + timedelta(seconds=10),
        )
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[update_op]))
        assert result.results[0].status in ("updated", "created")

        row = (await session.execute(
            text("SELECT content FROM journal_entries WHERE id = :id"),
            {"id": _hex(entity_id)},
        )).fetchone()
        assert row is not None
        assert row[0] == "after edit"

    async def test_49_3_future_client_ts_clamped_and_accepted(self, clean_session):
        """client_updated_at far in future → clamped to NOW, then compared.
        After clamping, if client_ts >= server_ts, update is accepted."""
        session = clean_session
        await _insert_user(session, UID, "future-ts@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)

        create_op = SyncOperation(
            type="journal/create",
            data={"content": "future ts test", "entry_date": "2025-12-01"},
            temp_id="t49-future", idempotency_key="ik-49-future",
            client_updated_at=datetime(2025, 12, 1, tzinfo=UTC),
        )
        created = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        entity_id = created.results[0].entity_id

        update_op = SyncOperation(
            type="journal/update",
            data={"id": entity_id, "content": "clamped edit"},
            temp_id="t49-future-upd", idempotency_key="ik-49-future-upd",
            client_updated_at=datetime(2099, 12, 31, tzinfo=UTC),
        )
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[update_op]))
        assert result.results[0].status in ("updated", "created")

    async def test_49_4_conflict_response_includes_server_data(self, clean_session):
        """Conflict response contains full server_data for conflict resolution."""
        session = clean_session
        await _insert_user(session, UID, "conflict-data@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)

        op = SyncOperation(
            type="cycle/create",
            data={"period_start_date": "2025-10-15", "flow_intensity": "light"},
            temp_id="t49-cdata", idempotency_key="ik-49-cdata",
            client_updated_at=datetime(2099, 10, 15, tzinfo=UTC),
        )
        created = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[op]))
        entity_id = created.results[0].entity_id

        await session.execute(
            text("UPDATE cycle_entries SET updated_at = :ts WHERE id = :id"),
            {"ts": datetime(2099, 6, 15, 12, 0, 0, tzinfo=UTC), "id": _hex(entity_id)},
        )
        await session.commit()

        update_op = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "flow_intensity": "heavy"},
            temp_id="t49-cdata-upd", idempotency_key="ik-49-cdata-upd",
            client_updated_at=datetime(2025, 10, 16, tzinfo=UTC),
        )
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[update_op]))
        assert result.results[0].status == "conflict"
        sd = result.results[0].server_data
        assert sd is not None
        assert sd.get("id") == entity_id
        assert sd.get("flow_intensity") == "light"


# =============================================================================
# Scenario 50: DST/Midnight Rollover — Date Storage Immunity
# =============================================================================


class TestScenario50DstMidnightRollover:

    async def test_50_1_date_stored_as_iso_string_no_time_component(self, clean_session):
        """Date stored via push_batch appears as YYYY-MM-DD in SQLite."""
        session = clean_session
        await _insert_user(session, UID, "dst-date@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        op = SyncOperation(
            type="cycle/create",
            data={
                "period_start_date": "2025-11-01",
                "period_end_date": "2025-11-05",
            },
            temp_id="t50-dst", idempotency_key="ik-50-dst",
            client_updated_at=datetime(2099, 11, 1, tzinfo=UTC),
        )
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[op]))
        entity_id = result.results[0].entity_id

        row = (await session.execute(
            text("SELECT period_start_date, period_end_date FROM cycle_entries WHERE id = :id"),
            {"id": _hex(entity_id)},
        )).fetchone()
        assert row is not None
        assert str(row[0]) == "2025-11-01"
        assert str(row[1]) == "2025-11-05"

    async def test_50_2_pull_returns_dates_as_iso_strings(self, clean_session):
        """pull_changes returns date fields as ISO strings without time part."""
        session = clean_session
        await _insert_user(session, UID, "dst-pull@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        op = SyncOperation(
            type="cycle/create",
            data={
                "period_start_date": "2025-12-01",
                "period_end_date": "2025-12-07",
            },
            temp_id="t50-pull", idempotency_key="ik-50-pull",
            client_updated_at=datetime(2099, 12, 1, tzinfo=UTC),
        )
        await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[op]))

        pull = await svc.pull_changes(_real_uid(), limit=100)
        cycles = [c for c in pull.changes if c.entity_type == "cycle"]
        assert len(cycles) >= 1
        data = cycles[0].data
        ps = data.get("period_start_date")
        pe = data.get("period_end_date")
        assert isinstance(ps, str)
        assert isinstance(pe, str)
        assert ps == "2025-12-01"
        assert pe == "2025-12-07"

    async def test_50_3_journal_entry_date_is_iso_string(self, clean_session):
        """journal entry_date stored and returned as ISO string."""
        session = clean_session
        await _insert_user(session, UID, "dst-journal@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        op = SyncOperation(
            type="journal/create",
            data={"content": "DST rollover test", "entry_date": "2025-11-02"},
            temp_id="t50-jrnl", idempotency_key="ik-50-jrnl",
            client_updated_at=datetime(2099, 11, 2, tzinfo=UTC),
        )
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[op]))
        entity_id = result.results[0].entity_id

        row = (await session.execute(
            text("SELECT entry_date FROM journal_entries WHERE id = :id"),
            {"id": _hex(entity_id)},
        )).fetchone()
        assert row is not None
        assert str(row[0]) == "2025-11-02"
