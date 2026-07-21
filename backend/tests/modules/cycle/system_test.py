"""System tests: 3-state period logging scenarios (from system_test.md)."""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import date, timedelta

import pytest
import pytest_asyncio
from freezegun import freeze_time
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
from app.core.security import create_access_token
from app.modules.auth.models import User
from app.modules.cycle.exceptions import PeriodEndDateRequiredError
from app.modules.cycle.models import CycleEntry, PredictedCycle
from app.modules.cycle.schemas import CycleEntryCreate
from app.modules.cycle.services import CycleService

TEST_REFERENCE = date(2026, 6, 15)
AVG_PERIOD_LENGTH = 5
AVG_CYCLE_LENGTH = 28


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _seed_baseline_entries(
    svc: CycleService, user_id: uuid.UUID, ref: date = TEST_REFERENCE,
) -> list[CycleEntry]:
    """Create 5 historical cycle entries before *ref* at 28-day intervals."""
    entries = []
    for i in range(5, 0, -1):
        start = ref - timedelta(days=i * AVG_CYCLE_LENGTH)
        end = start + timedelta(days=AVG_PERIOD_LENGTH - 1)
        e = await svc.create_entry(
            user_id,
            CycleEntryCreate(period_start_date=start, period_end_date=end),
        )
        entries.append(e)
    return entries


async def _seed_prediction(
    svc: CycleService, user_id: uuid.UUID, predicted_start: date,
) -> PredictedCycle:
    from app.modules.cycle.models import PredictedCycle
    pred = PredictedCycle(
        user_id=user_id,
        is_active=True,
        predicted_next_period_start=predicted_start,
        predicted_fertile_window_start=predicted_start - timedelta(days=14),
        predicted_fertile_window_end=predicted_start - timedelta(days=10),
        model_version="rule_based_v2",
    )
    svc.db.add(pred)
    await svc.db.commit()
    await svc.db.refresh(pred)
    return pred


# ---------------------------------------------------------------------------
# Fixtures - service level
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def user(db_session: AsyncSession) -> User:
    u = User(email="sys-svc@test.com", provider="local", user_secret_key="a" * 64)
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> CycleService:
    return CycleService(db=db_session)


# ---------------------------------------------------------------------------
# Service-level tests
# ---------------------------------------------------------------------------

@freeze_time("2026-06-17")
@pytest.mark.asyncio
async def test_svc_scenario1_confirm_on_predicted_date(
    svc: CycleService, user: User,
) -> None:
    """State B: confirm period on predicted date via sticky card."""
    await _seed_baseline_entries(svc, user.id)
    await _seed_prediction(svc, user.id, TEST_REFERENCE)

    entry = await svc.create_entry(
        user.id, CycleEntryCreate(period_start_date=TEST_REFERENCE),
    )

    assert entry.period_end_date == date(2026, 6, 19)
    assert entry.is_correction is True
    assert entry.corrected_prediction_id is not None
    pred = await svc.db.get(PredictedCycle, entry.corrected_prediction_id)
    assert pred is not None
    assert pred.prediction_error_days == 0
    avg = await svc.get_avg_period_length(user.id)
    assert avg == AVG_PERIOD_LENGTH


@freeze_time("2026-06-17")
@pytest.mark.asyncio
async def test_svc_scenario2a_manual_log_within_window(
    svc: CycleService, user: User,
) -> None:
    """State B: manual period log within avg window - no end date needed."""
    await _seed_baseline_entries(svc, user.id)
    await _seed_prediction(svc, user.id, TEST_REFERENCE)

    entry = await svc.create_entry(
        user.id, CycleEntryCreate(period_start_date=TEST_REFERENCE),
    )

    assert entry.period_end_date == date(2026, 6, 19)
    assert entry.is_correction is True
    pred = await svc.db.get(PredictedCycle, entry.corrected_prediction_id)
    assert pred is not None
    assert pred.actual_cycle_entry_id == entry.id


@freeze_time("2026-06-22")
@pytest.mark.asyncio
async def test_svc_scenario2b_override_end_date_past_average(
    svc: CycleService, user: User,
) -> None:
    """State C: user overrides end_date because period lasted longer than avg."""
    await _seed_baseline_entries(svc, user.id)
    await _seed_prediction(svc, user.id, TEST_REFERENCE)

    entry = await svc.create_entry(
        user.id,
        CycleEntryCreate(
            period_start_date=TEST_REFERENCE,
            period_end_date=date(2026, 6, 21),
        ),
    )

    assert entry.period_end_date == date(2026, 6, 21)
    avg = await svc.get_avg_period_length(user.id)
    # (5 * 5 + 7) / 6 = 5.33 → rounds to 5
    assert avg == 5


@freeze_time("2026-06-25")
@pytest.mark.asyncio
async def test_svc_scenario2c_forgot_ended_past_average(
    svc: CycleService, user: User,
) -> None:
    """State C: forgot to log, period already ended, end_date required."""
    await _seed_baseline_entries(svc, user.id)
    await _seed_prediction(svc, user.id, TEST_REFERENCE)

    entry = await svc.create_entry(
        user.id,
        CycleEntryCreate(
            period_start_date=TEST_REFERENCE,
            period_end_date=date(2026, 6, 21),
        ),
    )

    assert entry.period_end_date == date(2026, 6, 21)
    assert entry.is_correction is True
    pred = await svc.db.get(PredictedCycle, entry.corrected_prediction_id)
    assert pred is not None
    assert pred.prediction_error_days == 0


@freeze_time("2026-06-15")
@pytest.mark.asyncio
async def test_svc_scenario4_early_period_before_prediction(
    svc: CycleService, user: User,
) -> None:
    """State B: period starts before AI prediction (within auto-link window)."""
    await _seed_baseline_entries(svc, user.id)
    prediction_date = TEST_REFERENCE + timedelta(days=3)  # 3-day gap = within window
    pred = await _seed_prediction(svc, user.id, prediction_date)

    entry = await svc.create_entry(
        user.id, CycleEntryCreate(period_start_date=TEST_REFERENCE),
    )

    assert entry.period_end_date == date(2026, 6, 19)
    await svc.db.refresh(pred)
    assert pred.actual_cycle_entry_id == entry.id
    assert pred.prediction_error_days == -3


@freeze_time("2026-06-25")
@pytest.mark.asyncio
async def test_svc_scenario5_forgot_last_month(
    svc: CycleService, user: User,
) -> None:
    """State C: forgot to log a period from the previous month."""
    await _seed_baseline_entries(svc, user.id)

    entry = await svc.create_entry(
        user.id,
        CycleEntryCreate(
            period_start_date=date(2026, 5, 10),
            period_end_date=date(2026, 5, 14),
        ),
    )

    assert entry.period_start_date == date(2026, 5, 10)
    assert entry.period_end_date == date(2026, 5, 14)
    entries = await svc.list_entries(user.id, months_back=24)
    assert any(e.period_start_date == date(2026, 5, 10) for e in entries)


@freeze_time("2026-06-22")
@pytest.mark.asyncio
async def test_svc_state_c_end_date_required(
    svc: CycleService, user: User,
) -> None:
    """State C without end_date raises PeriodEndDateRequiredError."""
    await _seed_baseline_entries(svc, user.id)
    await _seed_prediction(svc, user.id, TEST_REFERENCE)

    with pytest.raises(PeriodEndDateRequiredError):
        await svc.create_entry(
            user.id, CycleEntryCreate(period_start_date=TEST_REFERENCE),
        )


# ---------------------------------------------------------------------------
# Fixtures - route level
# ---------------------------------------------------------------------------

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
    """Minimal FastAPI app + authed client + seed service attached."""
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

    from fastapi import FastAPI
    app = FastAPI(title="SheCare Cycle (route test)", lifespan=_noop_lifespan)
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
            email="sys-route@test.com", provider="local", user_secret_key="a" * 64,
        )
        db.add(user1)
        await db.commit()
        await db.refresh(user1)

        settings = get_settings().jwt
        token1, _, _ = create_access_token(
            user_id=user1.id,
            email=user1.email or "",
            role=user1.role,
            user_secret_key=user1.user_secret_key,
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
        client._Session = Session
        yield client

    await engine.dispose()


# ---------------------------------------------------------------------------
# Route-level tests
# ---------------------------------------------------------------------------

async def _route_seed_baseline(client: AsyncClient, ref: date = TEST_REFERENCE) -> None:
    """Seed 5 historical entries via the API."""
    for i in range(5, 0, -1):
        start = ref - timedelta(days=i * AVG_CYCLE_LENGTH)
        end = start + timedelta(days=AVG_PERIOD_LENGTH - 1)
        resp = await client.post("/api/v1/cycle/entries", json={
            "period_start_date": start.isoformat(),
            "period_end_date": end.isoformat(),
        })
        assert resp.status_code == 201


async def _route_seed_prediction(
    client: AsyncClient, predicted_start: date,
) -> str:
    """Create a prediction directly via DB and return its ID."""
    async with client._Session() as session:
        pred = PredictedCycle(
            user_id=client.test_user.id,
            is_active=True,
            predicted_next_period_start=predicted_start,
            predicted_fertile_window_start=predicted_start - timedelta(days=14),
            predicted_fertile_window_end=predicted_start - timedelta(days=10),
            model_version="rule_based_v2",
        )
        session.add(pred)
        await session.commit()
        await session.refresh(pred)
        return str(pred.id)


@freeze_time("2026-06-17")
@pytest.mark.asyncio
async def test_route_scenario1_confirm_on_predicted_date(
    app_client: AsyncClient,
) -> None:
    await _route_seed_baseline(app_client)
    await _route_seed_prediction(app_client, TEST_REFERENCE)

    resp = await app_client.post("/api/v1/cycle/entries", json={
        "period_start_date": "2026-06-15",
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["period_end_date"] == "2026-06-19"

    calendar = await app_client.get("/api/v1/cycle/calendar")
    assert calendar.status_code == 200
    cal = calendar.json()
    for d in ("2026-06-15", "2026-06-16", "2026-06-18", "2026-06-19"):
        assert cal["days"].get(d) == "P", f"{d} should be dark pink"
    # today is "T"
    assert cal["days"].get("2026-06-17") == "T"


@freeze_time("2026-06-17")
@pytest.mark.asyncio
async def test_route_scenario2a_manual_log_within_window(
    app_client: AsyncClient,
) -> None:
    await _route_seed_baseline(app_client)
    await _route_seed_prediction(app_client, TEST_REFERENCE)

    resp = await app_client.post("/api/v1/cycle/entries", json={
        "period_start_date": "2026-06-15",
    })
    assert resp.status_code == 201
    assert resp.json()["period_end_date"] == "2026-06-19"


@freeze_time("2026-06-22")
@pytest.mark.asyncio
async def test_route_scenario2b_override_end_date(
    app_client: AsyncClient,
) -> None:
    await _route_seed_baseline(app_client)
    await _route_seed_prediction(app_client, TEST_REFERENCE)

    resp = await app_client.post("/api/v1/cycle/entries", json={
        "period_start_date": "2026-06-15",
        "period_end_date": "2026-06-22",
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["period_end_date"] == "2026-06-22"


@freeze_time("2026-06-25")
@pytest.mark.asyncio
async def test_route_scenario2c_forgot_ended_past_average(
    app_client: AsyncClient,
) -> None:
    await _route_seed_baseline(app_client)
    await _route_seed_prediction(app_client, TEST_REFERENCE)

    resp = await app_client.post("/api/v1/cycle/entries", json={
        "period_start_date": "2026-06-15",
        "period_end_date": "2026-06-21",
    })
    assert resp.status_code == 201
    assert resp.json()["period_end_date"] == "2026-06-21"


@freeze_time("2026-06-15")
@pytest.mark.asyncio
async def test_route_scenario4_early_period(
    app_client: AsyncClient,
) -> None:
    await _route_seed_baseline(app_client)
    await _route_seed_prediction(
        app_client, TEST_REFERENCE + timedelta(days=3),
    )

    resp = await app_client.post("/api/v1/cycle/entries", json={
        "period_start_date": "2026-06-15",
    })
    assert resp.status_code == 201
    assert resp.json()["period_end_date"] == "2026-06-19"

    calendar = await app_client.get("/api/v1/cycle/calendar")
    assert calendar.status_code == 200
    cal = calendar.json()
    for d in ("2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19"):
        assert cal["days"].get(d) == "P", f"{d} should be dark pink"
    # today is "T"
    assert cal["days"].get("2026-06-15") == "T"


@freeze_time("2026-06-25")
@pytest.mark.asyncio
async def test_route_scenario5_forgot_last_month(
    app_client: AsyncClient,
) -> None:
    await _route_seed_baseline(app_client)

    resp = await app_client.post("/api/v1/cycle/entries", json={
        "period_start_date": "2026-05-10",
        "period_end_date": "2026-05-14",
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["period_start_date"] == "2026-05-10"
    assert body["period_end_date"] == "2026-05-14"


@freeze_time("2026-06-22")
@pytest.mark.asyncio
async def test_route_state_c_422_when_no_end_date(
    app_client: AsyncClient,
) -> None:
    await _route_seed_baseline(app_client)
    await _route_seed_prediction(app_client, TEST_REFERENCE)

    resp = await app_client.post("/api/v1/cycle/entries", json={
        "period_start_date": "2026-06-15",
    })
    assert resp.status_code == 422
    body = resp.json()
    assert body["error"]["code"] == "PERIOD_END_DATE_REQUIRED"
