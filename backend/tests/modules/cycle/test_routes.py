"""Cycle HTTP route integration tests.

Exercises the request/response cycle across all cycle endpoints using
real JWT tokens with a no-op revocation store (to avoid Redis).
Each test gets a fresh in-memory SQLite DB and authed client.
"""

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


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(type_, compiler, **kw):
    return "JSON"


from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.core.config import get_settings
from app.modules.auth.models import User


class _NoopRevocation:
    async def revoke(self, jti: str, ttl_seconds: int) -> None:
        return None

    async def is_revoked(self, jti: str) -> bool:
        return False


class _MockEventBus:
    def subscribe_sync(self, event: str, handler) -> None:
        pass


@asynccontextmanager
async def _noop_lifespan(_app):
    yield


@pytest_asyncio.fixture
async def app_client() -> AsyncClient:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models as _auth_models  # noqa: F401
        from app.modules.cycle import models as _cycle_models  # noqa: F401
        from app.modules.onboarding import models as _onboard_models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def _override_get_db():
        async with Session() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    from fastapi import FastAPI

    app = FastAPI(title="SheCare Cycle (test)", lifespan=_noop_lifespan)
    from app.modules.cycle.routes import init_module as cycle_init

    cycle_init(app, _MockEventBus())

    from fastapi.exceptions import RequestValidationError
    from starlette.exceptions import HTTPException as StarletteHTTPException

    from app.core.exceptions import (
        RateLimitError,
        SheCareError,
        http_exception_handler,
        shecare_exception_handler,
        validation_exception_handler,
    )

    app.add_exception_handler(SheCareError, shecare_exception_handler)
    app.add_exception_handler(RateLimitError, shecare_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    app.dependency_overrides[get_db] = _override_get_db

    from app.core.security import get_token_revocation_store

    app.dependency_overrides[get_token_revocation_store] = lambda: _NoopRevocation()

    async with Session() as db:
        user1 = User(
            email="cycle1@test.com", provider="local", user_secret_key="a" * 64,
        )
        user2 = User(
            email="cycle2@test.com", provider="local", user_secret_key="b" * 64,
        )
        db.add(user1)
        db.add(user2)
        await db.commit()
        await db.refresh(user1)
        await db.refresh(user2)

        settings = get_settings().jwt
        token1, _, _ = create_access_token(
            user_id=user1.id,
            email=user1.email or "",
            role=user1.role,
            user_secret_key=user1.user_secret_key,
            settings=settings,
        )
        token2, _, _ = create_access_token(
            user_id=user2.id,
            email=user2.email or "",
            role=user2.role,
            user_secret_key=user2.user_secret_key,
            settings=settings,
        )

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={"Authorization": f"Bearer {token1}"},
    ) as client:
        client.test_user = user1
        client.test_token = token1
        client.test_user2 = user2
        client.test_token2 = token2
        yield client

    await engine.dispose()


# ---- Happy-path: entries CRUD ----


@pytest.mark.asyncio
async def test_create_entry_201(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/cycle/entries",
        json={
            "period_start_date": "2026-05-01",
            "period_end_date": "2026-05-05",
            "flow_intensity": "medium",
            "symptoms": ["cramps"],
            "mood_tags": ["happy"],
            "energy_level": 3,
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["period_start_date"] == "2026-05-01"
    assert body["period_end_date"] == "2026-05-05"
    assert body["flow_intensity"] == "medium"
    assert body["symptoms"] == ["cramps"]
    assert body["mood_tags"] == ["happy"]
    assert body["energy_level"] == 3
    assert body["user_id"] == str(app_client.test_user.id)


@pytest.mark.asyncio
async def test_create_entry_minimal_201(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/cycle/entries",
        json={"period_start_date": "2026-05-01"},
    )
    assert resp.status_code == 201
    assert resp.json()["period_start_date"] == "2026-05-01"


@pytest.mark.asyncio
async def test_create_entry_upsert_200(app_client: AsyncClient) -> None:
    resp1 = await app_client.post(
        "/api/v1/cycle/entries",
        json={"period_start_date": "2026-05-01", "flow_intensity": "light"},
    )
    assert resp1.status_code == 201
    resp2 = await app_client.post(
        "/api/v1/cycle/entries",
        json={"period_start_date": "2026-05-01", "flow_intensity": "heavy"},
    )
    assert resp2.status_code == 201
    assert resp2.json()["id"] == resp1.json()["id"]
    assert resp2.json()["flow_intensity"] == "heavy"


@pytest.mark.asyncio
async def test_list_entries_200(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/cycle/entries",
        json={"period_start_date": "2026-05-01", "period_end_date": "2026-05-05"},
    )
    await app_client.post(
        "/api/v1/cycle/entries",
        json={"period_start_date": "2026-06-01", "period_end_date": "2026-06-05"},
    )
    resp = await app_client.get("/api/v1/cycle/entries")
    assert resp.status_code == 200
    assert len(resp.json()) >= 2


@pytest.mark.asyncio
async def test_get_entry_200(app_client: AsyncClient) -> None:
    create = await app_client.post(
        "/api/v1/cycle/entries",
        json={"period_start_date": "2026-05-01", "period_end_date": "2026-05-05"},
    )
    entry_id = create.json()["id"]
    resp = await app_client.get(f"/api/v1/cycle/entries/{entry_id}")
    assert resp.status_code == 200
    assert resp.json()["id"] == entry_id


@pytest.mark.asyncio
async def test_update_entry_200(app_client: AsyncClient) -> None:
    create = await app_client.post(
        "/api/v1/cycle/entries",
        json={"period_start_date": "2026-05-01"},
    )
    entry_id = create.json()["id"]
    resp = await app_client.put(
        f"/api/v1/cycle/entries/{entry_id}",
        json={"flow_intensity": "heavy", "notes": "Updated"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["flow_intensity"] == "heavy"
    assert body["notes"] == "Updated"
    assert body["period_start_date"] == "2026-05-01"


@pytest.mark.asyncio
async def test_delete_entry_204(app_client: AsyncClient) -> None:
    create = await app_client.post(
        "/api/v1/cycle/entries",
        json={"period_start_date": "2026-05-01"},
    )
    entry_id = create.json()["id"]
    resp = await app_client.delete(f"/api/v1/cycle/entries/{entry_id}")
    assert resp.status_code == 204

    get_resp = await app_client.get(f"/api/v1/cycle/entries/{entry_id}")
    assert get_resp.status_code == 404


# ---- Happy-path: predictions, analytics, calendar ----


@pytest.mark.asyncio
async def test_get_predictions_empty_404(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/cycle/predictions")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_analytics_empty_200(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/cycle/analytics")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_entries"] == 0
    assert body["average_cycle_length_days"] is None


@pytest.mark.asyncio
async def test_get_calendar_200(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/cycle/calendar")
    assert resp.status_code == 200
    body = resp.json()
    assert "days" in body
    assert isinstance(body["days"], dict)


# ---- Happy-path: corrections & snooze ----


@pytest.mark.asyncio
async def test_create_correction_201(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/cycle/corrections",
        json={
            "period_start_date": "2026-07-01",
            "period_end_date": "2026-07-05",
            "symptoms": ["headache"],
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["period_start_date"] == "2026-07-01"
    assert body["is_correction"] is False


@pytest.mark.asyncio
async def test_create_snooze_no_prediction_404(app_client: AsyncClient) -> None:
    import uuid

    resp = await app_client.post(
        "/api/v1/cycle/snooze",
        json={"predicted_cycle_id": str(uuid.uuid4()), "day_offset": 0},
    )
    assert resp.status_code == 404


# ---- Error scenarios ----


@pytest.mark.asyncio
async def test_unauthenticated_401(app_client: AsyncClient) -> None:
    app_client.headers.pop("Authorization", None)
    resp = await app_client.get("/api/v1/cycle/entries")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_entry_404(app_client: AsyncClient) -> None:
    import uuid

    resp = await app_client.get(f"/api/v1/cycle/entries/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_entry_404(app_client: AsyncClient) -> None:
    import uuid

    resp = await app_client.put(
        f"/api/v1/cycle/entries/{uuid.uuid4()}",
        json={"flow_intensity": "heavy"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_entry_404(app_client: AsyncClient) -> None:
    import uuid

    resp = await app_client.delete(f"/api/v1/cycle/entries/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_wrong_user_returns_404(app_client: AsyncClient) -> None:
    create = await app_client.post(
        "/api/v1/cycle/entries",
        json={"period_start_date": "2026-05-01"},
    )
    assert create.status_code == 201
    entry_id = create.json()["id"]

    app_client.headers["Authorization"] = f"Bearer {app_client.test_token2}"
    resp = await app_client.get(f"/api/v1/cycle/entries/{entry_id}")
    assert resp.status_code == 404
