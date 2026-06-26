from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import uuid
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


_TEST_USER_SECRET = "admin-test-secret-32characters!!!!"


@pytest_asyncio.fixture
async def app_client() -> AsyncClient:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models as auth_models  # noqa: F401
        from app.modules.admin import models  # noqa: F401
        from app.modules.nurse_content import models  # noqa: F401
        from app.modules.pregnancy import models  # noqa: F401
        from app.modules.safety import models as safety_models  # noqa: F401
        from app.modules.users import models as users_models  # noqa: F401
        from app.modules.wellness import models as wellness_models  # noqa: F401
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
    from app.modules.nurse_content.models import NurseProfile
    from app.modules.nurse_content.models import EducationalContent

    async with Session() as db:
        admin_user = User(
            email="admin@test.com",
            display_name="Admin User",
            role="admin",
            user_secret_key=_TEST_USER_SECRET,
            is_verified=True,
            phone_number="+14155550000",
        )
        db.add(admin_user)
        target_user = User(
            email="target@test.com",
            display_name="Target User",
            role="user",
            user_secret_key="target-secret-32char!!!!!!!!!!!!!",
            is_verified=True,
            phone_number="+14155550001",
        )
        db.add(target_user)
        nurse_user = User(
            email="nurse@test.com",
            display_name="Nurse User",
            role="nurse",
            user_secret_key="nurse-secret-32char!!!!!!!!!!!!!!",
            is_verified=True,
            phone_number="+14155550002",
        )
        db.add(nurse_user)
        await db.flush()
        db.add(NurseProfile(user_id=nurse_user.id, qualification="RN - BSN"))
        pending_content = EducationalContent(title="Pending Content", description="body", status="pending", category="general", tags=[], nurse_id=nurse_user.id)
        db.add(pending_content)
        await db.commit()
        await db.refresh(admin_user)
        await db.refresh(target_user)
        await db.refresh(nurse_user)
        await db.refresh(pending_content)

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
    from app.modules.admin.routes import init_module as admin_init

    settings = get_settings()
    token, _, _ = create_access_token(
        user_id=admin_user.id,
        email=admin_user.email or "",
        role=admin_user.role,
        user_secret_key=_TEST_USER_SECRET,
        settings=settings.jwt,
    )

    app = FastAPI(title="Admin (test)", lifespan=_noop_lifespan)
    admin_init(app, None)

    app.add_exception_handler(SheCareError, shecare_exception_handler)
    app.add_exception_handler(RateLimitError, shecare_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_token_revocation_store] = lambda: _NoopRevocation()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.headers["Authorization"] = f"Bearer {token}"
        client.admin_user_id = admin_user.id
        client.target_user_id = target_user.id
        client.nurse_user_id = nurse_user.id
        client.pending_content_id = pending_content.id
        yield client

    await engine.dispose()


@pytest.mark.asyncio
async def test_list_users(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/admin/users")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) >= 1


@pytest.mark.asyncio
async def test_list_users_filters_admin(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/admin/users?role=admin&is_active=true")
    assert resp.status_code == 200
    body = resp.json()
    assert all(u["role"] == "admin" for u in body)


@pytest.mark.asyncio
async def test_update_role(app_client: AsyncClient) -> None:
    resp = await app_client.put(f"/api/v1/admin/users/{app_client.target_user_id}/role", json={"role": "nurse"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["role"] == "nurse"


@pytest.mark.asyncio
async def test_verify_nurse(app_client: AsyncClient) -> None:
    resp = await app_client.post(f"/api/v1/admin/nurses/{app_client.nurse_user_id}/verify")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Nurse verified"


@pytest.mark.asyncio
async def test_get_analytics(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/admin/analytics/dashboard")
    assert resp.status_code == 200
    body = resp.json()
    assert "total_users" in body
    assert "active_users" in body


@pytest.mark.asyncio
async def test_broadcast(app_client: AsyncClient) -> None:
    resp = await app_client.post("/api/v1/admin/system/broadcast", json={"title": "Test", "body": "Hello"})
    assert resp.status_code == 200
    body = resp.json()
    assert "recipient_count" in body
    assert body["recipient_count"] >= 1


@pytest.mark.asyncio
async def test_list_pending_contents(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/admin/contents/pending")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_approve_content(app_client: AsyncClient) -> None:
    resp = await app_client.put(f"/api/v1/admin/contents/{app_client.pending_content_id}/approve")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_unauthenticated_returns_401(app_client: AsyncClient) -> None:
    app_client.headers.pop("Authorization", None)
    resp = await app_client.get("/api/v1/admin/users")
    assert resp.status_code == 401
