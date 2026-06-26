"""Wellness HTTP route tests.

Tests journal, mood, breathing, and insight endpoints using an in-memory
SQLite database and a real JWT flow (with revocation store overridden).
"""

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
from app.core.encryption import make_user_salt


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


@pytest_asyncio.fixture
async def app_client() -> AsyncClient:
    """Create an app with per-test in-memory SQLite and a pre-seeded user + exercise."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models  # noqa: F401
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
    from app.modules.wellness.models import BreathingExercise

    test_user_id = uuid.uuid4()
    user_salt = make_user_salt()
    user_secret_key = str(uuid.uuid4())
    exercise_id = uuid.uuid4()

    async with Session() as session:
        user = User(
            id=test_user_id,
            email="test@wellness.com",
            display_name="Test Wellness User",
            user_secret_key=user_secret_key,
            encryption_key_salt=user_salt,
            is_verified=True,
            provider="local",
        )
        session.add(user)

        exercise = BreathingExercise(
            id=exercise_id,
            name="Box Breathing",
            duration_seconds=120,
            instructions={"steps": ["Inhale 4s", "Hold 4s", "Exhale 4s", "Hold 4s"]},
        )
        session.add(exercise)
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
    from app.core.security import get_token_revocation_store
    from app.modules.wellness.routes import init_module as wellness_init

    app = FastAPI(title="SheCare API (test)", lifespan=_noop_lifespan)
    wellness_init(app, None)

    app.add_exception_handler(SheCareError, shecare_exception_handler)
    app.add_exception_handler(RateLimitError, shecare_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_token_revocation_store] = lambda: _NoopRevocation()

    from app.core.security import create_access_token
    from app.core.config import get_settings

    settings = get_settings()
    token, _, _ = create_access_token(
        user_id=test_user_id,
        email="test@wellness.com",
        role="user",
        user_secret_key=user_secret_key,
        settings=settings.jwt,
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        client.headers["Authorization"] = f"Bearer {token}"
        client.test_user_id = test_user_id
        client.test_exercise_id = exercise_id
        client._backend_app = app
        client._backend_transport = transport
        yield client

    await engine.dispose()


# ---------------------------------------------------------------------------
# Journal endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_journal_entry(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/wellness/journal",
        json={"content": "Today was a really good day."},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"]
    assert body["user_id"] == str(app_client.test_user_id)
    assert body["content"]
    assert body["created_at"]


@pytest.mark.asyncio
async def test_create_journal_entry_with_date_and_mood(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/wellness/journal",
        json={"content": "Feeling great.", "entry_date": "2026-06-01", "mood": "happy"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["entry_date"] == "2026-06-01"


@pytest.mark.asyncio
async def test_list_journal_entries(app_client: AsyncClient) -> None:
    await app_client.post("/api/v1/wellness/journal", json={"content": "Entry A"})
    await app_client.post("/api/v1/wellness/journal", json={"content": "Entry B"})

    resp = await app_client.get("/api/v1/wellness/journal")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert body[0]["entry_date"]
    assert body[0]["created_at"]


@pytest.mark.asyncio
async def test_list_journal_entries_pagination(app_client: AsyncClient) -> None:
    for i in range(5):
        await app_client.post("/api/v1/wellness/journal", json={"content": f"Entry {i}"})

    resp = await app_client.get("/api/v1/wellness/journal?limit=3&offset=0")
    assert resp.status_code == 200
    assert len(resp.json()) == 3


@pytest.mark.asyncio
async def test_get_journal_entry(app_client: AsyncClient) -> None:
    create_resp = await app_client.post(
        "/api/v1/wellness/journal", json={"content": "My private entry"},
    )
    entry_id = create_resp.json()["id"]

    resp = await app_client.get(f"/api/v1/wellness/journal/{entry_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == entry_id
    assert body["content"]


@pytest.mark.asyncio
async def test_get_journal_entry_404(app_client: AsyncClient) -> None:
    missing_id = uuid.uuid4()
    resp = await app_client.get(f"/api/v1/wellness/journal/{missing_id}")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "JOURNAL_ENTRY_NOT_FOUND"


@pytest.mark.asyncio
async def test_delete_journal_entry(app_client: AsyncClient) -> None:
    create_resp = await app_client.post(
        "/api/v1/wellness/journal", json={"content": "To delete"},
    )
    entry_id = create_resp.json()["id"]

    resp = await app_client.delete(f"/api/v1/wellness/journal/{entry_id}")
    assert resp.status_code == 204

    get_resp = await app_client.get(f"/api/v1/wellness/journal/{entry_id}")
    assert get_resp.status_code == 404


# ---------------------------------------------------------------------------
# Mood endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_log_mood(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/wellness/mood",
        json={"mood": "happy", "intensity": 8},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"]
    assert body["mood"] == "happy"
    assert body["intensity"] == 8
    assert body["user_id"] == str(app_client.test_user_id)


@pytest.mark.asyncio
async def test_log_mood_default_intensity(app_client: AsyncClient) -> None:
    resp = await app_client.post(
        "/api/v1/wellness/mood",
        json={"mood": "calm"},
    )
    assert resp.status_code == 201
    assert resp.json()["intensity"] == 3


@pytest.mark.asyncio
async def test_mood_history(app_client: AsyncClient) -> None:
    await app_client.post("/api/v1/wellness/mood", json={"mood": "happy", "intensity": 7})
    await app_client.post("/api/v1/wellness/mood", json={"mood": "sad", "intensity": 2})
    await app_client.post("/api/v1/wellness/mood", json={"mood": "energetic", "intensity": 9})

    resp = await app_client.get("/api/v1/wellness/mood/history")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    assert body[0]["mood"]


@pytest.mark.asyncio
async def test_mood_history_respects_days_back(app_client: AsyncClient) -> None:
    await app_client.post("/api/v1/wellness/mood", json={"mood": "happy", "intensity": 5})

    resp = await app_client.get("/api/v1/wellness/mood/history?days_back=1")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


# ---------------------------------------------------------------------------
# Breathing endpoints
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_breathing_exercises(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/wellness/breathing-exercises")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["name"] == "Box Breathing"
    assert body[0]["duration_seconds"] == 120
    assert body[0]["instructions"] == {
        "steps": ["Inhale 4s", "Hold 4s", "Exhale 4s", "Hold 4s"],
    }


@pytest.mark.asyncio
async def test_complete_breathing_exercise(app_client: AsyncClient) -> None:
    exercise_id = app_client.test_exercise_id
    resp = await app_client.post(
        f"/api/v1/wellness/breathing-sessions/{exercise_id}/complete",
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["user_id"] == str(app_client.test_user_id)
    assert body["exercise_id"] == str(exercise_id)
    assert body["completed_at"]


@pytest.mark.asyncio
async def test_complete_breathing_exercise_404(app_client: AsyncClient) -> None:
    missing_id = uuid.uuid4()
    resp = await app_client.post(
        f"/api/v1/wellness/breathing-sessions/{missing_id}/complete",
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "EXERCISE_NOT_FOUND"


# ---------------------------------------------------------------------------
# Insights endpoint
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_insights_empty(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/wellness/insights")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_journal_entries"] == 0
    assert body["total_mood_logs"] == 0
    assert body["average_mood_intensity"] is None
    assert body["most_common_mood"] is None
    assert body["recommendation"]


@pytest.mark.asyncio
async def test_get_insights_with_data(app_client: AsyncClient) -> None:
    for i in range(6):
        await app_client.post("/api/v1/wellness/journal", json={"content": f"Journal {i}"})
    for i in range(12):
        await app_client.post(
            "/api/v1/wellness/mood",
            json={"mood": "happy" if i % 2 == 0 else "sad", "intensity": 7},
        )

    resp = await app_client.get("/api/v1/wellness/insights")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_journal_entries"] == 6
    assert body["total_mood_logs"] == 12
    assert body["average_mood_intensity"] == 7.0
    assert body["most_common_mood"] in ("happy", "sad")
    assert body["recommendation"]


# ---------------------------------------------------------------------------
# Auth — unauthenticated access
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_unauthenticated_returns_401(app_client: AsyncClient) -> None:
    transport = app_client._backend_transport
    async with AsyncClient(transport=transport, base_url="http://test") as unauth:
        resp = await unauth.get("/api/v1/wellness/journal")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] in {"MISSING_BEARER", "INVALID_TOKEN"}


@pytest.mark.asyncio
async def test_unauthenticated_post_returns_401(app_client: AsyncClient) -> None:
    transport = app_client._backend_transport
    async with AsyncClient(transport=transport, base_url="http://test") as unauth:
        resp = await unauth.post(
            "/api/v1/wellness/journal",
            json={"content": "Should not work"},
        )
    assert resp.status_code == 401
