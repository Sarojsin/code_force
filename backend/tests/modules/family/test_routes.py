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


_TEST_USER_SECRET_1 = "fam-secret-1-32characters!!!!!!!"
_TEST_USER_SECRET_2 = "fam-secret-2-32characters!!!!!!!"


@pytest_asyncio.fixture
async def app_client() -> AsyncClient:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models  # noqa: F401
        from app.modules.family import models  # noqa: F401
        from app.modules.wellness import models  # noqa: F401
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
        user1 = User(
            email="owner@family.test",
            display_name="Owner",
            role="user",
            user_secret_key=_TEST_USER_SECRET_1,
            is_verified=True,
        )
        user2 = User(
            email="linked@family.test",
            display_name="Linked",
            role="user",
            user_secret_key=_TEST_USER_SECRET_2,
            is_verified=True,
        )
        db.add(user1)
        db.add(user2)
        await db.commit()
        await db.refresh(user1)
        await db.refresh(user2)

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
    from app.modules.family.routes import init_module as family_init

    settings = get_settings()
    token1, _, _ = create_access_token(
        user_id=user1.id,
        email=user1.email or "",
        role=user1.role,
        user_secret_key=_TEST_USER_SECRET_1,
        settings=settings.jwt,
    )
    token2, _, _ = create_access_token(
        user_id=user2.id,
        email=user2.email or "",
        role=user2.role,
        user_secret_key=_TEST_USER_SECRET_2,
        settings=settings.jwt,
    )

    app = FastAPI(title="Family (test)", lifespan=_noop_lifespan)
    family_init(app, None)

    app.add_exception_handler(SheCareError, shecare_exception_handler)
    app.add_exception_handler(RateLimitError, shecare_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_token_revocation_store] = lambda: _NoopRevocation()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.headers["Authorization"] = f"Bearer {token1}"
        client.test_user1_id = user1.id
        client.test_user2_id = user2.id
        client.test_token1 = token1
        client.test_token2 = token2
        yield client

    await engine.dispose()


@pytest.mark.asyncio
async def test_generate_invite(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/family/link/generate",
        json={"permission_level": 3},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["invite_token"]
    assert body["expires_at"]
    assert body["shareable_link"]


@pytest.mark.asyncio
async def test_generate_invite_default_permissions(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/family/link/generate",
        json={},
    )
    assert resp.status_code == 200
    assert resp.json()["invite_token"]


@pytest.mark.asyncio
async def test_get_invite_info(app_client: AsyncClient) -> None:
    gen = await app_client.post(
        "/api/v1/family/link/generate",
        json={"permission_level": 1},
    )
    token = gen.json()["invite_token"]

    resp = await app_client.get(f"/api/v1/family/link/{token}/info")
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_expires_at"]


@pytest.mark.asyncio
async def test_get_invite_info_expired(app_client: AsyncClient) -> None:
    resp = await app_client.get(f"/api/v1/family/link/{uuid.uuid4()}/info")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_accept_invite(app_client: AsyncClient) -> None:
    gen = await app_client.post(
        "/api/v1/family/link/generate",
        json={"permission_level": 1},
    )
    token = gen.json()["invite_token"]

    app_client.headers["Authorization"] = f"Bearer {app_client.test_token2}"
    resp = await app_client.post(f"/api/v1/family/link/{token}/accept")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Family link established"


@pytest.mark.asyncio
async def test_accept_invite_own_link(app_client: AsyncClient) -> None:
    gen = await app_client.post(
        "/api/v1/family/link/generate",
        json={"permission_level": 1},
    )
    token = gen.json()["invite_token"]

    resp = await app_client.post(f"/api/v1/family/link/{token}/accept")
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "CANNOT_LINK_SELF"


@pytest.mark.asyncio
async def test_list_links(app_client: AsyncClient) -> None:
    gen = await app_client.post(
        "/api/v1/family/link/generate",
        json={"permission_level": 1},
    )
    token = gen.json()["invite_token"]

    app_client.headers["Authorization"] = f"Bearer {app_client.test_token2}"
    await app_client.post(f"/api/v1/family/link/{token}/accept")

    app_client.headers["Authorization"] = f"Bearer {app_client.test_token1}"
    resp = await app_client.get("/api/v1/family/links")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) >= 1


@pytest.mark.asyncio
async def test_update_permissions(app_client: AsyncClient) -> None:
    gen = await app_client.post(
        "/api/v1/family/link/generate",
        json={"permission_level": 1},
    )
    token = gen.json()["invite_token"]

    app_client.headers["Authorization"] = f"Bearer {app_client.test_token2}"
    await app_client.post(f"/api/v1/family/link/{token}/accept")

    app_client.headers["Authorization"] = f"Bearer {app_client.test_token1}"
    links = await app_client.get("/api/v1/family/links")
    link_id = links.json()[0]["id"]

    resp = await app_client.put(
        f"/api/v1/family/links/{link_id}/permissions",
        json={"permission_level": 7},
    )
    assert resp.status_code == 200
    assert resp.json()["permission_level"] == 7


@pytest.mark.asyncio
async def test_update_permissions_404(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        f"/api/v1/family/links/{uuid.uuid4()}/permissions",
        json={"permission_level": 5},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_revoke_link(app_client: AsyncClient) -> None:
    gen = await app_client.post(
        "/api/v1/family/link/generate",
        json={"permission_level": 1},
    )
    token = gen.json()["invite_token"]

    app_client.headers["Authorization"] = f"Bearer {app_client.test_token2}"
    await app_client.post(f"/api/v1/family/link/{token}/accept")

    app_client.headers["Authorization"] = f"Bearer {app_client.test_token1}"
    links = await app_client.get("/api/v1/family/links")
    link_id = links.json()[0]["id"]

    resp = await app_client.delete(f"/api/v1/family/links/{link_id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_revoke_link_404(app_client: AsyncClient) -> None:
    resp = await app_client.delete(f"/api/v1/family/links/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_shared_data(app_client: AsyncClient) -> None:
    gen = await app_client.post(
        "/api/v1/family/link/generate",
        json={"permission_level": 7},
    )
    token = gen.json()["invite_token"]

    app_client.headers["Authorization"] = f"Bearer {app_client.test_token2}"
    await app_client.post(f"/api/v1/family/link/{token}/accept")

    resp = await app_client.get("/api/v1/family/shared-data")
    assert resp.status_code == 200
    body = resp.json()
    assert "mood_data" in body
    assert "cycle_data" in body
    assert "pregnancy_data" in body


@pytest.mark.asyncio
async def test_unauthenticated_returns_401(app_client: AsyncClient) -> None:
    app_client.headers.pop("Authorization", None)
    resp = await app_client.get("/api/v1/family/links")
    assert resp.status_code == 401
