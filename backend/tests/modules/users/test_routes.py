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


_TEST_USER_SECRET = "user-test-secret-32characters!!!!"


@pytest_asyncio.fixture
async def app_client() -> AsyncClient:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models  # noqa: F401
        from app.modules.users import models  # noqa: F401
        from app.modules.wellness import models  # noqa: F401
        from app.modules.cycle import models  # noqa: F401
        from app.modules.pregnancy import models  # noqa: F401
        from app.modules.safety import models as safety_models  # noqa: F401
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
            email="user@test.com",
            display_name="User Tester",
            role="user",
            user_secret_key=_TEST_USER_SECRET,
            is_verified=True,
            phone_number="+14155552671",
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
    from app.core.encryption import EncryptionService, get_encryption_service
    from app.modules.users.routes import init_module as users_init

    settings = get_settings()
    token, _, _ = create_access_token(
        user_id=user.id,
        email=user.email or "",
        role=user.role,
        user_secret_key=_TEST_USER_SECRET,
        settings=settings.jwt,
    )

    app = FastAPI(title="Users (test)", lifespan=_noop_lifespan)
    users_init(app, None)

    app.add_exception_handler(SheCareError, shecare_exception_handler)
    app.add_exception_handler(RateLimitError, shecare_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_token_revocation_store] = lambda: _NoopRevocation()
    app.dependency_overrides[get_encryption_service] = lambda: EncryptionService()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.headers["Authorization"] = f"Bearer {token}"
        client.test_user_id = user.id
        yield client

    await engine.dispose()


@pytest.mark.asyncio
async def test_get_profile(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/users/me")
    assert resp.status_code == 200
    body = resp.json()
    assert body["display_name"] == "User Tester"
    assert body["phone_number"] == "+14155552671"
    assert body["is_active"] is True


@pytest.mark.asyncio
async def test_update_profile(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/users/me",
        json={"display_name": "Updated Name", "blood_group": "O+"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["display_name"] == "Updated Name"
    assert body["blood_group"] == "O+"


@pytest.mark.asyncio
async def test_delete_account(app_client: AsyncClient) -> None:
    resp = await app_client.delete("/api/v1/users/me")
    assert resp.status_code == 202
    body = resp.json()
    assert "message" in body
    assert "deletion" in body["message"].lower()


@pytest.mark.asyncio
async def test_avatar_upload(app_client: AsyncClient) -> None:
    resp = await app_client.post("/api/v1/users/me/avatar")
    assert resp.status_code == 200
    body = resp.json()
    assert "url" in body
    assert "avatars.shecare.app" in body["url"]


@pytest.mark.asyncio
async def test_register_fcm_token(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/users/me/fcm-tokens",
        json={"token": "fcm-token-abc-123"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "fcm-token-abc-123" in body["tokens"]


@pytest.mark.asyncio
async def test_remove_fcm_token(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/users/me/fcm-tokens",
        json={"token": "token-to-remove"},
    )
    resp = await app_client.delete("/api/v1/users/me/fcm-tokens/token-to-remove")
    assert resp.status_code == 200
    body = resp.json()
    assert "token-to-remove" not in body["tokens"]


@pytest.mark.asyncio
async def test_record_consent(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/users/me/consents",
        json={"consent_type": "privacy_policy", "version": "2.1", "granted": True},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["consent_type"] == "privacy_policy"
    assert body["granted"] is True


@pytest.mark.asyncio
async def test_list_consents(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/users/me/consents",
        json={"consent_type": "ai_analysis", "version": "1.0", "granted": True},
    )
    resp = await app_client.get("/api/v1/users/me/consents")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) >= 1


@pytest.mark.asyncio
async def test_unauthenticated_returns_401(app_client: AsyncClient) -> None:
    app_client.headers.pop("Authorization", None)
    resp = await app_client.get("/api/v1/users/me")
    assert resp.status_code == 401
