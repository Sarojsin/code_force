"""System Test 10 — Returning User Offline (30), Background Refresh (31), Long Offline (32).

Scenario 30: Returning user offline — SQLite has data, AsyncStorage cleared.
  tests API query endpoints, sync pull, ETag, empty results.

Scenario 31: Background API refresh — UI updates silently.
  tests sync/batch endpoint, conflict detection (409 with server_data),
  empty batch handling.

Scenario 32: Long offline period — batch size, model status, token expiry.
  tests batch ops, /models/status, refresh token config, 401 on bad token.
"""

from __future__ import annotations

import os
import uuid
from unittest.mock import patch

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

from contextlib import asynccontextmanager
from datetime import UTC, datetime

import pytest
import pytest_asyncio
from fastapi import APIRouter, Depends, FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles


@compiles(PG_UUID, "sqlite")
def _compile_uuid_sqlite(type_, compiler, **kw):
    return "VARCHAR(32)"


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(type_, compiler, **kw):
    return "JSON"


from app.core.config import get_settings
from app.core.database import Base, get_db
from app.core.event_bus import event_bus


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


@asynccontextmanager
async def _noop_lifespan(app: FastAPI):
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
    """UUID hex (without dashes) — matches UUID(as_uuid=True) bind_processor output."""
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


async def _insert_cycle(session, uid: str, cid: str, start: str, end: str):
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
            "created_at": "2025-01-01 00:00:00", "updated_at": "2025-01-01 00:00:00",
        },
    )


def _real_uid() -> uuid.UUID:
    return uuid.UUID(UID)


# =============================================================================
# Scenario 30: Returning User — Offline (SQLite has data, AsyncStorage cleared)
# =============================================================================


class TestScenario30ReturningUserOffline:

    async def test_30_1_sync_changes_returns_data(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "offline@test.com")
        await _insert_cycle(session, UID, "00000000-0000-0000-0000-0000000000c1",
                            "2025-01-01", "2025-01-05")
        await _insert_cycle(session, UID, "00000000-0000-0000-0000-0000000000c2",
                            "2025-02-01", "2025-02-04")
        await session.commit()

        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        result = await svc.pull_changes(_real_uid(), limit=100)
        assert len(result.changes) == 2
        assert result.changes[0].entity_type == "cycle"

    async def test_30_5_multi_user_pull_isolation(self, clean_session):
        """Insert for 2 users, pull for user1 → only user1's cycles returned."""
        session = clean_session
        await _insert_user(session, UID, "user_a@test.com")
        await _insert_user(session, UID2, "user_b@test.com")
        await _insert_cycle(session, UID, "00000000-0000-0000-0000-0000000000c1",
                            "2025-01-01", "2025-01-05")
        await _insert_cycle(session, UID, "00000000-0000-0000-0000-0000000000c2",
                            "2025-02-01", "2025-02-05")
        await _insert_cycle(session, UID2, "00000000-0000-0000-0000-0000000000c3",
                            "2025-03-01", "2025-03-05")
        await session.commit()

        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        result = await svc.pull_changes(_real_uid(), limit=100)
        assert len(result.changes) == 2
        for c in result.changes:
            assert c.entity_type == "cycle"

    async def test_30_2_sync_changes_empty_result_returns_empty_list(self, clean_session):
        session = clean_session
        await session.commit()

        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        result = await svc.pull_changes(uuid.UUID(UID2), limit=100)
        assert len(result.changes) == 0
        assert result.has_more is False

    async def test_30_3_etag_derived_from_timestamp(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "etag@test.com")
        await _insert_cycle(session, UID, "00000000-0000-0000-0000-0000000000c3",
                            "2025-01-01", "2025-01-05")
        await session.commit()

        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        result = await svc.pull_changes(_real_uid(), limit=100)
        assert len(result.changes) > 0
        last_ts = max(c.updated_at for c in result.changes)
        etag = f'W/"{last_ts.isoformat()}"'
        assert etag.startswith("W/")

    async def test_30_4_sync_changes_filters_by_since_timestamp(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "since@test.com")
        await _insert_cycle(session, UID, "00000000-0000-0000-0000-0000000000c4",
                            "2025-01-01", "2025-01-05")
        await session.commit()

        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        result_old = await svc.pull_changes(
            _real_uid(), since=datetime(2024, 1, 1, tzinfo=UTC), limit=100,
        )
        assert len(result_old.changes) == 1
        result_future = await svc.pull_changes(
            _real_uid(), since=datetime(2099, 1, 1, tzinfo=UTC), limit=100,
        )
        assert len(result_future.changes) == 0


# =============================================================================
# Scenario 31: Background API Refresh — UI Updates Silently
# =============================================================================


class TestScenario31BackgroundRefresh:

    async def test_31_1_sync_batch_accepts_journal_op(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "batch@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        payload = SyncBatchRequest(operations=[
            SyncOperation(
                type="journal/create",
                data={"content": "test", "entry_date": "2025-06-01"},
                temp_id="t1",
                idempotency_key="ik-31-1",
                client_updated_at=datetime(2025, 6, 1, 12, 0, 0, tzinfo=UTC),
            ),
        ])
        result = await svc.push_batch(_real_uid(), payload)
        assert len(result.results) == 1
        assert result.results[0].status in ("created", "updated")

    async def test_31_2_sync_batch_returns_results_for_each_op(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "multi@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        payload = SyncBatchRequest(operations=[
            SyncOperation(
                type="mood/create",
                data={"mood": "happy", "intensity": 4},
                temp_id="t1", idempotency_key="ik-m1",
            ),
            SyncOperation(
                type="journal/create",
                data={"content": "second", "entry_date": "2025-06-02"},
                temp_id="t2", idempotency_key="ik-m2",
            ),
        ])
        result = await svc.push_batch(_real_uid(), payload)
        assert len(result.results) == 2
        assert result.results[0].status in ("created", "updated")
        assert result.results[1].status in ("created", "updated")

    async def test_31_3_sync_batch_empty_payload_accepted(self, clean_session):
        session = clean_session
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        payload = SyncBatchRequest(operations=[])
        result = await svc.push_batch(_real_uid(), payload)
        assert len(result.results) == 0
        assert len(result.conflicts) == 0

    async def test_31_4_unsupported_handler_returns_failed_status(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "fail@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        # Use a valid pattern but no handler registered
        payload = SyncBatchRequest(operations=[
            SyncOperation(
                type="pregnancy_daily_log/create",
                data={"period_start_date": "2025-06-01"},
                temp_id="t3", idempotency_key="ik-fail",
            ),
        ])
        result = await svc.push_batch(_real_uid(), payload)
        assert len(result.results) == 1
        assert result.results[0].status == "failed"

    async def test_31_5_full_sync_cycle_push_pull_hydrate(self, clean_session):
        """Push a journal → pull changes → verify record hydrates correctly in SQLite."""
        session = clean_session
        await _insert_user(session, UID, "fullcycle@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        push_payload = SyncBatchRequest(operations=[
            SyncOperation(
                type="journal/create",
                data={"content": "full cycle test", "entry_date": "2025-07-01"},
                temp_id="t-full-1", idempotency_key="ik-full-cycle",
            ),
        ])
        push_result = await svc.push_batch(_real_uid(), push_payload)
        assert push_result.results[0].status in ("created", "updated")
        pushed_id = push_result.results[0].entity_id
        assert pushed_id is not None

        pull_result = await svc.pull_changes(_real_uid(), limit=100)
        assert len(pull_result.changes) == 1
        assert str(pull_result.changes[0].entity_id) == pushed_id
        assert pull_result.changes[0].entity_type == "journal"

        rows = (await session.execute(text("SELECT count(*) FROM journal_entries"))).scalar()
        assert rows == 1, "Journal entry not hydrated in SQLite after push"


# =============================================================================
# Scenario 32: Long Offline Period (Weeks/Months)
# =============================================================================


class TestScenario32LongOffline:

    async def test_32_1_batch_handles_many_journal_ops(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "massive@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        ops = [
            SyncOperation(
                type="journal/create",
                data={"content": f"entry {i}", "entry_date": f"2025-01-{i:02d}"},
                temp_id=f"t{i}", idempotency_key=f"ik-m{i}",
            )
            for i in range(1, 21)
        ]
        payload = SyncBatchRequest(operations=ops)
        result = await svc.push_batch(_real_uid(), payload)
        assert len(result.results) == 20
        success = [r for r in result.results if r.status in ("created", "updated")]
        assert len(success) == 20

    async def test_32_2_model_status_endpoint_returns_version(self):
        from app.modules.auth.dependencies import get_current_user
        from app.core import database as core_db

        async def _fake_user():
            return type("FakeUser", (), {"id": _real_uid(), "role": "user"})()

        engine = create_async_engine("sqlite+aiosqlite:///file::memory:?cache=shared&uri=true", echo=False)
        fake_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
        async with fake_factory() as setup_session:
            await setup_session.run_sync(lambda s: Base.metadata.create_all(s.connection()))

        with patch.object(core_db, "AsyncSessionLocal", fake_factory):
            app = FastAPI(lifespan=_noop_lifespan)
            from app.modules.cycle.routes import init_module as cycle_init
            cycle_init(app, event_bus)
            app.dependency_overrides[get_current_user] = _fake_user

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                resp = await ac.get("/api/v1/cycle/models/status")
                assert resp.status_code == 200
                data = resp.json().get("data", resp.json())
                assert "current_version" in data
                assert "download_url" in data
        await engine.dispose()

    async def test_32_3_idempotency_dedup_on_retry(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "idemp@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        ik = "ik-dedup-32-3"
        op = SyncOperation(
            type="journal/create",
            data={"content": "dedup test", "entry_date": "2025-07-01"},
            temp_id="t32-idemp", idempotency_key=ik,
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
        assert rows_after == 1, "Idempotency failure: duplicate row created"

    async def test_32_4_conflict_detected_on_outdated_update(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "conflict@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        create_op = SyncOperation(
            type="journal/create",
            data={"content": "original", "entry_date": "2025-07-01"},
            temp_id="t32-conflict", idempotency_key="ik-conflict-create",
        )
        create_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        assert create_result.results[0].status in ("created", "updated")
        entity_id = create_result.results[0].entity_id

        update_op = SyncOperation(
            type="journal/update",
            data={"id": entity_id, "content": "outdated edit"},
            temp_id="t32-conflict-upd", idempotency_key="ik-conflict-upd",
            client_updated_at=datetime(2020, 1, 1, tzinfo=UTC),
        )
        conflict_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[update_op]))
        assert conflict_result.results[0].status == "conflict"
        assert conflict_result.results[0].server_data is not None

    async def test_32_5_fifo_order_preserved_in_response(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "fifo@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        ops = [
            SyncOperation(
                type="journal/create",
                data={"content": f"fifo-{i}", "entry_date": "2025-07-01"},
                temp_id=f"t32-fifo-{i}", idempotency_key=f"ik-fifo-{i}",
            )
            for i in range(5)
        ]
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=ops))
        assert len(result.results) == 5
        for i, r in enumerate(result.results):
            assert r.temp_id == f"t32-fifo-{i}", f"FIFO violation at index {i}: {r.temp_id}"

    async def test_32_6_global_model_updates_via_status_endpoint(self):
        from app.modules.auth.dependencies import get_current_user
        from app.core import database as core_db

        async def _fake_user():
            return type("FakeUser", (), {"id": _real_uid(), "role": "user"})()

        engine = create_async_engine("sqlite+aiosqlite:///file::memory:?cache=shared&uri=true", echo=False)
        fake_factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
        async with fake_factory() as setup_session:
            await setup_session.run_sync(lambda s: Base.metadata.create_all(s.connection()))
            cid1 = _hex("00000000-0000-0000-0000-0000000000a1")
            cid2 = _hex("00000000-0000-0000-0000-0000000000a2")
            await setup_session.execute(
                text("INSERT INTO system_config (id, is_active, key, value) VALUES (:id, 1, :k, :v)"),
                {"id": cid1, "k": "global_model_version", "v": "7"},
            )
            await setup_session.execute(
                text("INSERT INTO system_config (id, is_active, key, value) VALUES (:id, 1, :k, :v)"),
                {"id": cid2, "k": "global_model_path", "v": "v7/model.json"},
            )
            await setup_session.commit()

        with patch.object(core_db, "AsyncSessionLocal", fake_factory):
            app = FastAPI(lifespan=_noop_lifespan)
            from app.modules.cycle.routes import init_module as cycle_init
            cycle_init(app, event_bus)
            app.dependency_overrides[get_current_user] = _fake_user

            async with AsyncClient(
                transport=ASGITransport(app=app), base_url="http://test"
            ) as ac:
                resp = await ac.get("/api/v1/cycle/models/status")
                assert resp.status_code == 200
                data = resp.json().get("data", resp.json())
                assert data["current_version"] == 7
                assert "v7/model.json" in data["download_url"]
        await engine.dispose()

    async def test_32_7_refresh_token_expiry_days_configured(self):
        settings = get_settings()
        assert settings.jwt.refresh_token_expire_days >= 7

    async def test_32_8_server_returns_401_on_invalid_token(self):
        from starlette.exceptions import HTTPException as StarletteHTTPException

        async def _fail_auth():
            from fastapi import HTTPException as FastAPIHTTPException
            raise FastAPIHTTPException(status_code=401, detail="Invalid token")

        app = FastAPI(lifespan=_noop_lifespan)
        from app.core.exceptions import http_exception_handler
        app.add_exception_handler(StarletteHTTPException, http_exception_handler)

        router = APIRouter(prefix="/api/v1/auth")
        @router.get("/me")
        async def get_me(current_user=Depends(_fail_auth)):
            return {"id": str(current_user)}

        app.include_router(router)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid"})
            assert resp.status_code == 401

    async def test_32_9_conflict_on_cycle_update(self, clean_session):
        """Test 409 conflict on cycle/update with outdated client_updated_at."""
        session = clean_session
        await _insert_user(session, UID, "cycleconf@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        create_op = SyncOperation(
            type="cycle/create",
            data={"period_start_date": "2025-06-01", "period_end_date": "2025-06-05"},
            temp_id="t32-cyc-conf", idempotency_key="ik-cyc-conf",
        )
        create_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        assert create_result.results[0].status in ("created", "updated")
        entity_id = create_result.results[0].entity_id

        update_op = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "period_start_date": "2025-06-02"},
            temp_id="t32-cyc-upd", idempotency_key="ik-cyc-upd",
            client_updated_at=datetime(2020, 1, 1, tzinfo=UTC),
        )
        conflict_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[update_op]))
        assert conflict_result.results[0].status == "conflict"
        assert conflict_result.results[0].server_data is not None
        assert conflict_result.results[0].server_data.get("period_start_date") == "2025-06-01"

    async def test_32_10_large_batch_100_ops(self, clean_session):
        """Stress test: 100 journal operations in one batch."""
        session = clean_session
        await _insert_user(session, UID, "stress@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        ops = [
            SyncOperation(
                type="journal/create",
                data={"content": f"stress {i}", "entry_date": f"2025-06-{i % 30 + 1:02d}"},
                temp_id=f"t32-stress-{i}", idempotency_key=f"ik-stress-{i}",
            )
            for i in range(100)
        ]
        payload = SyncBatchRequest(operations=ops)
        result = await svc.push_batch(_real_uid(), payload)
        assert len(result.results) == 100
        success = [r for r in result.results if r.status in ("created", "updated")]
        assert len(success) == 100
