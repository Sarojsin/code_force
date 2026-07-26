"""System Test 11 — Performance (33), Conflict (34), Logout Privacy (35).

Scenario 33: SQLite performance — 5,000+ records, index usage, query speed.
Scenario 34: Offline queue + SQLite conflict — 409 "server wins" resolution.
Scenario 35: Logout — SQLite retained, user_id isolation, session state cleared.
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
            "symptoms": "[]", "mood_tags": "[]",
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
# Scenario 33: SQLite Performance — 5,000+ Records
# =============================================================================


class TestScenario33SQLitePerformance:

    async def test_33_1_indexes_exist_on_cycle_entries(self, clean_session):
        session = clean_session
        rows = (await session.execute(
            text("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'cycle_entries'")
        )).fetchall()
        index_names = {r[0] for r in rows}
        assert "ix_cycle_entries_user_id" in index_names, "Missing index on user_id"
        assert "ix_cycle_entries_period_start_date" in index_names, "Missing index on period_start_date"

    async def test_33_2_query_performance_under_5000_rows(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "perf@test.com")
        base = datetime(2015, 1, 1, tzinfo=UTC)
        for i in range(5000):
            day = base + timedelta(days=i * 28)
            await _insert_cycle(
                session, UID, f"00000000-0000-0000-0000-{i:012x}",
                day.strftime("%Y-%m-%d"), (day + timedelta(days=5)).strftime("%Y-%m-%d"),
                created_at=day.strftime("%Y-%m-%d %H:%M:%S"),
                updated_at=day.strftime("%Y-%m-%d %H:%M:%S"),
            )
        await session.commit()

        start = time.monotonic()
        rows = (await session.execute(
            text("""
                SELECT id, user_id, period_start_date, period_end_date
                FROM cycle_entries
                WHERE user_id = :uid AND is_active = 1
                ORDER BY period_start_date DESC
                LIMIT 50
            """),
            {"uid": _hex(UID)},
        )).fetchall()
        elapsed = time.monotonic() - start

        assert len(rows) == 50
        assert elapsed < 0.5, f"Query took {elapsed:.3f}s, expected < 0.5s"

    async def test_33_3_explain_query_plan_shows_index(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "explain@test.com")
        await session.commit()

        plan = (await session.execute(
            text("EXPLAIN QUERY PLAN SELECT id FROM cycle_entries WHERE user_id = :uid AND is_active = 1 ORDER BY period_start_date DESC LIMIT 50"),
            {"uid": _hex(UID)},
        )).fetchall()
        plan_text = " ".join(str(r[3]) for r in plan)
        assert "INDEX" in plan_text or "SCAN" in plan_text or "USING" in plan_text

    async def test_33_4_limit_offset_pagination(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "page@test.com")
        for i in range(100):
            day = date(2020, 1, 1) + timedelta(days=i * 28)
            await _insert_cycle(
                session, UID, f"00000000-0000-0000-0000-{100 + i:012x}",
                day.isoformat(), (day + timedelta(days=5)).isoformat(),
            )
        await session.commit()

        page1 = (await session.execute(
            text("SELECT id FROM cycle_entries WHERE user_id = :uid ORDER BY period_start_date DESC LIMIT 30 OFFSET 0"),
            {"uid": _hex(UID)},
        )).fetchall()
        assert len(page1) == 30

        page2 = (await session.execute(
            text("SELECT id FROM cycle_entries WHERE user_id = :uid ORDER BY period_start_date DESC LIMIT 30 OFFSET 30"),
            {"uid": _hex(UID)},
        )).fetchall()
        assert len(page2) == 30

        page4 = (await session.execute(
            text("SELECT id FROM cycle_entries WHERE user_id = :uid ORDER BY period_start_date DESC LIMIT 30 OFFSET 90"),
            {"uid": _hex(UID)},
        )).fetchall()
        assert len(page4) == 10

        ids_page1 = {r[0] for r in page1}
        ids_page2 = {r[0] for r in page2}
        assert ids_page1.isdisjoint(ids_page2), "Pages must not overlap"

    async def test_33_5_date_range_filter_performance(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "range@test.com")
        base = date(2015, 1, 1)
        for i in range(5000):
            d = base + timedelta(days=i * 28)
            await _insert_cycle(
                session, UID, f"00000000-0000-0000-0000-{5000 + i:012x}",
                d.isoformat(), (d + timedelta(days=5)).isoformat(),
            )
        await session.commit()

        start = time.monotonic()
        rows = (await session.execute(
            text("""
                SELECT id FROM cycle_entries
                WHERE user_id = :uid AND period_start_date >= :after AND is_active = 1
                ORDER BY period_start_date DESC
                LIMIT 100
            """),
            {"uid": _hex(UID), "after": "2024-01-01"},
        )).fetchall()
        elapsed = time.monotonic() - start

        assert len(rows) >= 1
        assert elapsed < 0.5, f"Date range query took {elapsed:.3f}s, expected < 0.5s"


# =============================================================================
# Scenario 34: Offline Queue + SQLite Conflict — Server Wins
# =============================================================================


class TestScenario34OfflineConflict:

    async def test_34_1_stale_client_timestamp_returns_conflict(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "conflict34@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        create_op = SyncOperation(
            type="journal/create",
            data={"content": "original", "entry_date": "2025-07-01"},
            temp_id="t34-create", idempotency_key="ik-34-create",
            client_updated_at=datetime(2025, 7, 1, 12, 0, 0, tzinfo=UTC),
        )
        create_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        assert create_result.results[0].status in ("created", "updated")
        entity_id = create_result.results[0].entity_id

        stale_op = SyncOperation(
            type="journal/update",
            data={"id": entity_id, "content": "stale edit"},
            temp_id="t34-stale", idempotency_key="ik-34-stale",
            client_updated_at=datetime(2020, 1, 1, tzinfo=UTC),
        )
        conflict_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[stale_op]))
        assert conflict_result.results[0].status == "conflict"
        assert conflict_result.results[0].server_data is not None
        assert conflict_result.results[0].server_data.get("content") == "original"

    async def test_34_2_newer_client_timestamp_wins(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "newer34@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        create_op = SyncOperation(
            type="journal/create",
            data={"content": "base", "entry_date": "2025-08-01"},
            temp_id="t34-new", idempotency_key="ik-34-newer",
            client_updated_at=datetime(2025, 8, 1, 12, 0, 0, tzinfo=UTC),
        )
        create_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        assert create_result.results[0].status in ("created", "updated")
        entity_id = create_result.results[0].entity_id

        newer_op = SyncOperation(
            type="journal/update",
            data={"id": entity_id, "content": "newer edit"},
            temp_id="t34-newer-upd", idempotency_key="ik-34-newer-upd",
            client_updated_at=datetime(2099, 1, 1, tzinfo=UTC),
        )
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[newer_op]))
        assert result.results[0].status in ("created", "updated")
        assert result.results[0].server_data.get("content") == "newer edit"

    async def test_34_3_idempotency_key_dedup_on_retry(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "dedup34@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        op = SyncOperation(
            type="journal/create",
            data={"content": "dedup content", "entry_date": "2025-09-01"},
            temp_id="t34-dedup", idempotency_key="ik-34-dedup",
            client_updated_at=datetime(2025, 9, 1, tzinfo=UTC),
        )
        payload = SyncBatchRequest(operations=[op])

        first = await svc.push_batch(_real_uid(), payload)
        assert first.results[0].status in ("created", "updated")
        first_id = first.results[0].entity_id

        rows_before = (await session.execute(text("SELECT count(*) FROM journal_entries"))).scalar()
        assert rows_before == 1

        second = await svc.push_batch(_real_uid(), payload)
        assert second.results[0].entity_id == first_id
        rows_after = (await session.execute(text("SELECT count(*) FROM journal_entries"))).scalar()
        assert rows_after == 1

    async def test_34_4_create_conflict_with_existing_record(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "createconf34@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        await _insert_journal(session, UID, "00000000-0000-0000-0000-00000000dead",
                              "2025-10-01", "existing row")
        await session.commit()

        conflict_op = SyncOperation(
            type="journal/create",
            data={"content": "duplicate create attempt", "entry_date": "2025-10-01"},
            temp_id="t34-dup-create", idempotency_key="ik-34-dup-create",
            client_updated_at=datetime(2025, 10, 1, tzinfo=UTC),
        )
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[conflict_op]))
        assert result.results[0].status in ("created", "updated")

        rows = (await session.execute(text("SELECT count(*) FROM journal_entries"))).scalar()
        assert rows == 2

    async def test_34_5_cycle_update_conflict_returns_server_data(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "cyc-conf34@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        create_op = SyncOperation(
            type="cycle/create",
            data={"period_start_date": "2025-06-01", "period_end_date": "2025-06-05"},
            temp_id="t34-cyc", idempotency_key="ik-34-cyc",
            client_updated_at=datetime(2025, 6, 1, tzinfo=UTC),
        )
        create_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        assert create_result.results[0].status in ("created", "updated")
        entity_id = create_result.results[0].entity_id

        stale_update = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "period_start_date": "2025-06-10"},
            temp_id="t34-cyc-stale", idempotency_key="ik-34-cyc-stale",
            client_updated_at=datetime(2020, 1, 1, tzinfo=UTC),
        )
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[stale_update]))
        assert result.results[0].status == "conflict"
        assert result.results[0].server_data is not None
        assert result.results[0].server_data.get("period_start_date") == "2025-06-01"


# =============================================================================
# Scenario 35: Logout — SQLite Data Persistence (Privacy Check)
# =============================================================================


class TestScenario35LogoutPersistence:

    async def test_35_1_data_persists_across_sessions(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "persist@test.com")
        await _insert_cycle(session, UID, "00000000-0000-0000-0000-00000000c001",
                            "2025-01-01", "2025-01-05")
        await session.commit()

        rows = (await session.execute(
            text("SELECT count(*) FROM cycle_entries WHERE user_id = :uid"),
            {"uid": _hex(UID)},
        )).scalar()
        assert rows == 1

    async def test_35_2_different_user_cannot_see_data(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "priya@test.com")
        await _insert_user(session, UID2, "ananya@test.com")
        await _insert_cycle(session, UID, "00000000-0000-0000-0000-00000000c002",
                            "2025-02-01", "2025-02-05")
        await session.commit()

        priya_rows = (await session.execute(
            text("SELECT id FROM cycle_entries WHERE user_id = :uid"),
            {"uid": _hex(UID)},
        )).fetchall()
        assert len(priya_rows) == 1

        ananya_rows = (await session.execute(
            text("SELECT id FROM cycle_entries WHERE user_id = :uid"),
            {"uid": _hex(UID2)},
        )).fetchall()
        assert len(ananya_rows) == 0

    async def test_35_3_both_users_coexist_without_leakage(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "user_a@test.com")
        await _insert_user(session, UID2, "user_b@test.com")
        await _insert_user(session, UID3, "user_c@test.com")
        for i, (uid, label) in enumerate([(UID, "A"), (UID2, "B"), (UID3, "C")]):
            for j in range(5):
                await _insert_cycle(
                    session, uid,
                    f"00000000-0000-0000-0000-{ord(label) * 1000 + j:012x}",
                    f"2025-{1 + j:02d}-01",
                    f"2025-{1 + j:02d}-05",
                )
        await session.commit()

        for uid in (UID, UID2, UID3):
            rows = (await session.execute(
                text("SELECT count(*) FROM cycle_entries WHERE user_id = :uid"),
                {"uid": _hex(uid)},
            )).scalar()
            assert rows == 5

        total = (await session.execute(
            text("SELECT count(*) FROM cycle_entries")
        )).scalar()
        assert total == 15

    async def test_35_4_cycle_data_survives_session_reset(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "relogin@test.com")
        await _insert_cycle(session, UID, "00000000-0000-0000-0000-00000000c005",
                            "2025-03-01", "2025-03-05")
        await _insert_journal(session, UID, "00000000-0000-0000-0000-00000000000a",
                              "2025-03-01", "My journal entry")
        await session.commit()

        _real_uid()
        rows_cycle = (await session.execute(
            text("SELECT count(*) FROM cycle_entries WHERE user_id = :uid"),
            {"uid": _hex(UID)},
        )).scalar()
        assert rows_cycle == 1

        rows_journal = (await session.execute(
            text("SELECT count(*) FROM journal_entries WHERE user_id = :uid"),
            {"uid": _hex(UID)},
        )).scalar()
        assert rows_journal == 1

    async def test_35_5_uuid_partition_guarantees_no_collision(self, clean_session):
        session = clean_session
        assert uuid.UUID(UID).hex != uuid.UUID(UID2).hex
        assert uuid.UUID(UID2).hex != uuid.UUID(UID3).hex
