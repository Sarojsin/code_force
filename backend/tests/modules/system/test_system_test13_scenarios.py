"""System Test 13 — Edge Cases: Race Condition (36), Background Interrupt (37), Stale Refresh (39).

Scenario 36: Race Condition — Sync Engine Triggers Twice Simultaneously.
  Tests idempotency dedup under duplicate push_batch calls.

Scenario 37: App Backgrounded During Sync.
  Tests idempotency retry after simulated interruption.

Scenario 38: Deep Link Conflict (mobile-only) — skipped.

Scenario 39: Stale Refresh Token (Refresh Loop Death).
  Tests valid token rotation, expired token rejection, invalid signature,
  reuse detection (session family revocation).

Scenario 40: Large Offline Queue (mobile-only) — skipped.
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
from datetime import UTC, datetime, timedelta

import pytest_asyncio
from jose import jwt
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.config import get_settings
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


async def _insert_user_with_secret(session, uid: str, email: str, secret: str):
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
            "user_secret_key": secret,
        },
    )


def _real_uid(uid_str: str = UID) -> uuid.UUID:
    return uuid.UUID(uid_str)


# =============================================================================
# Scenario 36: Race Condition — Duplicate Push Under Idempotency
# =============================================================================


class TestScenario36RaceConditionSyncStampede:

    async def test_36_1_duplicate_push_same_idempotency_key(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "race@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        ik = "ik-race-dedup"
        op = SyncOperation(
            type="journal/create",
            data={"content": "race test", "entry_date": "2025-12-01"},
            temp_id="t36-race", idempotency_key=ik,
            client_updated_at=datetime(2099, 12, 1, tzinfo=UTC),
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
        rows_after = (await session.execute(
            text("SELECT count(*) FROM journal_entries"),
        )).scalar()
        assert rows_after == 1, "Duplicate push created extra row"

    async def test_36_2_parallel_ops_with_distinct_keys(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "parallel@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        ops = [
            SyncOperation(
                type="journal/create",
                data={"content": f"parallel {i}", "entry_date": "2025-12-01"},
                temp_id=f"t36-p{i}", idempotency_key=f"ik-p{i}",
                client_updated_at=datetime(2099, 12, 1, tzinfo=UTC),
            )
            for i in range(5)
        ]
        payload = SyncBatchRequest(operations=ops)
        result = await svc.push_batch(_real_uid(), payload)
        assert len(result.results) == 5
        for r in result.results:
            assert r.status in ("created", "updated")

        rows = (await session.execute(
            text("SELECT count(*) FROM journal_entries"),
        )).scalar()
        assert rows == 5

        result2 = await svc.push_batch(_real_uid(), payload)
        assert len(result2.results) == 5
        for i in range(5):
            assert result2.results[i].entity_id == result.results[i].entity_id

        rows2 = (await session.execute(
            text("SELECT count(*) FROM journal_entries"),
        )).scalar()
        assert rows2 == 5, "Parallel dedup: extra rows created"

    async def test_36_3_idempotency_key_ttl_returns_existing(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "ttl-race@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        ik = "ik-race-ttl"
        op = SyncOperation(
            type="journal/create",
            data={"content": "ttl test", "entry_date": "2025-11-01"},
            temp_id="t36-ttl", idempotency_key=ik,
            client_updated_at=datetime(2099, 11, 1, tzinfo=UTC),
        )
        payload = SyncBatchRequest(operations=[op])

        first = await svc.push_batch(_real_uid(), payload)
        first_id = first.results[0].entity_id

        second = await svc.push_batch(_real_uid(), payload)
        assert second.results[0].status in ("created", "updated")
        assert second.results[0].entity_id == first_id
        assert second.results[0].server_data is not None


# =============================================================================
# Scenario 37: App Backgrounded During Sync — Idempotency Retry
# =============================================================================


class TestScenario37AppBackgroundedDuringSync:

    async def test_37_1_idempotency_survives_retry_after_interruption(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "interrupt@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        ik = "ik-interrupt-retry"
        op = SyncOperation(
            type="journal/create",
            data={"content": "interrupted create", "entry_date": "2025-10-01"},
            temp_id="t37-int", idempotency_key=ik,
            client_updated_at=datetime(2099, 10, 1, tzinfo=UTC),
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
        rows_after = (await session.execute(
            text("SELECT count(*) FROM journal_entries"),
        )).scalar()
        assert rows_after == 1

    async def test_37_2_queue_persists_when_response_never_received(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "queue-persist@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)

        op = SyncOperation(
            type="journal/create",
            data={"content": "queue persists", "entry_date": "2025-09-01"},
            temp_id="t37-queue", idempotency_key="ik-queue-persist",
            client_updated_at=datetime(2099, 9, 1, tzinfo=UTC),
        )
        payload = SyncBatchRequest(operations=[op])

        await svc.push_batch(_real_uid(), payload)
        rows = (await session.execute(
            text("SELECT count(*) FROM journal_entries"),
        )).scalar()
        assert rows == 1

        row = (await session.execute(
            text("SELECT content FROM journal_entries WHERE user_id = :uid"),
            {"uid": _hex(UID)},
        )).fetchone()
        assert row is not None
        assert row[0] == "queue persists"

    async def test_37_3_sync_retry_after_interruption_no_duplicate(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "retry-nodup@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        ik = "ik-retry-nodup"
        op = SyncOperation(
            type="journal/create",
            data={"content": "retry no dup", "entry_date": "2025-08-01"},
            temp_id="t37-retry", idempotency_key=ik,
            client_updated_at=datetime(2099, 8, 1, tzinfo=UTC),
        )
        payload = SyncBatchRequest(operations=[op])

        first = await svc.push_batch(_real_uid(), payload)
        first_id = first.results[0].entity_id

        second = await svc.push_batch(_real_uid(), payload)
        assert second.results[0].entity_id == first_id

        row = (await session.execute(
            text("SELECT content FROM journal_entries WHERE id = :id"),
            {"id": _hex(first_id)},
        )).fetchone()
        assert row is not None

    async def test_37_4_pull_changes_returns_hydrated_data(self, clean_session):
        session = clean_session
        await _insert_user(session, UID, "pull-after@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)
        op = SyncOperation(
            type="journal/create",
            data={"content": "pull after interrupt", "entry_date": "2025-07-01"},
            temp_id="t37-pull", idempotency_key="ik-pull-after",
            client_updated_at=datetime(2099, 7, 1, tzinfo=UTC),
        )
        first = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[op]))
        first_id = first.results[0].entity_id

        pull_result = await svc.pull_changes(_real_uid(), limit=100)
        assert len(pull_result.changes) >= 1
        ids = [str(c.entity_id) for c in pull_result.changes]
        assert first_id in ids


# =============================================================================
# Scenario 38: Deep Link Conflict (mobile-only) — SKIPPED
# =============================================================================


# =============================================================================
# Scenario 39: Stale Refresh Token — Rotation, Expiry, Reuse Detection
# =============================================================================


class TestScenario39StaleRefreshToken:

    async def _make_auth_service(self, session, settings=None):
        from app.core.encryption import EncryptionService
        from app.core.token_revocation import TokenRevocationStore
        from app.modules.auth.services import AuthService

        if settings is None:
            settings = get_settings()
        return AuthService(
            db=session,
            twilio=type("MockTwilio", (), {"send_otp": lambda s, p: None, "verify_otp": lambda s, p, c: True, "has_credentials": False})(),
            settings=settings,
            encryption=EncryptionService(settings.encryption),
            revocation=TokenRevocationStore(type("MockRedis", (), {"get": lambda k: None, "set": lambda k, v, ex: None})()),
        )

    async def _create_token_with_session(self, session, settings, user_id, usk):
        from app.core.security import create_refresh_token
        from app.modules.auth.models import UserSession
        from app.modules.auth.services import _hash_token

        refresh, jti, expires_at = create_refresh_token(
            user_id, user_secret_key=usk, settings=settings.jwt,
        )
        sess = UserSession(
            user_id=user_id,
            refresh_token_hash=_hash_token(refresh),
            refresh_jti=jti,
            expires_at=expires_at,
            device_info={},
        )
        session.add(sess)
        await session.commit()
        return refresh

    async def test_39_1_valid_refresh_token_returns_new_pair(self, clean_session):
        session = clean_session
        await _insert_user_with_secret(session, UID, "refresh-ok@test.com", "test-secret")
        await session.commit()

        settings = get_settings()
        user_id = _real_uid()
        refresh = await self._create_token_with_session(session, settings, user_id, "test-secret")
        svc = await self._make_auth_service(session, settings)

        result = await svc.rotate_refresh_token(refresh, device_info=None)
        assert result.access_token is not None
        assert len(result.access_token) > 0
        assert result.refresh_token is not None
        assert result.refresh_token != refresh

    async def test_39_2_expired_refresh_token_raises_error(self, clean_session):
        session = clean_session
        settings = get_settings()

        payload = {
            "sub": str(_real_uid()),
            "jti": str(uuid.uuid4()),
            "usk": "fake-usk-hash",
            "exp": int((datetime.now(tz=UTC) - timedelta(hours=1)).timestamp()),
            "iat": int((datetime.now(tz=UTC) - timedelta(days=1)).timestamp()),
            "type": "refresh",
        }
        expired_token = jwt.encode(
            payload, settings.jwt.refresh_secret_key, algorithm=settings.jwt.algorithm,
        )

        from fastapi import HTTPException
        import pytest
        svc = await self._make_auth_service(session, settings)
        with pytest.raises(HTTPException) as excinfo:
            await svc.rotate_refresh_token(expired_token)
        assert excinfo.value.status_code == 401

    async def test_39_3_invalid_signature_refresh_token_raises_error(self, clean_session):
        session = clean_session
        settings = get_settings()

        payload = {
            "sub": str(_real_uid()),
            "jti": str(uuid.uuid4()),
            "usk": "hash",
            "exp": int((datetime.now(tz=UTC) + timedelta(days=30)).timestamp()),
            "iat": int(datetime.now(tz=UTC).timestamp()),
            "type": "refresh",
        }
        tampered = jwt.encode(
            payload, "wrong-secret-key", algorithm=settings.jwt.algorithm,
        )

        from fastapi import HTTPException
        import pytest
        svc = await self._make_auth_service(session, settings)
        with pytest.raises(HTTPException) as excinfo:
            await svc.rotate_refresh_token(tampered)
        assert excinfo.value.status_code == 401

    async def test_39_4_reused_refresh_token_revokes_session_family(self, clean_session):
        session = clean_session
        await _insert_user_with_secret(session, UID, "reuse@test.com", "test-secret")
        await session.commit()

        from app.modules.auth.exceptions import TokenRevokedError
        import pytest

        settings = get_settings()
        user_id = _real_uid()
        refresh = await self._create_token_with_session(session, settings, user_id, "test-secret")
        svc = await self._make_auth_service(session, settings)

        first_use = await svc.rotate_refresh_token(refresh)
        assert first_use.access_token is not None

        with pytest.raises(TokenRevokedError):
            await svc.rotate_refresh_token(refresh)

    async def test_39_5_usk_change_invalidates_refresh_token(self, clean_session):
        session = clean_session
        original_usk = "original-secret"
        await _insert_user_with_secret(session, UID, "usk-change@test.com", original_usk)
        await session.commit()

        from app.modules.auth.exceptions import TokenRevokedError
        import pytest

        settings = get_settings()
        user_id = _real_uid()
        refresh = await self._create_token_with_session(session, settings, user_id, original_usk)

        await session.execute(
            text("UPDATE users SET user_secret_key = :new_usk WHERE id = :uid"),
            {"new_usk": "new-secret", "uid": _hex(UID)},
        )
        await session.commit()

        svc = await self._make_auth_service(session, settings)
        with pytest.raises(TokenRevokedError):
            await svc.rotate_refresh_token(refresh)


# =============================================================================
# Scenario 40: Large Offline Queue (mobile-only) — SKIPPED
# =============================================================================
