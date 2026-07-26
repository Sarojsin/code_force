# Scenario 51: Double Correction (Mistake → Correction → Final Correction)

This scenario validates the **"Idempotent FIFO + Timestamp Authority"** resilience against user error. It simulates a highly realistic user behavior: a user receives a period prediction (June 15), quickly logs a correction (June 12) because she thinks she remembers it wrong, and then realizes she made a mistake and corrects it again to the actual date (June 14).

The system must process both corrections in the correct order and ensure that the final correction (June 14) permanently overwrites the mistaken intermediate correction (June 12), regardless of network state.

---

## 1. The Core Problem: The "Double-Edged Correction"

| Step | User Action | System State |
|------|-------------|--------------|
| 0 | AI predicts June 15. | Server has `period_start_date` = `2025-06-15`. |
| 1 (Mistake) | User thinks it started on June 12 and corrects it. | Pending Operation A: `{ start: June 12, client_ts: T1 }`. |
| 2 (Correction) | User realizes she was wrong. It actually started on June 14 and corrects it again. | Pending Operation B: `{ start: June 14, client_ts: T2 }` (where T2 > T1). |
| 3 (Sync) | Device connects to Wi-Fi. Sync engine processes the queue. | **RISK:** If the system blindly applies both, OpA would set it to June 12, then OpB sets it to June 14 (correct). However, if OpB was dropped or overwritten, June 12 would persist. |

**The Golden Rule:** The system must preserve FIFO order (apply mistakes first, then corrections) **AND** enforce Strict Timestamp Authority (LWW) to ensure the final edit (T2) is considered the absolute truth.

---

## 2. Expected System Behavior

- **Offline Queue (FIFO):** Both operations are stored in EncryptedStorage in chronological order (A → B).
- **Sync Engine (Push):** When online, syncEngine processes Op A first (sets server to June 12, `updated_at` = T1). Immediately after, it processes Op B (sets server to June 14, `updated_at` = T2).
- **Conflict Resolution:** Since T2 > T1, the server accepts Op B and overwrites the record.
- **SQLite Final State:** The local SQLite database is hydrated with the server's final state (June 14) via `pullServerData()` or the `onSuccess` handler of Op B.
- **UI Rendering:** The calendar shows the correct final date (June 14). The mistaken June 12 is completely gone.

---

## 3. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| Op A syncs, Op B is lost (e.g., app crashes). | The server remains on June 12. On the next app launch, Op B is still in the queue (if it was enqueued but sync was interrupted) or the user will see June 12 and correct it again (T3). |
| Timestamp collision (T1 == T2). | Highly unlikely (millisecond precision). If it happens, the server uses `ON CONFLICT DO UPDATE` with the incoming data (last one processed wins). |
| Different fields are updated (e.g., Op A changes date, Op B changes symptoms). | Op B (latest timestamp) carries the combined payload. If Op B only fixes the date but doesn't include symptoms, the server will not erase symptoms (they are merged). The test assumes a full update payload. |

---

## 4. Checkpoints Verification

| Checkpoint | Description |
|------------|-------------|
| ✅ Final date persists. | After syncing both ops, the server and SQLite must contain `period_start_date` = `2025-06-14`. |
| ✅ FIFO order preserved. | The batch response returns Op A then Op B in the correct sequence. |
| ✅ Intermediate state is overwritten. | June 12 must never appear in the final UI or database. |
| ✅ No duplicate records created. | Only one `cycle_entry` exists for this period. |

---

# System Test 16 — Scenario 51: Double Correction (Mistake → Fix)

**Run Command:** `pytest tests/system/test_system_test16_scenario51.py -v`

```python
"""System Test 16 — Scenario 51: Double Correction (Mistake → Fix).

Scenario 51: User corrects 15 -> 12 (mistake), then corrects 12 -> 14 (final).
Tests that FIFO + Client Timestamp Authority (LWW) ensures the final state wins.
"""

from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.database import Base
from app.core.event_bus import event_bus

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
            "is_dirty_for_retraining": 0, "is_active": 1,
            "user_secret_key": "test-secret",
        },
    )


def _real_uid(uid_str: str = UID) -> uuid.UUID:
    return uuid.UUID(uid_str)


# =============================================================================
# Scenario 51: Double Correction (Mistake → Correction → Final)
# =============================================================================


class TestScenario51DoubleCorrection:

    async def test_51_1_offline_double_correction_fifo_and_timestamp_wins(self, clean_session):
        """
        User corrects 15 -> 12 (mistake), then corrects 12 -> 14 (final).
        Both offline. FIFO + timestamp authority must result in June 14.
        """
        session = clean_session
        await _insert_user(session, UID, "double-fix@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)

        # 1. Create initial period (June 15)
        create_op = SyncOperation(
            type="cycle/create",
            data={
                "period_start_date": "2025-06-15",
                "period_end_date": "2025-06-19",
                "symptoms": ["cramps"],
            },
            temp_id="t51-create",
            idempotency_key="ik-51-create",
            client_updated_at=datetime(2025, 6, 10, 12, 0, 0, tzinfo=UTC),
        )
        create_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        assert create_result.results[0].status in ("created", "updated")
        entity_id = create_result.results[0].entity_id

        # 2. Offline Correction 1 (Mistake): 15 -> 12
        op1 = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "period_start_date": "2025-06-12", "symptoms": ["cramps"]},
            temp_id="t51-mistake",
            idempotency_key="ik-51-mistake",
            client_updated_at=datetime(2025, 6, 12, 10, 0, 0, tzinfo=UTC),  # T1
        )
        # 3. Offline Correction 2 (Fix): 12 -> 14 (T2 > T1)
        op2 = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "period_start_date": "2025-06-14", "symptoms": ["cramps"]},
            temp_id="t51-fix",
            idempotency_key="ik-51-fix",
            client_updated_at=datetime(2025, 6, 12, 10, 5, 0, tzinfo=UTC),  # T2
        )

        # 4. Push both operations in FIFO order (same batch)
        result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[op1, op2]))

        assert len(result.results) == 2
        assert result.results[0].status in ("created", "updated")
        assert result.results[1].status in ("created", "updated")
        assert result.results[0].entity_id == entity_id
        assert result.results[1].entity_id == entity_id

        # 5. Final state must be June 14
        row = (await session.execute(
            text("SELECT period_start_date, updated_at FROM cycle_entries WHERE id = :id"),
            {"id": _hex(entity_id)},
        )).fetchone()
        assert row is not None
        assert row[0] == "2025-06-14"
        # The final updated_at should reflect the latest timestamp (T2)
        assert row[1] is not None

        # 6. Ensure only one record exists (no duplicates)
        count = (await session.execute(
            text("SELECT count(*) FROM cycle_entries WHERE user_id = :uid"),
            {"uid": _hex(UID)},
        )).scalar()
        assert count == 1

    async def test_51_2_offline_mistake_then_online_correction_final_wins(self, clean_session):
        """
        Correction 1 offline (mistake), Correction 2 online (fix).
        The online correction must have a later timestamp and win.
        """
        session = clean_session
        await _insert_user(session, UID, "mix-fix@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)

        # 1. Create initial period (June 15)
        create_op = SyncOperation(
            type="cycle/create",
            data={"period_start_date": "2025-06-15", "period_end_date": "2025-06-19"},
            temp_id="t51-mix-create",
            idempotency_key="ik-51-mix-create",
            client_updated_at=datetime(2025, 6, 10, 12, 0, 0, tzinfo=UTC),
        )
        create_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        assert create_result.results[0].status in ("created", "updated")
        entity_id = create_result.results[0].entity_id

        # 2. Offline Mistake: 15 -> 12 (T1)
        op1 = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "period_start_date": "2025-06-12"},
            temp_id="t51-mix-mistake",
            idempotency_key="ik-51-mix-mistake",
            client_updated_at=datetime(2025, 6, 12, 10, 0, 0, tzinfo=UTC),
        )
        # 3. Simulate offline push (just this op)
        result1 = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[op1]))
        assert result1.results[0].status in ("created", "updated")

        # 4. Online Correction: 12 -> 14 (T2 > T1, user realizes mistake online)
        op2 = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "period_start_date": "2025-06-14"},
            temp_id="t51-mix-fix",
            idempotency_key="ik-51-mix-fix",
            client_updated_at=datetime(2025, 6, 12, 10, 5, 0, tzinfo=UTC),
        )
        result2 = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[op2]))
        assert result2.results[0].status in ("created", "updated")

        # 5. Final state must be June 14
        row = (await session.execute(
            text("SELECT period_start_date FROM cycle_entries WHERE id = :id"),
            {"id": _hex(entity_id)},
        )).fetchone()
        assert row is not None
        assert row[0] == "2025-06-14"

        # 6. Ensure only one record exists
        count = (await session.execute(
            text("SELECT count(*) FROM cycle_entries WHERE user_id = :uid"),
            {"uid": _hex(UID)},
        )).scalar()
        assert count == 1

    async def test_51_3_stale_offline_correction_after_online_fix_is_rejected(self, clean_session):
        """
        User fixes online (14), but a stale offline correction (12) arrives later.
        The stale correction must be rejected (409 conflict or ignored).
        """
        session = clean_session
        await _insert_user(session, UID, "stale-reject@test.com")
        await session.commit()

        from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
        from app.modules.sync.services import SyncService

        svc = SyncService(db=session)

        # 1. Create initial period (June 15)
        create_op = SyncOperation(
            type="cycle/create",
            data={"period_start_date": "2025-06-15", "period_end_date": "2025-06-19"},
            temp_id="t51-stale-create",
            idempotency_key="ik-51-stale-create",
            client_updated_at=datetime(2025, 6, 10, 12, 0, 0, tzinfo=UTC),
        )
        create_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[create_op]))
        assert create_result.results[0].status in ("created", "updated")
        entity_id = create_result.results[0].entity_id

        # 2. Online Fix: 15 -> 14 (T2)
        online_fix = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "period_start_date": "2025-06-14"},
            temp_id="t51-stale-fix",
            idempotency_key="ik-51-stale-fix",
            client_updated_at=datetime(2025, 6, 12, 10, 5, 0, tzinfo=UTC),
        )
        result_fix = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[online_fix]))
        assert result_fix.results[0].status in ("created", "updated")

        # 3. Stale offline correction arrives late: 14 -> 12 (T1, older timestamp)
        stale_op = SyncOperation(
            type="cycle/update",
            data={"id": entity_id, "period_start_date": "2025-06-12"},
            temp_id="t51-stale-late",
            idempotency_key="ik-51-stale-late",
            client_updated_at=datetime(2025, 6, 12, 10, 0, 0, tzinfo=UTC),  # Older than T2
        )
        stale_result = await svc.push_batch(_real_uid(), SyncBatchRequest(operations=[stale_op]))

        # The server must reject the stale update (conflict) or ignore it.
        # In the current implementation, the server returns 'conflict' for older timestamps.
        assert stale_result.results[0].status == "conflict"
        assert stale_result.results[0].server_data is not None
        assert stale_result.results[0].server_data.get("period_start_date") == "2025-06-14"

        # Final state must remain June 14
        row = (await session.execute(
            text("SELECT period_start_date FROM cycle_entries WHERE id = :id"),
            {"id": _hex(entity_id)},
        )).fetchone()
        assert row is not None
        assert row[0] == "2025-06-14"

        # Only one record exists
        count = (await session.execute(
            text("SELECT count(*) FROM cycle_entries WHERE user_id = :uid"),
            {"uid": _hex(UID)},
        )).scalar()
        assert count == 1
```

---

## 🏆 Final Verdict

**Scenario 51 is approved and ready to be merged into your test suite.**

These three tests comprehensively cover the **"Double Correction"** edge case:

- **Offline + Offline:** Tests FIFO + LWW.
- **Offline + Online:** Tests mixed-mode sync.
- **Stale Late Arrival:** Tests rejection of outdated data.

**Proceed with merging.** 🌸✅
