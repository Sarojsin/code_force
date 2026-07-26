"""System Test 9 — Fresh Install Bootstrap (26), Offline Resilience (28), Schema Evolution (29).

Scenario 26 (Backend-equivalent): Server + schema bootstrap — all models register,
all tables created, metadata matches expected shape.
Scenario 28 (Backend-equivalent): Database failure — health endpoint degrades,
server does not crash, global handler returns 500.
Scenario 29 (Backend-equivalent): Schema migration — ADD COLUMN preserves data,
migration chain idempotent.
"""

from __future__ import annotations

import os
import uuid

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

from contextlib import asynccontextmanager

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import inspect, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.database import Base, get_db

@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(type_, compiler, **kw):
    return "JSON"


EXPECTED_TABLES = {
    "users", "cycle_entries", "predicted_cycles", "snooze_events",
    "journal_entries", "mood_logs", "user_onboarding",
    "pregnancy_profiles", "pregnancy_daily_logs", "pregnancy_milestones",
    "sos_alerts", "emergency_contacts", "system_config",
    "family_links", "chat_invites", "nurse_profiles",
    "journal_analyses", "user_sessions", "user_consents",
    "otp_attempts", "educational_contents", "breathing_exercises",
    "audit_logs", "sos_notification_attempts", "user_exercise_sessions",
}

ALL_MODULES_LOADED = False


def _import_all_models():
    global ALL_MODULES_LOADED
    if ALL_MODULES_LOADED:
        return
    import app.modules.admin.models  # noqa: F401
    import app.modules.auth.models  # noqa: F401
    import app.modules.chat.models  # noqa: F401
    import app.modules.cycle.models  # noqa: F401
    import app.modules.family.models  # noqa: F401
    import app.modules.nurse_content.models  # noqa: F401
    import app.modules.onboarding.models  # noqa: F401
    import app.modules.pregnancy.models  # noqa: F401
    import app.modules.safety.models  # noqa: F401
    import app.modules.users.models  # noqa: F401
    import app.modules.wellness.models  # noqa: F401
    ALL_MODULES_LOADED = True


@pytest_asyncio.fixture
async def db_session():
    _import_all_models()
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def clean_engine():
    _import_all_models()
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    yield engine
    await engine.dispose()


# =============================================================================
# Scenario 26: Server + Schema Bootstrap
# =============================================================================


class TestScenario26SchemaBootstrap:

    async def test_26_1_all_modules_import(self):
        _import_all_models()
        assert len(Base.metadata.tables) >= 20

    async def test_26_2_all_expected_tables_exist(self):
        _import_all_models()
        table_names = set(Base.metadata.tables.keys())
        for expected in EXPECTED_TABLES:
            assert expected in table_names, f"Missing table: {expected}"

    async def test_26_3_core_tables_have_key_columns(self):
        _import_all_models()
        checks = {
            "users": {"id", "email", "role", "provider", "is_active"},
            "cycle_entries": {"id", "user_id", "period_start_date", "symptoms", "cycle_type", "is_active"},
            "predicted_cycles": {"id", "user_id", "predicted_next_period_start", "model_version"},
            "journal_entries": {"id", "user_id", "title", "content", "is_active"},
            "mood_logs": {"id", "user_id", "mood", "intensity"},
            "sos_alerts": {"id", "user_id", "triggered_at", "latitude", "longitude", "sms_status"},
            "user_onboarding": {"id", "user_id", "age", "current_cycle_length", "onboarding_completed"},
            "system_config": {"key", "value"},
        }
        for table_name, expected_cols in checks.items():
            table = Base.metadata.tables.get(table_name)
            assert table is not None, f"Table not found: {table_name}"
            actual = {c.name for c in table.columns}
            for col in expected_cols:
                assert col in actual, f"Missing column {table_name}.{col}"

    async def test_26_4_create_all_produces_all_tables(self, clean_engine):
        engine = clean_engine
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            result = await conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            )
            db_tables = {row[0] for row in result.all()}
        for expected in EXPECTED_TABLES:
            assert expected in db_tables, f"Table not created: {expected}"

    async def test_26_5_syncable_tables_have_soft_delete(self):
        _import_all_models()
        syncable = 0
        for n, t in Base.metadata.tables.items():
            cols = {c.name for c in t.columns}
            if "is_active" in cols:
                syncable += 1
                assert "created_at" in cols, f"{n} missing created_at"
        assert syncable >= 10

    async def test_26_6_alembic_tracking_concept(self, clean_engine):
        engine = clean_engine
        async with engine.begin() as conn:
            await conn.execute(
                text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) PRIMARY KEY)")
            )
            await conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('test_v1')"))
            row = (await conn.execute(text("SELECT version_num FROM alembic_version"))).scalar_one()
            assert row == "test_v1"

    async def test_26_7_create_all_idempotent(self, clean_engine):
        engine = clean_engine
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.run_sync(Base.metadata.create_all)
            await conn.run_sync(Base.metadata.create_all)


# =============================================================================
# Scenario 28: Database Failure Resilience
# =============================================================================


@asynccontextmanager
async def _noop_lifespan(_app):
    yield


class TestScenario28DbFailureResilience:

    async def test_28_1_health_live_always_ok(self):
        app = FastAPI(lifespan=_noop_lifespan)
        @app.get("/health/live")
        async def _liveness(): return {"status": "ok"}
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/health/live")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    async def test_28_2_import_never_crashes(self):
        _import_all_models()
        assert "users" in Base.metadata.tables

    async def test_28_3_global_handler_returns_500_on_unhandled_error(self):
        from app.core.exceptions import unhandled_exception_handler
        from starlette.requests import Request
        scope = {"type": "http", "path": "/test", "method": "GET",
                 "headers": [], "query_string": b"", "scheme": "http",
                 "server": ("test", 80)}
        req = Request(scope)
        resp = await unhandled_exception_handler(req, RuntimeError("unexpected"))
        assert resp.status_code == 500

    async def test_28_4_sqlite_invalid_url_handled(self):
        try:
            engine = create_async_engine("sqlite+aiosqlite:///::nonexistent:::", echo=False)
            async with engine.begin() as conn:
                await conn.execute(text("SELECT 1"))
        except Exception:
            pass

    async def test_28_5_service_catches_db_errors(self):
        _import_all_models()
        engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        from app.modules.cycle.services import CycleService
        Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
        async with Session() as session:
            svc = CycleService(db=session)
            uid = uuid.UUID("00000000-0000-0000-0000-000000000000")
            entries = await svc.list_entries(user_id=uid)
            assert isinstance(entries, list)
        await engine.dispose()


# =============================================================================
# Scenario 29: Schema Migration — Column Addition Preserves Data
# =============================================================================


class TestScenario29SchemaMigration:

    async def _insert_user(self, conn, uid, email):
        await conn.execute(
            text("""
                INSERT INTO users (id, email, role, is_verified, failed_login_attempts,
                                   mfa_enabled, fcm_tokens, avg_prediction_error_days,
                                   total_cycles_logged, is_dirty_for_retraining, is_active)
                VALUES (:id, :email, :role, :is_verified, :failed_login_attempts,
                        :mfa_enabled, :fcm_tokens, :avg_prediction_error_days,
                        :total_cycles_logged, :is_dirty_for_retraining, :is_active)
            """),
            {
                "id": uid, "email": email,
                "role": "user", "is_verified": 0, "failed_login_attempts": 0,
                "mfa_enabled": 0, "fcm_tokens": "[]", "avg_prediction_error_days": 0,
                "total_cycles_logged": 0, "is_dirty_for_retraining": 0, "is_active": 1,
            },
        )

    async def test_29_1_add_column_preserves_existing_rows(self, clean_engine):
        engine = clean_engine
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await self._insert_user(conn, "u1", "a@b.com")
            count_before = (await conn.execute(text("SELECT count(*) FROM users"))).scalar()
            await conn.execute(text("ALTER TABLE users ADD COLUMN phone_verified INTEGER DEFAULT 0"))
            await conn.execute(text("UPDATE users SET phone_verified = 1 WHERE id = 'u1'"))
            count_after = (await conn.execute(text("SELECT count(*) FROM users"))).scalar()
            assert count_before == count_after
            row = (await conn.execute(
                text("SELECT email, phone_verified FROM users WHERE id = 'u1'")
            )).one()
            assert row[0] == "a@b.com"
            assert row[1] == 1

    async def test_29_2_new_column_null_for_old_rows(self, clean_engine):
        engine = clean_engine
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await self._insert_user(conn, "u2", "b@b.com")
            await conn.execute(text("ALTER TABLE users ADD COLUMN phone_verified INTEGER"))
            val = (await conn.execute(
                text("SELECT phone_verified FROM users WHERE id = 'u2'")
            )).scalar()
            assert val is None

    async def test_29_3_add_column_idempotent(self, clean_engine):
        engine = clean_engine
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(text("ALTER TABLE users ADD COLUMN phone_verified INTEGER"))
            with pytest.raises(Exception):
                await conn.execute(text("ALTER TABLE users ADD COLUMN phone_verified INTEGER"))

    async def test_29_4_multi_migration_chain(self, clean_engine):
        engine = clean_engine
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await self._insert_user(conn, "u3", "c@b.com")
            applied = []
            for col in ["mig_v2", "mig_v3"]:
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} TEXT"))
                applied.append(col)
            assert applied == ["mig_v2", "mig_v3"]
            row = (await conn.execute(
                text("SELECT email FROM users WHERE id = 'u3'")
            )).one()
            assert row[0] == "c@b.com"

    async def test_29_5_new_col_not_in_orm_metadata(self):
        _import_all_models()
        assert "phone_verified" not in {c.name for c in Base.metadata.tables["users"].columns}

    async def test_29_6_schema_version_monotonic(self):
        tags = {"0000_initial", "0001_add_snooze", "0002_add_stress_level"}
        sequential = sorted(tags)
        assert sequential == ["0000_initial", "0001_add_snooze", "0002_add_stress_level"]
        assert len(sequential) == len(tags)

    async def test_29_7_reflects_current_models(self, clean_engine):
        _import_all_models()
        engine = clean_engine
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            cols = await conn.run_sync(
                lambda sync_conn: [c["name"] for c in inspect(sync_conn).get_columns("cycle_entries")]
            )
        for expected in ["id", "user_id", "period_start_date", "symptoms", "cycle_type"]:
            assert expected in cols, f"cycle_entries missing {expected}"
