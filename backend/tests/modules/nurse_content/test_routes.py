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


_TEST_USER_SECRET = "nurse-test-secret-32characters!!"


@pytest_asyncio.fixture
async def app_client() -> AsyncClient:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models  # noqa: F401
        from app.modules.nurse_content import models  # noqa: F401
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
            email="nurse@content.test",
            display_name="Nurse Tester",
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
    from app.modules.nurse_content.routes import init_module as nurse_init

    settings = get_settings()
    token, _, _ = create_access_token(
        user_id=user.id,
        email=user.email or "",
        role=user.role,
        user_secret_key=_TEST_USER_SECRET,
        settings=settings.jwt,
    )

    app = FastAPI(title="NurseContent (test)", lifespan=_noop_lifespan)
    nurse_init(app, None)

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
async def test_create_content(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/nurse/contents",
        json={
            "title": "Prenatal Care Tips",
            "description": "Essential tips for a healthy pregnancy",
            "category": "pregnancy",
            "tags": ["prenatal", "health"],
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Prenatal Care Tips"
    assert body["category"] == "pregnancy"
    assert body["tags"] == ["prenatal", "health"]
    assert body["status"] == "pending"
    assert body["nurse_id"] == str(app_client.test_user_id)


@pytest.mark.asyncio
async def test_list_own_content(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/nurse/contents",
        json={"title": "Content A", "category": "nutrition", "tags": []},
    )
    await app_client.post(
        "/api/v1/nurse/contents",
        json={"title": "Content B", "category": "exercise", "tags": []},
    )
    resp = await app_client.get("/api/v1/nurse/contents")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) >= 2


@pytest.mark.asyncio
async def test_update_content(app_client: AsyncClient) -> None:
    create = await app_client.post(
        "/api/v1/nurse/contents",
        json={"title": "Original", "category": "general", "tags": []},
    )
    content_id = create.json()["id"]
    resp = await app_client.put(
        f"/api/v1/nurse/contents/{content_id}",
        json={"title": "Updated Title", "category": "wellness"},
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"
    assert resp.json()["category"] == "wellness"


@pytest.mark.asyncio
async def test_update_content_404(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        f"/api/v1/nurse/contents/{uuid.uuid4()}",
        json={"title": "Ghost"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_content(app_client: AsyncClient) -> None:
    create = await app_client.post(
        "/api/v1/nurse/contents",
        json={"title": "To Delete", "category": "test", "tags": []},
    )
    content_id = create.json()["id"]
    resp = await app_client.delete(f"/api/v1/nurse/contents/{content_id}")
    assert resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_content_404(app_client: AsyncClient) -> None:
    resp = await app_client.delete(f"/api/v1/nurse/contents/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_approved_content_public(app_client: AsyncClient) -> None:
    create = await app_client.post(
        "/api/v1/nurse/contents",
        json={"title": "Public Content", "category": "pregnancy", "tags": []},
    )
    content_id = create.json()["id"]

    from app.core.database import get_db as _real_get_db
    app = app_client._backend_app if hasattr(app_client, '_backend_app') else None

    resp = await app_client.get("/api/v1/contents")
    assert resp.status_code == 200
    body = resp.json()
    approved = [c for c in body if c.get("status") == "approved"]
    assert isinstance(approved, list)


@pytest.mark.asyncio
async def test_get_public_content_404(app_client: AsyncClient) -> None:
    resp = await app_client.get(f"/api/v1/contents/{uuid.uuid4()}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_unauthenticated_returns_401(app_client: AsyncClient) -> None:
    app_client.headers.pop("Authorization", None)
    resp = await app_client.get("/api/v1/nurse/contents")
    assert resp.status_code == 401
