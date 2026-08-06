"""Luna state HTTP route tests (luna2phase4 §5).

Covers GET/PUT `/api/v1/luna/state`, LWW merge over the wire, size caps → 422,
sample validation, row isolation, the 429 `Retry-After` contract, and the
`day_logged` → mood_trend event bridge. Pattern follows
`tests/modules/wellness/test_routes.py`.
"""

from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime, timedelta

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

import app.modules.auth.models
import app.modules.luna.models  # noqa: F401
from app.core.database import Base, get_db
from app.core.encryption import make_user_salt
from app.core.event_bus import EventBus
from app.core.rate_limit import get_rate_limiter
from app.core.security import get_token_revocation_store


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@asynccontextmanager
async def _noop_lifespan(_app):
    yield


class _NoopRevocation:
    async def revoke(self, jti: str, ttl_seconds: int) -> None:
        return None

    async def is_revoked(self, jti: str) -> bool:
        return False


class _NoopLimiter:
    async def check(self, key: str, limit: int, window_seconds: int) -> None:
        return None


class _BoomLimiter:
    def __init__(self, retry_after: int = 42) -> None:
        self._retry_after = retry_after

    async def check(self, key: str, limit: int, window_seconds: int) -> None:
        from app.core.exceptions import RateLimitError

        raise RateLimitError("rate limited", retry_after=self._retry_after)


async def _issue_token(user_id: uuid.UUID, email: str, user_secret_key: str) -> str:
    from app.core.config import get_settings
    from app.core.security import create_access_token

    settings = get_settings()
    token, _, _ = create_access_token(
        user_id=user_id,
        email=email,
        role="user",
        user_secret_key=user_secret_key,
        settings=settings.jwt,
    )
    return token


@pytest_asyncio.fixture
async def app_client() -> AsyncClient:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
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

    test_user_id = uuid.uuid4()
    user_secret_key = str(uuid.uuid4())
    user_salt = make_user_salt()

    async with Session() as session:
        user = User(
            id=test_user_id,
            email="test@luna.com",
            display_name="Test Luna User",
            user_secret_key=user_secret_key,
            encryption_key_salt=user_salt,
            is_verified=True,
            provider="local",
        )
        session.add(user)
        await session.commit()

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
    from app.modules.luna.routes import init_module as luna_init

    event_bus = EventBus()
    app = FastAPI(title="SheCare API (test)", lifespan=_noop_lifespan)
    luna_init(app, event_bus)

    app.add_exception_handler(SheCareError, shecare_exception_handler)
    app.add_exception_handler(RateLimitError, shecare_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_token_revocation_store] = lambda: _NoopRevocation()
    app.dependency_overrides[get_rate_limiter] = lambda: _NoopLimiter()

    token = await _issue_token(test_user_id, "test@luna.com", user_secret_key)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.headers["Authorization"] = f"Bearer {token}"
        client.test_user_id = test_user_id
        client._backend_app = app
        client._backend_transport = transport
        client._event_bus = event_bus
        client._session_factory = Session
        yield client

    await engine.dispose()


# ---------------------------------------------------------------------------
# GET /state
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_state_creates_default_row(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/luna/state")
    assert resp.status_code == 200
    body = resp.json()
    assert body["xp"] == 0
    assert body["level"] == 1
    assert body["coins"] == 0
    assert body["relationship_level"] == 1
    assert body["mood_trend"]["samples"] == []
    assert body["preferences"] == {}
    assert body["achievements"] == []
    assert body["habit_patterns"] == {}
    assert body["id"]
    assert body["created_at"]
    assert body["updated_at"]


@pytest.mark.asyncio
async def test_unauthenticated_get_returns_401(app_client: AsyncClient) -> None:
    transport = app_client._backend_transport
    async with AsyncClient(transport=transport, base_url="http://test") as unauth:
        resp = await unauth.get("/api/v1/luna/state")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PUT /state — upsert + LWW
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_put_state_partial_update(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/luna/state",
        json={
            "xp": 120,
            "coins": 45,
            "client_updated_at": datetime.now(UTC).isoformat(),
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["xp"] == 120
    assert body["coins"] == 45
    assert body["level"] == 1  # untouched


@pytest.mark.asyncio
async def test_put_state_lww_newer_wins(app_client: AsyncClient) -> None:
    t0 = datetime.now(UTC).isoformat()
    t1 = (datetime.now(UTC) + timedelta(seconds=10)).isoformat()
    await app_client.put(
        "/api/v1/luna/state",
        json={"xp": 100, "client_updated_at": t0},
    )
    resp = await app_client.put(
        "/api/v1/luna/state",
        json={"xp": 200, "client_updated_at": t1},
    )
    assert resp.json()["xp"] == 200


@pytest.mark.asyncio
async def test_put_state_lww_older_write_ignored(app_client: AsyncClient) -> None:
    t0 = datetime.now(UTC).isoformat()
    t1 = (datetime.now(UTC) + timedelta(seconds=10)).isoformat()
    await app_client.put(
        "/api/v1/luna/state",
        json={"xp": 200, "client_updated_at": t1},
    )
    resp = await app_client.put(
        "/api/v1/luna/state",
        json={"xp": 100, "client_updated_at": t0},
    )
    assert resp.json()["xp"] == 200


@pytest.mark.asyncio
async def test_put_state_row_isolation(app_client: AsyncClient) -> None:
    await app_client.put(
        "/api/v1/luna/state",
        json={"xp": 999, "client_updated_at": datetime.now(UTC).isoformat()},
    )
    other_id = uuid.uuid4()
    other_secret = str(uuid.uuid4())
    async with app_client._session_factory() as session:
        from app.modules.auth.models import User

        session.add(
            User(
                id=other_id,
                email="other@luna.com",
                display_name="Other",
                user_secret_key=other_secret,
                encryption_key_salt=make_user_salt(),
                is_verified=True,
                provider="local",
            )
        )
        await session.commit()
    other_token = await _issue_token(other_id, "other@luna.com", other_secret)

    transport = app_client._backend_transport
    async with AsyncClient(transport=transport, base_url="http://test") as other:
        other.headers["Authorization"] = f"Bearer {other_token}"
        resp = await other.get("/api/v1/luna/state")
    assert resp.status_code == 200
    assert resp.json()["xp"] == 0  # other user never sees user A's 999


# ---------------------------------------------------------------------------
# Size caps → 422
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_put_state_preferences_over_cap_422(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/luna/state",
        json={
            "preferences": {f"key_{i}": i for i in range(51)},
            "client_updated_at": datetime.now(UTC).isoformat(),
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_put_state_habit_patterns_over_cap_422(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/luna/state",
        json={
            "habit_patterns": {f"key_{i}": i for i in range(101)},
            "client_updated_at": datetime.now(UTC).isoformat(),
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_put_state_achievements_over_cap_422(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/luna/state",
        json={
            "achievements": [
                {"id": f"ach_{i}", "unlocked_at": "2026-08-01T10:00:00Z"}
                for i in range(101)
            ],
            "client_updated_at": datetime.now(UTC).isoformat(),
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_put_state_mood_samples_over_cap_422(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/luna/state",
        json={
            "mood_trend": {
                "samples": [
                    {
                        "date": f"2026-08-{i:02d}",
                        "mood": "neutral",
                        "intensity": 3,
                        "source": "manual",
                        "created_at": "2026-08-01T10:00:00Z",
                    }
                    for i in range(1, 32)
                ]
            },
            "client_updated_at": datetime.now(UTC).isoformat(),
        },
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Sample validation
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_put_state_invalid_mood_422(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/luna/state",
        json={
            "mood_trend": {
                "samples": [
                    {
                        "date": "2026-08-01",
                        "mood": "euphoric",  # not in the Literal set
                        "intensity": 3,
                        "source": "manual",
                        "created_at": "2026-08-01T10:00:00Z",
                    }
                ]
            },
            "client_updated_at": datetime.now(UTC).isoformat(),
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_put_state_invalid_intensity_422(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/luna/state",
        json={
            "mood_trend": {
                "samples": [
                    {
                        "date": "2026-08-01",
                        "mood": "happy",
                        "intensity": 9,  # outside 1..5
                        "source": "manual",
                        "created_at": "2026-08-01T10:00:00Z",
                    }
                ]
            },
            "client_updated_at": datetime.now(UTC).isoformat(),
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_put_state_malformed_date_422(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/luna/state",
        json={
            "mood_trend": {
                "samples": [
                    {
                        "date": "2026-13-99",  # invalid calendar date
                        "mood": "happy",
                        "intensity": 3,
                        "source": "manual",
                        "created_at": "2026-08-01T10:00:00Z",
                    }
                ]
            },
            "client_updated_at": datetime.now(UTC).isoformat(),
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_put_state_client_trend_overwritten(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/luna/state",
        json={
            "mood_trend": {
                "samples": [
                    {
                        "date": "2026-08-01",
                        "mood": "neutral",
                        "intensity": 3,
                        "source": "manual",
                        "created_at": "2026-08-01T10:00:00Z",
                    },
                    {
                        "date": "2026-08-02",
                        "mood": "neutral",
                        "intensity": 3,
                        "source": "manual",
                        "created_at": "2026-08-02T10:00:00Z",
                    },
                    {
                        "date": "2026-08-03",
                        "mood": "happy",
                        "intensity": 4,
                        "source": "manual",
                        "created_at": "2026-08-03T10:00:00Z",
                    },
                ],
                "trend": "volatile",
            },
            "client_updated_at": datetime.now(UTC).isoformat(),
        },
    )
    assert resp.status_code == 200
    assert resp.json()["mood_trend"]["trend"] == "improving"


# ---------------------------------------------------------------------------
# Rate limit → 429 with Retry-After
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_put_state_rate_limited_429_retry_after(app_client: AsyncClient) -> None:
    app = app_client._backend_app
    app.dependency_overrides[get_rate_limiter] = lambda: _BoomLimiter(retry_after=42)
    resp = await app_client.put(
        "/api/v1/luna/state",
        json={"xp": 1, "client_updated_at": datetime.now(UTC).isoformat()},
    )
    assert resp.status_code == 429
    assert resp.json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    assert resp.headers["Retry-After"] == "42"


# ---------------------------------------------------------------------------
# Event bridge: day_logged → mood_trend
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_day_logged_bridge_updates_mood_trend(app_client: AsyncClient, monkeypatch) -> None:
    import app.core.database as database_mod

    monkeypatch.setattr(database_mod, "AsyncSessionLocal", app_client._session_factory)

    await app_client._event_bus.emit(
        "day_logged",
        user_id=str(app_client.test_user_id),
        log_date="2026-08-01",
        mood="happy",
        mood_intensity=5,
        notes=None,
    )

    resp = await app_client.get("/api/v1/luna/state")
    assert resp.status_code == 200
    samples = resp.json()["mood_trend"]["samples"]
    assert len(samples) == 1
    assert samples[0]["source"] == "day_logged"
    assert samples[0]["mood"] == "happy"


@pytest.mark.asyncio
async def test_day_logged_bridge_idempotent(app_client: AsyncClient, monkeypatch) -> None:
    import app.core.database as database_mod

    monkeypatch.setattr(database_mod, "AsyncSessionLocal", app_client._session_factory)

    for _ in range(2):
        await app_client._event_bus.emit(
            "day_logged",
            user_id=str(app_client.test_user_id),
            log_date="2026-08-02",
            mood="sad",
            mood_intensity=2,
            notes=None,
        )

    resp = await app_client.get("/api/v1/luna/state")
    samples = resp.json()["mood_trend"]["samples"]
    assert len(samples) == 1  # dedupe by (date, source) → no double-count
