"""Onboarding service tests: upsert, backfill, idempotency, status."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from datetime import date

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.database import Base
from app.core.event_bus import EventBus


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"
from app.modules.auth.models import User
from app.modules.cycle.models import CycleEntry
from app.modules.onboarding.schemas import OnboardingCreate, PastCycleSchema
from app.modules.onboarding.services import OnboardingService


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models as _auth_models  # noqa: F401
        from app.modules.cycle import models as _cycle_models  # noqa: F401
        from app.modules.onboarding import models as _onboard_models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def user(db_session: AsyncSession) -> User:
    u = User(
        email="onboard@test.com",
        provider="local",
        user_secret_key="a" * 64,
    )
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> OnboardingService:
    return OnboardingService(db=db_session, event_bus=EventBus())


SAMPLE_DATA = OnboardingCreate(
    age=28,
    height_cm=165.0,
    weight_kg=60.0,
    stress_level="moderate",
    exercise_frequency="moderate",
    sleep_hours=7.5,
    diet="balanced",
    current_cycle_start=date(2026, 6, 1),
    current_cycle_length=28,
    current_period_length=5,
    current_symptoms=["Cramps", "Bloating"],
    past_cycles=[
        PastCycleSchema(
            cycle_start=date(2026, 5, 4),
            cycle_length=28,
            period_length=5,
            symptoms=["Headache"],
        ),
        PastCycleSchema(
            cycle_start=date(2026, 4, 6),
            cycle_length=28,
            period_length=4,
            symptoms=[],
        ),
    ],
)


@pytest.mark.asyncio
async def test_onboarding_upsert_creates_record(svc: OnboardingService, user: User) -> None:
    onboarding = await svc.create_or_update(user.id, SAMPLE_DATA)
    assert onboarding.user_id == user.id
    assert onboarding.age == 28
    assert onboarding.onboarding_completed is True
    assert onboarding.completed_at is not None
    assert onboarding.current_symptoms == ["Cramps", "Bloating"]
    assert len(onboarding.past_cycles) == 2


@pytest.mark.asyncio
async def test_onboarding_upsert_updates_existing(svc: OnboardingService, user: User) -> None:
    await svc.create_or_update(user.id, SAMPLE_DATA)
    updated_data = SAMPLE_DATA.model_copy(update={"age": 30, "current_symptoms": ["Acne"]})
    onboarding = await svc.create_or_update(user.id, updated_data)
    assert onboarding.age == 30
    assert onboarding.current_symptoms == ["Acne"]
    assert onboarding.onboarding_completed is True


@pytest.mark.asyncio
async def test_onboarding_get_returns_record(svc: OnboardingService, user: User) -> None:
    await svc.create_or_update(user.id, SAMPLE_DATA)
    onboarding = await svc.get_onboarding(user.id)
    assert onboarding.user_id == user.id
    assert onboarding.age == 28


@pytest.mark.asyncio
async def test_onboarding_get_raises_not_found(svc: OnboardingService, user: User) -> None:
    from app.modules.onboarding.exceptions import OnboardingNotFoundError
    with pytest.raises(OnboardingNotFoundError):
        await svc.get_onboarding(user.id)


@pytest.mark.asyncio
async def test_onboarding_status_false_when_not_completed(svc: OnboardingService, user: User) -> None:
    status = await svc.get_status(user.id)
    assert status is False


@pytest.mark.asyncio
async def test_onboarding_status_true_after_completion(svc: OnboardingService, user: User) -> None:
    await svc.create_or_update(user.id, SAMPLE_DATA)
    status = await svc.get_status(user.id)
    assert status is True


@pytest.mark.asyncio
async def test_backfill_creates_cycle_entries(
    svc: OnboardingService, user: User, db_session: AsyncSession,
) -> None:
    await svc.create_or_update(user.id, SAMPLE_DATA)
    stmt = (
        select(CycleEntry)
        .where(CycleEntry.user_id == user.id)
        .where(CycleEntry.is_active.is_(True))
    )
    entries = (await db_session.execute(stmt)).scalars().all()
    # 1 current + 2 past = 3 entries
    assert len(entries) == 3
    start_dates = {e.period_start_date for e in entries}
    assert date(2026, 6, 1) in start_dates
    assert date(2026, 5, 4) in start_dates
    assert date(2026, 4, 6) in start_dates


@pytest.mark.asyncio
async def test_backfill_idempotent_skips_duplicates(
    svc: OnboardingService, user: User, db_session: AsyncSession,
) -> None:
    await svc.create_or_update(user.id, SAMPLE_DATA)
    await svc.create_or_update(user.id, SAMPLE_DATA)
    stmt = (
        select(CycleEntry)
        .where(CycleEntry.user_id == user.id)
        .where(CycleEntry.is_active.is_(True))
    )
    entries = (await db_session.execute(stmt)).scalars().all()
    assert len(entries) == 3


@pytest.mark.asyncio
async def test_backfill_no_past_cycles(
    svc: OnboardingService, user: User, db_session: AsyncSession,
) -> None:
    data = SAMPLE_DATA.model_copy(update={"past_cycles": []})
    await svc.create_or_update(user.id, data)
    stmt = (
        select(CycleEntry)
        .where(CycleEntry.user_id == user.id)
        .where(CycleEntry.is_active.is_(True))
    )
    entries = (await db_session.execute(stmt)).scalars().all()
    assert len(entries) == 1  # only current cycle


@pytest.mark.asyncio
async def test_event_emitted_on_first_completion(svc: OnboardingService, user: User) -> None:
    events: list[str] = []
    async def handler(user_id: str) -> None:
        events.append(user_id)
    svc.event_bus.subscribe_sync("onboarding_completed", handler)
    await svc.create_or_update(user.id, SAMPLE_DATA)
    assert len(events) == 1
    assert events[0] == str(user.id)


@pytest.mark.asyncio
async def test_event_not_emitted_on_repeated_completion(
    svc: OnboardingService, user: User,
) -> None:
    events: list[str] = []
    async def handler(user_id: str) -> None:
        events.append(user_id)
    svc.event_bus.subscribe_sync("onboarding_completed", handler)
    await svc.create_or_update(user.id, SAMPLE_DATA)
    await svc.create_or_update(user.id, SAMPLE_DATA)
    assert len(events) == 1  # only emitted once
