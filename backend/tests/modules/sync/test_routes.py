from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

from contextlib import asynccontextmanager

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
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


@asynccontextmanager
async def _noop_lifespan(_app):
    yield


class _NoopRevocation:
    async def revoke(self, jti: str, ttl_seconds: int) -> None:
        return None
    async def is_revoked(self, jti: str) -> bool:
        return False


_TEST_USER_SECRET = "sync-test-secret-32characters!!!!!"


@pytest_asyncio.fixture
async def app_client() -> AsyncClient:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models  # noqa: F401
        from app.modules.wellness import models  # noqa: F401
        from app.modules.cycle import models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def _override_get_db():
        async with Session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    from app.modules.auth.models import User

    async with Session() as db:
        user = User(
            email="sync@test.com",
            display_name="Sync Tester",
            role="user",
            user_secret_key=_TEST_USER_SECRET,
            is_verified=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    from fastapi import FastAPI
    from fastapi.exceptions import RequestValidationError
    from starlette.exceptions import HTTPException as StarletteHTTPException

    from app.core.exceptions import (
        RateLimitError,
        SheCareError,
        http_exception_handler,
        shecare_exception_handler,
        validation_exception_handler,
    )
    from app.core.security import create_access_token, get_token_revocation_store
    from app.core.config import get_settings
    from app.modules.sync.routes import init_module as sync_init

    settings = get_settings()
    token, _, _ = create_access_token(
        user_id=user.id,
        email=user.email or "",
        role=user.role,
        user_secret_key=_TEST_USER_SECRET,
        settings=settings.jwt,
    )

    app = FastAPI(title="Sync (test)", lifespan=_noop_lifespan)
    sync_init(app, None)

    app.add_exception_handler(SheCareError, shecare_exception_handler)
    app.add_exception_handler(RateLimitError, shecare_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_token_revocation_store] = lambda: _NoopRevocation()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.headers["Authorization"] = f"Bearer {token}"
        client.test_user_id = user.id
        yield client

    await engine.dispose()


@pytest.mark.asyncio
async def test_sync_batch_journal_create(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/sync/batch",
        json={
            "operations": [
                {
                    "type": "journal/create",
                    "data": {"content": "Synced journal entry", "entry_date": "2026-06-01"},
                    "temp_id": "tmp-001",
                },
            ],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["results"]) == 1
    assert body["results"][0]["status"] == "created"
    assert body["results"][0]["temp_id"] == "tmp-001"
    assert body["results"][0]["entity_id"] is not None


@pytest.mark.asyncio
async def test_sync_batch_mood_create(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/sync/batch",
        json={
            "operations": [
                {
                    "type": "mood/create",
                    "data": {"mood": "happy", "intensity": 8},
                    "temp_id": "tmp-mood-1",
                },
            ],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["results"][0]["status"] == "created"


@pytest.mark.asyncio
async def test_sync_batch_cycle_create(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/sync/batch",
        json={
            "operations": [
                {
                    "type": "cycle/create",
                    "data": {
                        "period_start_date": "2026-05-01",
                        "period_end_date": "2026-05-05",
                        "flow_intensity": "medium",
                        "symptoms": ["cramps"],
                    },
                    "temp_id": "tmp-cycle-1",
                },
            ],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["results"][0]["status"] == "created"


@pytest.mark.asyncio
async def test_sync_batch_unknown_type(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/sync/batch",
        json={
            "operations": [
                {
                    "type": "pregnancy_daily_log/create",
                    "data": {},
                    "temp_id": "tmp-bad",
                },
            ],
        },
    )
    assert resp.status_code == 200
    assert resp.json()["results"][0]["status"] == "failed"


@pytest.mark.asyncio
async def test_sync_batch_idempotency(app_client: AsyncClient) -> None:
    payload = {
        "operations": [
            {
                "type": "journal/create",
                "data": {"content": "Idempotent entry"},
                "temp_id": "tmp-ip",
                "idempotency_key": "sync-ip-key-1",
            },
        ],
    }
    r1 = await app_client.post("/api/v1/sync/batch", json=payload)
    assert r1.json()["results"][0]["status"] == "created"
    r2 = await app_client.post("/api/v1/sync/batch", json=payload)
    assert r2.json()["results"][0]["status"] == "created"


@pytest.mark.asyncio
async def test_sync_pull_changes(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/sync/batch",
        json={
            "operations": [
                {
                    "type": "journal/create",
                    "data": {"content": "Pull test entry", "entry_date": "2026-06-15"},
                    "temp_id": "tmp-pull",
                },
            ],
        },
    )
    resp = await app_client.get("/api/v1/sync/changes")
    assert resp.status_code == 200
    body = resp.json()
    assert "changes" in body
    assert "has_more" in body
    assert len(body["changes"]) >= 1


@pytest.mark.asyncio
async def test_sync_pull_changes_empty(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/sync/changes")
    assert resp.status_code == 200
    assert resp.json()["changes"] == []
    assert resp.json()["has_more"] is False


@pytest.mark.asyncio
async def test_unauthenticated_returns_401(app_client: AsyncClient) -> None:
    app_client.headers.pop("Authorization", None)
    resp = await app_client.get("/api/v1/sync/changes")
    assert resp.status_code == 401
