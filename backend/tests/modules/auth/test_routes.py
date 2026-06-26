"""Auth HTTP route tests.

These tests use the FastAPI app directly with the in-memory SQLite engine
and a fake Twilio client. They exercise the request/response cycle and the
response envelope (rule §16.1 / project invariant §2).
"""

from __future__ import annotations

import os

# Force test env BEFORE importing the app.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

from contextlib import asynccontextmanager

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.database import Base, get_db
from tests.modules.auth.conftest import FakeTwilio


# JSONB → JSON for SQLite test runner
@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@asynccontextmanager
async def _noop_lifespan(_app):
    """No-op lifespan that does NOT close Redis between tests."""
    yield


class _NoopRateLimiter:
    """Rate limiter that never blocks (used in test mode to avoid Redis dependency)."""

    async def check(self, key: str, limit: int, window_seconds: int) -> None:
        return None


@pytest_asyncio.fixture
async def app_client(monkeypatch) -> AsyncClient:
    """Create an app with a per-test in-memory SQLite and a fake Twilio."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models  # noqa: F401
        from app.modules.users import models as users_models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)

    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def _override_get_db():
        async with Session() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    fake = FakeTwilio()

    def _override_twilio():
        return fake  # type: ignore[return-value]

    # Replace Redis with no-op so revocation store is a no-op in tests.

    class _NoopRevocation:
        async def revoke(self, jti: str, ttl_seconds: int) -> None:
            return None
        async def is_revoked(self, jti: str) -> bool:
            return False

    # Build a minimal app with only auth routes and a no-op lifespan.
    from fastapi import FastAPI

    app = FastAPI(title="SheCare API (test)", lifespan=_noop_lifespan)
    from app.modules.auth.routes import init_module as _auth_init
    _auth_init(app, None)

    # Register exception handlers for SheCareError → proper HTTP responses.
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

    # Bypass Redis-backed rate limiter in tests
    import app.modules.auth.routes as _auth_routes

    monkeypatch.setattr(_auth_routes, "_rate_limiter", lambda: _NoopRateLimiter())

    @app.get("/health/live", tags=["meta"])
    async def _liveness() -> dict[str, str]:
        return {"status": "ok"}
    app.dependency_overrides[get_db] = _override_get_db
    # Twilio
    from app.modules.auth import dependencies as auth_deps

    app.dependency_overrides[auth_deps.get_twilio_client] = _override_twilio
    # Revocation store
    app.dependency_overrides[auth_deps.get_revocation_store] = lambda: _NoopRevocation()  # type: ignore[arg-type]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Stash the fake for tests to inspect.
        client.fake_twilio = fake  # type: ignore[attr-defined]
        yield client

    await engine.dispose()


@pytest.mark.asyncio
async def test_request_otp_returns_envelope(app_client: AsyncClient) -> None:
    resp = await app_client.post("/api/v1/auth/otp/request", json={"phone": "+14155552671"})
    assert resp.status_code == 202
    body = resp.json()
    # In test env the dev_code is exposed so the test client can complete the flow.
    assert body.get("dev_code")
    assert body["expires_in"] == 300


@pytest.mark.asyncio
async def test_otp_verify_full_flow(app_client: AsyncClient) -> None:
    r1 = await app_client.post("/api/v1/auth/otp/request", json={"phone": "+14155552671"})
    code = r1.json()["dev_code"]

    r2 = await app_client.post(
        "/api/v1/auth/otp/verify",
        json={"phone": "+14155552671", "otp": code, "device_info": {"os": "android", "model": "Pixel"}},
    )
    assert r2.status_code == 200
    body = r2.json()
    assert body["user"]["phone_number"] == "+14155552671"
    assert body["tokens"]["access_token"]
    assert body["tokens"]["refresh_token"]
    assert body["requires_mfa"] is False


@pytest.mark.asyncio
async def test_otp_verify_wrong_code_returns_400(app_client: AsyncClient) -> None:
    await app_client.post("/api/v1/auth/otp/request", json={"phone": "+14155552671"})
    r = await app_client.post(
        "/api/v1/auth/otp/verify",
        json={"phone": "+14155552671", "otp": "000000"},
    )
    assert r.status_code == 400
    body = r.json()
    assert body["error"]["code"] == "OTP_INVALID"


@pytest.mark.asyncio
async def test_refresh_rotation(app_client: AsyncClient) -> None:
    r1 = await app_client.post("/api/v1/auth/otp/request", json={"phone": "+14155552671"})
    code = r1.json()["dev_code"]
    r2 = await app_client.post(
        "/api/v1/auth/otp/verify", json={"phone": "+14155552671", "otp": code},
    )
    refresh = r2.json()["tokens"]["refresh_token"]

    r3 = await app_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh},
    )
    assert r3.status_code == 200
    new_refresh = r3.json()["refresh_token"]
    assert new_refresh != refresh

    # Reusing the old refresh must fail.
    r4 = await app_client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh},
    )
    assert r4.status_code == 401
    assert r4.json()["error"]["code"] == "TOKEN_REVOKED"


@pytest.mark.asyncio
async def test_unauthenticated_request_returns_401_envelope(app_client: AsyncClient) -> None:
    r = await app_client.get("/api/v1/auth/sessions")
    assert r.status_code == 401
    body = r.json()
    assert body["error"]["code"] in {"MISSING_BEARER", "INVALID_TOKEN"}


@pytest.mark.asyncio
async def test_register_201(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/auth/register",
        json={"email": "new@user.com", "password": "SecurePass1!", "display_name": "New User"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["user"]["email"] == "new@user.com"
    assert body["user"]["display_name"] == "New User"
    assert body["user"]["provider"] == "local"
    assert body["user"]["is_verified"] is False
    assert body["tokens"]["access_token"]
    assert body["tokens"]["refresh_token"]
    assert body["requires_mfa"] is False


@pytest.mark.asyncio
async def test_register_409_duplicate(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/auth/register",
        json={"email": "dup@user.com", "password": "SecurePass1!"},
    )
    resp = await app_client.post(
        "/api/v1/auth/register",
        json={"email": "dup@user.com", "password": "OtherPass2!"},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "CONFLICT"


@pytest.mark.asyncio
async def test_register_422_invalid_email(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "password": "SecurePass1"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_422_short_password(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/auth/register",
        json={"email": "a@b.com", "password": "1234567"},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_200(app_client: AsyncClient) -> None:
    # Create user via register
    await app_client.post(
        "/api/v1/auth/register",
        json={"email": "login@test.com", "password": "MyPassword1!"},
    )
    resp = await app_client.post(
        "/api/v1/auth/login",
        json={"email": "login@test.com", "password": "MyPassword1!"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == "login@test.com"
    assert body["tokens"]["access_token"]
    assert body["tokens"]["refresh_token"]


@pytest.mark.asyncio
async def test_login_401_wrong_password(app_client: AsyncClient) -> None:
    await app_client.post(
        "/api/v1/auth/register",
        json={"email": "secure@test.com", "password": "RealPass1!"},
    )
    resp = await app_client.post(
        "/api/v1/auth/login",
        json={"email": "secure@test.com", "password": "WrongPass1!"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_login_401_wrong_email(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@test.com", "password": "SomePass1"},
    )
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_health_live_ok(app_client: AsyncClient) -> None:
    r = await app_client.get("/health/live")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
