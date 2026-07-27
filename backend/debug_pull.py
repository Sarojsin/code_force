"""Debug script for pull_changes."""
import os
os.environ["DATABASE__URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["ENVIRONMENT"] = "test"
os.environ["JWT__SECRET_KEY"] = "test-key"
os.environ["JWT__REFRESH_SECRET_KEY"] = "test-refresh-key"
os.environ["ENCRYPTION__MASTER_KEY"] = "test-master-key-for-tests-only-32b"

import sys
print("step 1: imports", flush=True)

from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.ext.compiler import compiles

@compiles(PG_UUID, "sqlite")
def _(t, c, **kw):
    return "VARCHAR(32)"

@compiles(JSONB, "sqlite")
def _(t, c, **kw):
    return "JSON"

print("step 2: app imports", flush=True)
from app.core.database import Base

print("step 3: async setup", flush=True)

import asyncio
import uuid
from sqlalchemy import text, select, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


async def main():
    print("step 4: create engine", flush=True)
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    
    print("step 5: create tables", flush=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("step 6: create session", flush=True)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        print("step 7: insert data", flush=True)
        uid = "00000000-0000-0000-0000-000000000001"
        await session.execute(
            text(
                "INSERT INTO users (id, email, role, provider, is_verified, failed_login_attempts,"
                " mfa_enabled, fcm_tokens, avg_prediction_error_days, total_cycles_logged,"
                " is_dirty_for_retraining, is_active, user_secret_key)"
                " VALUES (:id, :email, :role, :provider, :iv, :fl, :mf, :fc, :ap, :tc, :idr, :ia, :usk)"
            ),
            {
                "id": uid, "email": "t@t.c", "role": "user", "provider": "local",
                "iv": 0, "fl": 0, "mf": 0, "fc": "[]", "ap": 0, "tc": 0,
                "idr": 0, "ia": 1, "usk": "test-s",
            },
        )
        await session.execute(
            text(
                "INSERT INTO cycle_entries (id, user_id, period_start_date, period_end_date,"
                " symptoms, mood_tags, cycle_type, is_correction, is_active, created_at, updated_at)"
                " VALUES (:id, :uid, :st, :en, :sy, :mo, :ct, :ic, 1, :ca, :ua)"
            ),
            {
                "id": "c1", "uid": uid, "st": "2025-01-01", "en": "2025-01-05",
                "sy": "[]", "mo": "[]", "ct": "menstrual", "ic": 0,
                "ca": "2025-01-01 00:00:00", "ua": "2025-01-01 00:00:00",
            },
        )
        await session.commit()
        
        print("step 8: direct count", flush=True)
        from app.modules.cycle.models import CycleEntry
        
        cnt = (await session.execute(select(func.count(CycleEntry.id)))).scalar()
        print(f"COUNT: {cnt}", flush=True)
        
        print("step 9: direct query", flush=True)
        r = await session.execute(select(CycleEntry))
        rows = r.scalars().all()
        print(f"ROWS: {len(rows)}", flush=True)
        if rows:
            r0 = rows[0]
            print(f"  user_id={r0.user_id!r} type={type(r0.user_id).__name__}", flush=True)
        
        print("step 10: pull_changes", flush=True)
        from app.modules.sync.services import SyncService
        
        svc = SyncService(db=session)
        try:
            pull = await svc.pull_changes(uuid.UUID(uid), limit=100)
            print(f"PULL: {len(pull.changes)} items", flush=True)
            if pull.changes:
                for c in pull.changes:
                    print(f"  type={c.entity_type} action={c.action}", flush=True)
            else:
                print("  (empty)", flush=True)
        except Exception as e:
            print(f"ERROR: {e}", flush=True)
            import traceback
            traceback.print_exc()
    
    print("step 11: done", flush=True)
    await engine.dispose()


asyncio.run(main())
