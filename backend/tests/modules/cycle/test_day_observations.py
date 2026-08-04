"""Cycle day-observation (DayDetailSheet) route + service tests.

Covers upsert semantics (replace for symptoms/medications), notes encryption
at the service layer, master endpoints, and row-level isolation (rule §1.12).
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


from app.core.config import get_settings
from app.core.database import Base, get_db
from app.core.encryption import make_user_salt
from app.core.security import create_access_token
from app.modules.auth.models import User
from app.modules.cycle.models import Medication, Symptom


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
    app.state.engine = engine
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
            email="day1@test.com",
            provider="local",
            user_secret_key="a" * 64,
            encryption_key_salt=make_user_salt(),
        )
        user2 = User(
            email="day2@test.com",
            provider="local",
            user_secret_key="b" * 64,
            encryption_key_salt=make_user_salt(),
        )
        db.add(user1)
        db.add(user2)
        db.add(Symptom(name="Cramps", category="pain", icon="🔥", display_order=1))
        db.add(Symptom(name="Headache", category="pain", icon="🤕", display_order=2))
        db.add(Medication(name="Ibuprofen", category="painkiller", display_order=1))
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
        client.test_engine = engine
        yield client

    await engine.dispose()


# ---- Masters ----


@pytest.mark.asyncio
async def test_list_symptoms_and_medications(app_client: AsyncClient) -> None:
    resp = await app_client.get("/api/v1/cycle/symptoms")
    assert resp.status_code == 200
    names = {s["name"] for s in resp.json()}
    assert "Cramps" in names and "Headache" in names
    for s in resp.json():
        assert s["category"] and s["display_order"] >= 0

    resp = await app_client.get("/api/v1/cycle/medications")
    assert resp.status_code == 200
    names = {m["name"] for m in resp.json()}
    assert "Ibuprofen" in names


# ---- Upsert day ----


@pytest.mark.asyncio
async def test_upsert_day_full(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/cycle/days/2026-05-01",
        json={
            "mood": "calm",
            "mood_intensity": 6,
            "pain_level": 4,
            "energy_level": 2,
            "sleep_minutes": 420,
            "water_glasses": 8,
            "flow_level": "spotting",
            "notes": "Had a rough day",
            "symptoms": [{"symptom": "Cramps", "severity": 4}],
            "medications": [{"name": "Ibuprofen", "dose": "200mg"}],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["mood"] == "calm"
    assert body["mood_intensity"] == 6
    assert body["pain_level"] == 4
    assert body["sleep_minutes"] == 420
    assert body["flow_level"] == "spotting"
    assert body["notes"] == "Had a rough day"
    assert len(body["symptoms"]) == 1
    assert body["symptoms"][0]["name"] == "Cramps"
    assert body["symptoms"][0]["severity"] == 4
    assert len(body["medications"]) == 1
    assert body["medications"][0]["name"] == "Ibuprofen"
    assert body["medications"][0]["dose"] == "200mg"
    assert body["log_date"] == "2026-05-01"
    assert body["user_id"] == str(app_client.test_user.id)


@pytest.mark.asyncio
async def test_upsert_day_partial_patch(app_client: AsyncClient) -> None:
    first = await app_client.put(
        "/api/v1/cycle/days/2026-05-02",
        json={"mood": "happy", "pain_level": 2, "notes": "first"},
    )
    assert first.status_code == 200

    second = await app_client.put(
        "/api/v1/cycle/days/2026-05-02",
        json={"pain_level": 8, "sleep_minutes": 300},
    )
    assert second.status_code == 200
    body = second.json()
    assert body["pain_level"] == 8
    assert body["sleep_minutes"] == 300
    assert body["mood"] == "happy", "unset fields must be preserved"
    assert body["notes"] == "first", "unset fields must be preserved"


@pytest.mark.asyncio
async def test_upsert_day_replaces_symptoms_and_medications(app_client: AsyncClient) -> None:
    await app_client.put(
        "/api/v1/cycle/days/2026-05-03",
        json={
            "symptoms": [{"symptom": "Cramps", "severity": 3}],
            "medications": [{"name": "Ibuprofen"}],
        },
    )
    resp = await app_client.put(
        "/api/v1/cycle/days/2026-05-03",
        json={"symptoms": [{"symptom": "Headache", "severity": 2}], "medications": []},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert [s["name"] for s in body["symptoms"]] == [
        "Headache"
    ], "re-save replaces symptom joins, not appends"
    assert body["medications"] == [], "empty medications list clears previous meds"


@pytest.mark.asyncio
async def test_unknown_symptom_and_medication_skipped(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/cycle/days/2026-05-04",
        json={
            "symptoms": [{"symptom": "NotARealSymptom", "severity": 3}],
            "medications": [{"name": "NotARealMed"}],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["symptoms"] == []
    assert body["medications"] == []


# ---- Notes encryption (service layer, rule §1.12) ----


@pytest.mark.asyncio
async def test_notes_encrypted_at_rest(app_client: AsyncClient) -> None:
    from sqlalchemy import select

    from app.modules.cycle.models import CycleDay

    await app_client.put(
        "/api/v1/cycle/days/2026-05-05",
        json={"notes": "super sensitive journal content"},
    )

    engine = app_client.test_engine  # type: ignore[attr-defined]
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as db:
        row = (
            await db.execute(select(CycleDay).where(CycleDay.log_date == "2026-05-05"))
        ).scalar_one()
        stored = row.notes
        assert stored is not None
        assert "super sensitive" not in stored, "notes must be ciphertext at rest"


# ---- List days ----


@pytest.mark.asyncio
async def test_list_days_range_decrypts_notes(app_client: AsyncClient) -> None:
    await app_client.put(
        "/api/v1/cycle/days/2026-05-10",
        json={"mood": "anxious", "notes": "secret note"},
    )
    await app_client.put(
        "/api/v1/cycle/days/2026-05-12",
        json={"mood": "happy"},
    )

    resp = await app_client.get("/api/v1/cycle/days?start=2026-05-10&end=2026-05-12")
    assert resp.status_code == 200
    days = resp.json()
    assert [d["log_date"] for d in days] == ["2026-05-10", "2026-05-12"]
    assert days[0]["notes"] == "secret note", "list must decrypt notes for the owner"
    assert days[0]["mood"] == "anxious"


@pytest.mark.asyncio
async def test_list_days_row_level_isolation(app_client: AsyncClient) -> None:
    await app_client.put(
        "/api/v1/cycle/days/2026-05-20",
        json={"mood": "sad", "notes": "user1-only"},
    )

    resp = await app_client.get(
        "/api/v1/cycle/days?start=2026-05-01&end=2026-05-31",
        headers={"Authorization": f"Bearer {app_client.test_token2}"},
    )
    assert resp.status_code == 200
    assert resp.json() == [], "user2 must never see user1's day observations"


@pytest.mark.asyncio
async def test_upsert_day_row_level_isolation(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/cycle/days/2026-05-21",
        json={"mood": "calm"},
        headers={"Authorization": f"Bearer {app_client.test_token2}"},
    )
    assert resp.status_code == 200
    assert resp.json()["user_id"] == str(app_client.test_user2.id)
    # user1 still has no rows
    r2 = await app_client.get("/api/v1/cycle/days?start=2026-05-01&end=2026-05-31")
    assert r2.json() == []


# ---- Validation ----


@pytest.mark.asyncio
async def test_upsert_day_invalid_pain_level(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/cycle/days/2026-05-30",
        json={"pain_level": 15},
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_upsert_day_invalid_severity(app_client: AsyncClient) -> None:
    resp = await app_client.put(
        "/api/v1/cycle/days/2026-05-30",
        json={"symptoms": [{"symptom": "Cramps", "severity": 9}]},
    )
    assert resp.status_code == 422
