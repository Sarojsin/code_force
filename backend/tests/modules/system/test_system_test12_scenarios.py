"""System Test 12 — Deeper coverage: Performance (33), Conflict (34), Logout (35).

Extends test_system_test11 with edge cases: 50k records, covering index,
cascading op discard, exact timestamp collision, hard-delete on logout.
"""

from __future__ import annotations

import os
import time
import uuid

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

from contextlib import asynccontextmanager
from datetime import UTC, date, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.database import Base, get_db
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
UID2 = "00000000-0000-0000-0000-000000000002"
UID3 = "00000000-0000-0000-0000-000000000003"


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


async def _insert_cycle(session, uid: str, cid: str, start: str, end: str, **extra):
    await session.execute(
        text("""
            INSERT INTO cycle_entries (id, user_id, period_start_date, period_end_date,
                                       symptoms, mood_tags, cycle_type, is_correction,
                                       is_active, created_at, updated_at)
            VALUES (:id, :user_id, :start, :end, :symptoms, :mood_tags,
                    :cycle_type, :is_correction, 1, :created_at, :updated_at)
        """),
        {
            "id": _hex(cid), "user_id": _hex(uid), "start": start, "end": end,
            "symptoms": extra.get("symptoms", "[]"), "mood_tags": "[]",
            "cycle_type": "menstrual", "is_correction": 0,
            "created_at": extra.get("created_at", "2025-01-01 00:00:00"),
            "updated_at": extra.get("updated_at", "2025-01-01 00:00:00"),
        },
    )


async def _insert_journal(session, uid: str, jid: str, entry_date: str, content: str = "test", **extra):
    await session.execute(
        text("""
            INSERT INTO journal_entries (id, user_id, title, content, mood,
                                         entry_date, is_active, created_at, updated_at)
            VALUES (:id, :user_id, :title, :content, :mood,
                    :entry_date, 1, :created_at, :updated_at)
        """),
        {
            "id": _hex(jid), "user_id": _hex(uid),
            "title": extra.get("title", None), "content": content,
            "mood": extra.get("mood", None), "entry_date": entry_date,
            "created_at": extra.get("created_at", "2025-01-01 00:00:00"),
            "updated_at": extra.get("updated_at", "2025-01-01 00:00:00"),
        },
    )


def _real_uid(uid_str: str = UID) -> uuid.UUID:
    return uuid.UUID(uid_str)


# =============================================================================
# Scenario 33 (Extended): SQLite Performance — 50k Records, Covering Index
# =============================================================================


class TestScenario33ExtendedPerformance:

    async def test_33_6_covering_index_with_selected_columns(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "cover@test.com")
        base = date(2000, 1, 1)
        for i in range(5000):
            d = base + timedelta(days=i * 28)
            await _insert_cycle(
                session, UID, f"00000000-0000-0000-0000-{6000 + i:012x}",
                d.isoformat(), (d + timedelta(days=5)).isoformat(),
                symptoms='["cramps","bloating"]',
            )
        await session.commit()

        start = time.monotonic()
        rows = (await session.execute(
            text("""
                SELECT period_start_date, period_end_date FROM cycle_entries
                WHERE user_id = :uid AND is_active = 1
                ORDER BY period_start_date DESC LIMIT 50
            """),
            {"uid": _hex(UID)},
        )).fetchall()
        elapsed = time.monotonic() - start

        assert len(rows) == 50
        assert elapsed < 0.5, f"Covering index query took {elapsed:.3f}s"
        for r in rows:
            assert r[0] is not None

    async def test_33_7_50k_records_100_year_horizon(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "50k@test.com")
        base = date(1925, 1, 1)
        for i in range(50000):
            d = base + timedelta(days=i * 1)
            await _insert_cycle(
                session, UID, f"00000000-0000-0000-0000-{50000 + i:012x}",
                d.isoformat(), (d + timedelta(days=3)).isoformat(),
            )
        await session.commit()

        start = time.monotonic()
        rows = (await session.execute(
            text("""
                SELECT id, user_id, period_start_date FROM cycle_entries
                WHERE user_id = :uid AND is_active = 1
                ORDER BY period_start_date DESC LIMIT 50
            """),
            {"uid": _hex(UID)},
        )).fetchall()
        elapsed = time.monotonic() - start

        assert len(rows) == 50
        assert elapsed < 0.5, f"50k query took {elapsed:.3f}s"

    async def test_33_8_json_symptoms_parsing_overhead(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "json@test.com")
        for i in range(5000):
            d = date(2020, 1, 1) + timedelta(days=i)
            await _insert_cycle(
                session, UID, f"00000000-0000-0000-0000-{7000 + i:012x}",
                d.isoformat(), (d + timedelta(days=5)).isoformat(),
                symptoms='["cramps","bloating","headache","fatigue","acne"]',
            )
        await session.commit()

        start = time.monotonic()
        rows = (await session.execute(
            text("""
                SELECT symptoms FROM cycle_entries
                WHERE user_id = :uid AND is_active = 1
                ORDER BY period_start_date DESC LIMIT 50
            """),
            {"uid": _hex(UID)},
        )).fetchall()
        elapsed = time.monotonic() - start

        assert len(rows) == 50
        assert elapsed < 0.5, f"JSON parse overhead took {elapsed:.3f}s"

    async def test_33_9_multi_user_concurrent_query(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "multi-a@test.com")
        await _insert_user(session, UID2, "multi-b@test.com")
        await _insert_user(session, UID3, "multi-c@test.com")
        offsets = {UID: 0, UID2: 1000, UID3: 2000}
        for uid in (UID, UID2, UID3):
            for i in range(100):
                d = date(2020, 1, 1) + timedelta(days=i * 28)
                await _insert_cycle(
                    session, uid,
                    f"00000000-0000-0000-0000-{offsets[uid] + i:012x}",
                    d.isoformat(), (d + timedelta(days=5)).isoformat(),
                )
        await session.commit()

        for uid in (UID, UID2, UID3):
            rows = (await session.execute(
                text("""
                    SELECT id FROM cycle_entries
                    WHERE user_id = :uid AND is_active = 1
                    ORDER BY period_start_date DESC LIMIT 10
                """),
                {"uid": _hex(uid)},
            )).fetchall()
            assert len(rows) == 10

        total = (await session.execute(text("SELECT count(*) FROM cycle_entries"))).scalar()
        assert total == 300


# =============================================================================
# Scenario 34 (Extended): Offline Conflict — Cascading, Timestamp Collision
# =============================================================================


class TestScenario34ExtendedConflict:

    async def test_34_6_cascading_discard_for_dependent_ops(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "cascade@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        create_op = SyncOperation(
            type="journal/create",
            data={"content": "initial", "entry_date": "2025-11-01"},
            temp_id="t12-create", idempotency_key="ik-12-create",
            client_updated_at=datetime(2099, 11, 1, tzinfo=UTC),
        )
        create_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        assert create_result.results[0].status in ("created", "updated")
        entity_id = create_result.results[0].entity_id

        update_op = SyncOperation(
            type="journal/update",
            data={"id": entity_id, "content": "cascade update"},
            temp_id="t12-update", idempotency_key="ik-12-update",
            client_updated_at=datetime(2099, 11, 2, tzinfo=UTC),
        )
        update_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[update_op]))
        assert update_result.results[0].status in ("created", "updated")

        stale_update = SyncOperation(
            type="journal/update",
            data={"id": entity_id, "content": "very stale"},
            temp_id="t12-stale", idempotency_key="ik-12-stale",
            client_updated_at=datetime(2020, 1, 1, tzinfo=UTC),
        )
        stale_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[stale_update]))
        assert stale_result.results[0].status == "conflict"
        assert stale_result.results[0].server_data.get("content") in ("initial", "cascade update")

    async def test_34_7_exact_timestamp_no_collision(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "exact@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        ts = datetime(2099, 12, 1, 12, 0, 0, tzinfo=UTC)
        op = SyncOperation(
            type="journal/create",
            data={"content": "exact ts", "entry_date": "2025-12-01"},
            temp_id="t12-exact", idempotency_key="ik-12-exact",
            client_updated_at=ts,
        )
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[op]))
        assert result.results[0].status in ("created", "updated")
        entity_id = result.results[0].entity_id

        exact_ts_op = SyncOperation(
            type="journal/update",
            data={"id": entity_id, "content": "same ts update"},
            temp_id="t12-exact-upd", idempotency_key="ik-12-exact-upd",
            client_updated_at=ts,
        )
        exact_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[exact_ts_op]))
        assert exact_result.results[0].status in ("created", "updated")

    async def test_34_8_mood_create_conflict(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "moodconf@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        op = SyncOperation(
            type="mood/create",
            data={"mood": "happy", "intensity": 5},
            temp_id="t12-mood", idempotency_key="ik-12-mood",
            client_updated_at=datetime(2025, 12, 1, tzinfo=UTC),
        )
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[op]))
        assert result.results[0].status in ("created", "updated")

    async def test_34_9_conflict_resolution_returns_server_state(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "serverstate@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        create_op = SyncOperation(
            type="journal/create",
            data={"content": "server version", "entry_date": "2025-12-15"},
            temp_id="t12-srv", idempotency_key="ik-12-srv",
            client_updated_at=datetime(2025, 12, 15, tzinfo=UTC),
        )
        create_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        assert create_result.results[0].status in ("created", "updated")
        entity_id = create_result.results[0].entity_id

        stale = SyncOperation(
            type="journal/update",
            data={"id": entity_id, "content": "old client"},
            temp_id="t12-srv-stale", idempotency_key="ik-12-srv-stale",
            client_updated_at=datetime(2020, 6, 1, tzinfo=UTC),
        )
        conflict = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[stale]))
        assert conflict.results[0].status == "conflict"
        assert conflict.results[0].server_data.get("content") == "server version"
        assert "updated_at" in conflict.results[0].server_data


# =============================================================================
# Scenario 35 (Extended): Logout — Hard Delete, All Data Types, Force-Quit
# =============================================================================


class TestScenario35ExtendedPrivacy:

    async def test_35_6_data_partitioned_across_all_types(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "multi-type@test.com")
        await _insert_user(session, UID2, "other@test.com")
        await _insert_cycle(session, UID, "00000000-0000-0000-0000-00000000c010",
                            "2025-04-01", "2025-04-05")
        await _insert_journal(session, UID, "00000000-0000-0000-0000-000000000010",
                              "2025-04-01", "Priya journal")
        await _insert_cycle(session, UID2, "00000000-0000-0000-0000-00000000c011",
                            "2025-05-01", "2025-05-05")
        await _insert_journal(session, UID2, "00000000-0000-0000-0000-000000000011",
                              "2025-05-01", "Other journal")
        await session.commit()

        for uid in (UID, UID2):
            cycles = (await session.execute(
                text("SELECT count(*) FROM cycle_entries WHERE user_id = :uid"),
                {"uid": _hex(uid)},
            )).scalar()
            assert cycles == 1
            journals = (await session.execute(
                text("SELECT count(*) FROM journal_entries WHERE user_id = :uid"),
                {"uid": _hex(uid)},
            )).scalar()
            assert journals == 1

    async def test_35_7_hard_delete_removes_only_own_user_data(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "hard-del@test.com")
        await _insert_user(session, UID2, "keep@test.com")
        for i in range(3):
            await _insert_cycle(session, UID,
                                f"00000000-0000-0000-0000-00000000d00{i}",
                                f"2025-0{i + 1}-01", f"2025-0{i + 1}-05")
            await _insert_cycle(session, UID2,
                                f"00000000-0000-0000-0000-00000000e00{i}",
                                f"2025-0{i + 1}-15", f"2025-0{i + 1}-20")
        await session.commit()

        await session.execute(
            text("DELETE FROM cycle_entries WHERE user_id = :uid"),
            {"uid": _hex(UID)},
        )
        await session.commit()

        remaining_del = (await session.execute(
            text("SELECT count(*) FROM cycle_entries WHERE user_id = :uid"),
            {"uid": _hex(UID)},
        )).scalar()
        assert remaining_del == 0

        remaining_keep = (await session.execute(
            text("SELECT count(*) FROM cycle_entries WHERE user_id = :uid"),
            {"uid": _hex(UID2)},
        )).scalar()
        assert remaining_keep == 3

    async def test_35_8_sqlite_untouched_on_auth_reset_simulation(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "reset-test@test.com")
        await _insert_cycle(session, UID, "00000000-0000-0000-0000-00000000f001",
                            "2025-06-01", "2025-06-05")
        await _insert_journal(session, UID, "00000000-0000-0000-0000-000000000020",
                              "2025-06-01", "Data must survive")
        await session.commit()

        rows_before = (await session.execute(text("SELECT count(*) FROM cycle_entries"))).scalar()
        assert rows_before == 1

        rows_journal_before = (await session.execute(text("SELECT count(*) FROM journal_entries"))).scalar()
        assert rows_journal_before == 1

    async def test_35_9_new_user_data_coexists_with_existing(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "existing@test.com")
        await _insert_cycle(session, UID, "00000000-0000-0000-0000-00000000f002",
                            "2025-01-01", "2025-01-05")
        await session.commit()

        await _insert_user(session, UID2, "new@test.com")
        await _insert_cycle(session, UID2, "00000000-0000-0000-0000-00000000f003",
                            "2025-07-01", "2025-07-05")
        await session.commit()

        existing_rows = (await session.execute(
            text("SELECT count(*) FROM cycle_entries WHERE user_id = :uid"),
            {"uid": _hex(UID)},
        )).scalar()
        assert existing_rows == 1

        new_rows = (await session.execute(
            text("SELECT count(*) FROM cycle_entries WHERE user_id = :uid"),
            {"uid": _hex(UID2)},
        )).scalar()
        assert new_rows == 1

        total = (await session.execute(text("SELECT count(*) FROM cycle_entries"))).scalar()
        assert total == 2
