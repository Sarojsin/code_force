from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

from contextlib import asynccontextmanager
from datetime import date

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


_TEST_USER_SECRET = "onb-test-secret-32characters!!!!!"


@pytest_asyncio.fixture
async def app_client() -> AsyncClient:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models  # noqa: F401
        from app.modules.onboarding import models  # noqa: F401
        from app.modules.cycle import models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def _override_get_db():
        async with Session() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    from app.modules.auth.models import User

    async with Session() as db:
        user = User(
            email="onb@test.com",
            display_name="Onboarding Tester",
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
    from app.modules.onboarding.routes import init_module as onb_init

    settings = get_settings()
    token, _, _ = create_access_token(
        user_id=user.id,
        email=user.email or "",
        role=user.role,
        user_secret_key=_TEST_USER_SECRET,
        settings=settings.jwt,
    )

    app = FastAPI(title="Onboarding (test)", lifespan=_noop_lifespan)
    onb_init(app, None)

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


_ONBOARDING_PAYLOAD = {
    "age": 28,
    "height_cm": 165.0,
    "weight_kg": 62.0,
    "stress_level": "moderate",
    "exercise_frequency": "moderate",
    "sleep_hours": 7.5,
    "diet": "balanced",
    "current_cycle_start": str(date(2026, 5, 28)),
    "current_cycle_length": 28,
    "current_period_length": 5,
    "current_symptoms": ["cramps"],
    "past_cycles": [
        {
            "cycle_start": str(date(2026, 4, 28)),
            "cycle_length": 30,
            "period_length": 4,
            "symptoms": ["bloating"],
        },
    ],
}


@pytest.mark.asyncio
async def test_upsert_onboarding(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/onboarding",
        json=_ONBOARDING_PAYLOAD,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["age"] == 28
    assert body["height_cm"] == 165.0
    assert body["diet"] == "balanced"
    assert body["onboarding_completed"] is True
    assert body["completed_at"] is not None
    assert body["user_id"] == str(app_client.test_user_id)


@pytest.mark.asyncio
async def test_upsert_onboarding_idempotent(app_client: AsyncClient) -> None:
    r1 = await app_client.put("/api/v1/onboarding", json=_ONBOARDING_PAYLOAD)
    assert r1.status_code == 200
    r2 = await app_client.put(
        "/api/v1/onboarding",
        json={**_ONBOARDING_PAYLOAD, "age": 29},
    )
    assert r2.status_code == 200
    assert r2.json()["age"] == 29
    assert r2.json()["onboarding_completed"] is True


@pytest.mark.asyncio
async def test_get_onboarding_after_upsert(app_client: AsyncClient) -> None:
    await app_client.put("/api/v1/onboarding", json=_ONBOARDING_PAYLOAD)
    resp = await app_client.get("/api/v1/onboarding")
    assert resp.status_code == 200
    body = resp.json()
    assert body["age"] == 28
    assert body["onboarding_completed"] is True


@pytest.mark.asyncio
async def test_get_onboarding_not_found(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/onboarding")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "ONBOARDING_NOT_FOUND"


@pytest.mark.asyncio
async def test_get_onboarding_status_completed(app_client: AsyncClient) -> None:
    await app_client.put("/api/v1/onboarding", json=_ONBOARDING_PAYLOAD)
    resp = await app_client.get("/api/v1/onboarding/status")
    assert resp.status_code == 200
    assert resp.json()["completed"] is True


@pytest.mark.asyncio
async def test_get_onboarding_status_not_done(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/onboarding/status")
    assert resp.status_code == 200
    assert resp.json()["completed"] is False


@pytest.mark.asyncio
async def test_unauthenticated_returns_401(app_client: AsyncClient) -> None:
    app_client.headers.pop("Authorization", None)
    resp = await app_client.get("/api/v1/onboarding/status")
    assert resp.status_code == 401
