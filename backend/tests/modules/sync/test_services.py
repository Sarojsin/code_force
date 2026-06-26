from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(type_, compiler, **kw):
    return "JSON"


from app.core.database import Base
from app.modules.sync.schemas import SyncBatchRequest, SyncOperation
from app.modules.sync.services import SyncService


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.wellness import models as wellness_models  # noqa: F401
        from app.modules.cycle import models as cycle_models  # noqa: F401
        from app.modules.auth import models as auth_models  # noqa: F401
        from app.modules.users import models as users_models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> SyncService:
    return SyncService(db=db_session)


user_id = uuid.uuid4()


@pytest.mark.asyncio
async def test_push_batch_creates_journal_entry(svc: SyncService) -> None:
    op = SyncOperation(
        type="journal/create",
        data={"content": "Test entry", "entry_date": "2025-06-01"},
        temp_id="tmp1",
    )
    resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[op]))
    assert len(resp.results) == 1
    assert resp.results[0].status == "created"
    assert resp.results[0].entity_id is not None
    assert resp.results[0].temp_id == "tmp1"


@pytest.mark.asyncio
async def test_push_batch_creates_mood_log(svc: SyncService) -> None:
    op = SyncOperation(
        type="mood/create",
        data={"mood": "happy", "intensity": 4},
        temp_id="tmp2",
    )
    resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[op]))
    assert len(resp.results) == 1
    assert resp.results[0].status == "created"


@pytest.mark.asyncio
async def test_push_batch_creates_cycle_entry(svc: SyncService) -> None:
    op = SyncOperation(
        type="cycle/create",
        data={"period_start_date": "2025-06-01", "flow_intensity": "medium"},
        temp_id="tmp3",
    )
    resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[op]))
    assert len(resp.results) == 1
    assert resp.results[0].status == "created"


@pytest.mark.asyncio
async def test_push_batch_updates_journal_entry(svc: SyncService) -> None:
    create_op = SyncOperation(
        type="journal/create",
        data={"content": "Original", "entry_date": "2025-06-01"},
        temp_id="tmp4",
    )
    create_resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[create_op]))
    entity_id = create_resp.results[0].entity_id

    update_op = SyncOperation(
        type="journal/update",
        data={"id": entity_id, "content": "Updated"},
    )
    resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[update_op]))
    assert resp.results[0].status == "updated"


@pytest.mark.asyncio
async def test_push_batch_updates_cycle_entry(svc: SyncService) -> None:
    create_op = SyncOperation(
        type="cycle/create",
        data={"period_start_date": "2025-06-01"},
        temp_id="tmp5",
    )
    create_resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[create_op]))
    entity_id = create_resp.results[0].entity_id

    update_op = SyncOperation(
        type="cycle/update",
        data={"id": entity_id, "flow_intensity": "heavy"},
    )
    resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[update_op]))
    assert resp.results[0].status == "updated"


@pytest.mark.asyncio
async def test_push_batch_deletes_journal_entry(svc: SyncService) -> None:
    create_op = SyncOperation(
        type="journal/create",
        data={"content": "To delete", "entry_date": "2025-06-01"},
        temp_id="tmp6",
    )
    create_resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[create_op]))
    entity_id = create_resp.results[0].entity_id

    delete_op = SyncOperation(
        type="journal/delete",
        data={"id": entity_id},
    )
    resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[delete_op]))
    assert resp.results[0].status == "deleted"


@pytest.mark.asyncio
async def test_delete_already_deleted_returns_deleted(svc: SyncService) -> None:
    create_op = SyncOperation(
        type="journal/create",
        data={"content": "Ghost", "entry_date": "2025-06-01"},
        temp_id="tmp7",
    )
    create_resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[create_op]))
    entity_id = create_resp.results[0].entity_id

    delete_op = SyncOperation(type="journal/delete", data={"id": entity_id})
    await svc.push_batch(user_id, SyncBatchRequest(operations=[delete_op]))
    resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[delete_op]))
    assert resp.results[0].status == "deleted"


@pytest.mark.asyncio
async def test_delete_cycle_entry(svc: SyncService) -> None:
    create_op = SyncOperation(
        type="cycle/create",
        data={"period_start_date": "2025-06-01"},
        temp_id="tmp8",
    )
    create_resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[create_op]))
    entity_id = create_resp.results[0].entity_id

    delete_op = SyncOperation(type="cycle/delete", data={"id": entity_id})
    resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[delete_op]))
    assert resp.results[0].status == "deleted"


@pytest.mark.asyncio
async def test_unknown_type_returns_failed(svc: SyncService) -> None:
    op = SyncOperation.model_construct(type="unknown/type", data={}, temp_id="tmp9")
    resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[op]))
    assert resp.results[0].status == "failed"
    assert "Unknown type" in (resp.results[0].error or "")


@pytest.mark.asyncio
async def test_idempotency_key_returns_cached(svc: SyncService) -> None:
    op = SyncOperation(
        type="journal/create",
        data={"content": "Idempotent", "entry_date": "2025-06-01"},
        temp_id="tmp10",
        idempotency_key="key1",
    )
    resp1 = await svc.push_batch(user_id, SyncBatchRequest(operations=[op]))
    op2 = SyncOperation(
        type="journal/create",
        data={"content": "Idempotent", "entry_date": "2025-06-01"},
        temp_id="tmp10",
        idempotency_key="key1",
    )
    resp2 = await svc.push_batch(user_id, SyncBatchRequest(operations=[op2]))
    assert resp2.results[0].entity_id == resp1.results[0].entity_id
    assert resp2.results[0].status == resp1.results[0].status


@pytest.mark.asyncio
async def test_conflict_detected_with_stale_client_ts(svc: SyncService) -> None:
    create_op = SyncOperation(
        type="journal/create",
        data={"content": "Conflict test", "entry_date": "2025-06-01"},
        temp_id="tmp11",
    )
    create_resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[create_op]))
    entity_id = create_resp.results[0].entity_id
    old_time = (datetime.now(UTC) - timedelta(hours=1)).isoformat()

    update_op = SyncOperation(
        type="journal/update",
        data={"id": entity_id, "content": "Server update"},
    )
    await svc.push_batch(user_id, SyncBatchRequest(operations=[update_op]))

    stale_op = SyncOperation(
        type="journal/update",
        data={"id": entity_id, "content": "Stale update"},
        client_updated_at=old_time,
    )
    resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[stale_op]))
    assert resp.results[0].status == "conflict"
    assert resp.conflicts[0].status == "conflict"
    assert resp.conflicts[0].server_data is not None


@pytest.mark.asyncio
async def test_update_not_found_returns_failed(svc: SyncService) -> None:
    fake_id = str(uuid.uuid4())
    op = SyncOperation(type="journal/update", data={"id": fake_id, "content": "Nope"})
    resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[op]))
    assert resp.results[0].status == "failed"
    assert resp.results[0].error == "Not found"


@pytest.mark.asyncio
async def test_cycle_update_not_found_returns_failed(svc: SyncService) -> None:
    fake_id = str(uuid.uuid4())
    op = SyncOperation(type="cycle/update", data={"id": fake_id})
    resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[op]))
    assert resp.results[0].status == "failed"


@pytest.mark.asyncio
async def test_pull_changes_returns_created(svc: SyncService) -> None:
    op = SyncOperation(
        type="journal/create",
        data={"content": "Pull me", "entry_date": "2025-06-01"},
        temp_id="tmp12",
    )
    await svc.push_batch(user_id, SyncBatchRequest(operations=[op]))

    pull_resp = await svc.pull_changes(user_id)
    assert len(pull_resp.changes) >= 1
    journal_changes = [c for c in pull_resp.changes if c.entity_type == "journal"]
    assert len(journal_changes) >= 1
    assert journal_changes[0].action == "created"


@pytest.mark.asyncio
async def test_pull_changes_with_since(svc: SyncService) -> None:
    op = SyncOperation(
        type="mood/create",
        data={"mood": "sad", "intensity": 2},
        temp_id="tmp13",
    )
    await svc.push_batch(user_id, SyncBatchRequest(operations=[op]))

    future = datetime.now(UTC) + timedelta(days=7)
    pull_resp = await svc.pull_changes(user_id, since=future)
    assert len(pull_resp.changes) == 0


@pytest.mark.asyncio
async def test_pull_changes_with_deleted_entry(svc: SyncService) -> None:
    create_op = SyncOperation(
        type="journal/create",
        data={"content": "To pull delete", "entry_date": "2025-06-01"},
        temp_id="tmp14",
    )
    create_resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[create_op]))
    entity_id = create_resp.results[0].entity_id

    delete_op = SyncOperation(type="journal/delete", data={"id": entity_id})
    await svc.push_batch(user_id, SyncBatchRequest(operations=[delete_op]))

    pull_resp = await svc.pull_changes(user_id)
    deleted = [c for c in pull_resp.changes if c.action == "deleted"]
    assert len(deleted) >= 1


@pytest.mark.asyncio
async def test_clamp_future_timestamp(svc: SyncService) -> None:
    far_future = datetime.now(UTC) + timedelta(days=1)
    clamped = svc._clamp_client_ts(far_future)
    assert clamped is not None
    assert clamped <= datetime.now(UTC) + timedelta(seconds=1)


@pytest.mark.asyncio
async def test_clamp_none_ts(svc: SyncService) -> None:
    assert svc._clamp_client_ts(None) is None


@pytest.mark.asyncio
async def test_pull_changes_includes_cycle_and_mood(svc: SyncService) -> None:
    ops = [
        SyncOperation(type="journal/create", data={"content": "J1", "entry_date": "2025-06-01"}, temp_id="t1"),
        SyncOperation(type="mood/create", data={"mood": "happy"}, temp_id="t2"),
        SyncOperation(type="cycle/create", data={"period_start_date": "2025-06-01"}, temp_id="t3"),
    ]
    await svc.push_batch(user_id, SyncBatchRequest(operations=ops))

    pull_resp = await svc.pull_changes(user_id)
    entity_types = {c.entity_type for c in pull_resp.changes}
    assert "journal" in entity_types, f"got {entity_types}"
    assert "mood" in entity_types
    assert "cycle" in entity_types


@pytest.mark.asyncio
async def test_multiple_ops_in_single_batch(svc: SyncService) -> None:
    ops = [
        SyncOperation(type="journal/create", data={"content": "A", "entry_date": "2025-06-01"}, temp_id="ta"),
        SyncOperation(type="journal/create", data={"content": "B", "entry_date": "2025-06-01"}, temp_id="tb"),
        SyncOperation(type="mood/create", data={"mood": "great"}, temp_id="tc"),
    ]
    resp = await svc.push_batch(user_id, SyncBatchRequest(operations=ops))
    assert len(resp.results) == 3
    assert all(r.status == "created" for r in resp.results)


@pytest.mark.asyncio
async def test_no_conflicts_when_no_changes(svc: SyncService) -> None:
    op = SyncOperation(
        type="journal/create",
        data={"content": "No conflict", "entry_date": "2025-06-01"},
        temp_id="tnc",
    )
    resp = await svc.push_batch(user_id, SyncBatchRequest(operations=[op]))
    assert len(resp.conflicts) == 0
