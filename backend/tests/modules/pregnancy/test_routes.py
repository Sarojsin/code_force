from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import uuid
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


_TEST_USER_SECRET = "preg-test-secret-32characters!!"


@pytest_asyncio.fixture
async def app_client() -> AsyncClient:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models  # noqa: F401
        from app.modules.pregnancy import models  # noqa: F401
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
    from app.modules.pregnancy.models import PregnancyMilestone

    async with Session() as db:
        user = User(
            email="preg@test.com",
            display_name="Preg Tester",
            role="user",
            user_secret_key=_TEST_USER_SECRET,
            is_verified=True,
        )
        db.add(user)
        await db.flush()

        milestone = PregnancyMilestone(
            week=20,
            baby_size_cm=16.0,
            baby_weight_g=300.0,
            development_tip="Baby is developing rapidly",
        )
        db.add(milestone)
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
    from app.modules.pregnancy.routes import init_module as pregnancy_init

    settings = get_settings()
    token, _, _ = create_access_token(
        user_id=user.id,
        email=user.email or "",
        role=user.role,
        user_secret_key=_TEST_USER_SECRET,
        settings=settings.jwt,
    )

    app = FastAPI(title="Pregnancy (test)", lifespan=_noop_lifespan)
    pregnancy_init(app, None)

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
async def test_create_profile(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/pregnancy/profile",
        json={"due_date": "2026-12-01", "lmp_date": "2026-03-01"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["due_date"] == "2026-12-01"
    assert body["lmp_date"] == "2026-03-01"
    assert body["is_active"] is True
    assert body["current_week"] >= 16
    assert body["user_id"] == str(app_client.test_user_id)


@pytest.mark.asyncio
async def test_create_profile_duplicate(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/pregnancy/profile",
        json={"due_date": "2026-12-01", "lmp_date": "2026-03-01"},
    )
    resp = await app_client.post(
        "/api/v1/pregnancy/profile",
        json={"due_date": "2027-01-15", "lmp_date": "2026-04-15"},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "ACTIVE_PREGNANCY_EXISTS"


@pytest.mark.asyncio
async def test_get_profile_200(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/pregnancy/profile",
        json={"due_date": "2026-12-01", "lmp_date": "2026-03-01"},
    )
    resp = await app_client.get("/api/v1/pregnancy/profile")
    assert resp.status_code == 200
    body = resp.json()
    assert body["due_date"] == "2026-12-01"


@pytest.mark.asyncio
async def test_get_profile_404(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/pregnancy/profile")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "PREGNANCY_PROFILE_NOT_FOUND"


@pytest.mark.asyncio
async def test_update_profile(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/pregnancy/profile",
        json={"due_date": "2026-12-01", "lmp_date": "2026-03-01"},
    )
    resp = await app_client.put(
        "/api/v1/pregnancy/profile",
        json={"due_date": "2027-01-01"},
    )
    assert resp.status_code == 200
    assert resp.json()["due_date"] == "2027-01-01"


@pytest.mark.asyncio
async def test_archive_profile(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/pregnancy/profile",
        json={"due_date": "2026-12-01", "lmp_date": "2026-03-01"},
    )
    resp = await app_client.delete("/api/v1/pregnancy/profile")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_create_daily_log(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/pregnancy/profile",
        json={"due_date": "2026-12-01", "lmp_date": "2026-03-01"},
    )
    resp = await app_client.post(
        "/api/v1/pregnancy/daily-log",
        json={
            "symptoms": ["nausea", "fatigue"],
            "cravings": ["ice cream"],
            "mood": "happy",
            "notes": "Feeling great today",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["symptoms"] == ["nausea", "fatigue"]
    assert body["cravings"] == ["ice cream"]
    assert body["mood"] == "happy"


@pytest.mark.asyncio
async def test_list_daily_logs(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/pregnancy/profile",
        json={"due_date": "2026-12-01", "lmp_date": "2026-03-01"},
    )
    await app_client.post(
        "/api/v1/pregnancy/daily-log",
        json={"symptoms": ["cramps"]},
    )
    resp = await app_client.get("/api/v1/pregnancy/daily-logs")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) >= 1


@pytest.mark.asyncio
async def test_get_milestone(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/pregnancy/profile",
        json={"due_date": "2026-12-01", "lmp_date": "2026-03-01"},
    )
    resp = await app_client.get("/api/v1/pregnancy/milestone")
    assert resp.status_code == 200
    body = resp.json()
    assert body["week"] >= 16
    assert body["development_tip"]


@pytest.mark.asyncio
async def test_get_recommendations(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/pregnancy/profile",
        json={"due_date": "2026-12-01", "lmp_date": "2026-03-01"},
    )
    resp = await app_client.get("/api/v1/pregnancy/recommendations")
    assert resp.status_code == 200
    body = resp.json()
    assert body["week"] >= 16
    assert body["trimester"]
    assert len(body["tips"]) > 0


@pytest.mark.asyncio
async def test_unauthenticated_returns_401(app_client: AsyncClient) -> None:
    app_client.headers.pop("Authorization", None)
    resp = await app_client.get("/api/v1/pregnancy/profile")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_profile_422_missing_fields(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/pregnancy/profile",
        json={},
    )
    assert resp.status_code == 422
