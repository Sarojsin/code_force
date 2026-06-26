"""Pregnancy support service tests."""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")

import uuid
from collections.abc import AsyncIterator
from datetime import date, timedelta

import pytest
import pytest_asyncio
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

from app.core.database import Base
from app.modules.pregnancy.exceptions import (
    ActivePregnancyExistsError,
    PregnancyProfileNotFoundError,
)
from app.modules.pregnancy.models import PregnancyMilestone
from app.modules.pregnancy.schemas import (
    DailyLogCreate,
    PregnancyProfileCreate,
    PregnancyProfileUpdate,
)
from app.modules.pregnancy.services import PregnancyService


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models as _auth_models  # noqa: F401 (users table for FK)
        from app.modules.pregnancy import models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> PregnancyService:
    return PregnancyService(db=db_session)


user_id = uuid.uuid4()
lmp_date = date.today() - timedelta(days=8 * 7)
due_date = lmp_date + timedelta(days=280)


@pytest.mark.asyncio
async def test_create_profile(svc: PregnancyService) -> None:
    data = PregnancyProfileCreate(due_date=due_date, lmp_date=lmp_date)
    profile = await svc.create_profile(user_id, data)
    assert profile.id is not None
    assert profile.current_week == 9
    assert profile.is_active is True


@pytest.mark.asyncio
async def test_create_duplicate_profile_raises(svc: PregnancyService) -> None:
    data = PregnancyProfileCreate(due_date=due_date, lmp_date=lmp_date)
    await svc.create_profile(user_id, data)
    with pytest.raises(ActivePregnancyExistsError):
        await svc.create_profile(user_id, data)


@pytest.mark.asyncio
async def test_get_profile_not_found(svc: PregnancyService) -> None:
    with pytest.raises(PregnancyProfileNotFoundError):
        await svc.get_profile(user_id)


@pytest.mark.asyncio
async def test_update_profile(svc: PregnancyService) -> None:
    data = PregnancyProfileCreate(due_date=due_date, lmp_date=lmp_date)
    await svc.create_profile(user_id, data)
    new_due_date = due_date + timedelta(days=7)
    updated = await svc.update_profile(user_id, PregnancyProfileUpdate(due_date=new_due_date))
    assert updated.due_date == new_due_date


@pytest.mark.asyncio
async def test_archive_profile(svc: PregnancyService) -> None:
    data = PregnancyProfileCreate(due_date=due_date, lmp_date=lmp_date)
    await svc.create_profile(user_id, data)
    await svc.archive_profile(user_id)
    with pytest.raises(PregnancyProfileNotFoundError):
        await svc.get_profile(user_id)


@pytest.mark.asyncio
async def test_daily_log_crud(svc: PregnancyService) -> None:
    data = PregnancyProfileCreate(due_date=due_date, lmp_date=lmp_date)
    profile = await svc.create_profile(user_id, data)
    log = await svc.create_daily_log(profile.id, DailyLogCreate(symptoms=["nausea"], mood="tired"))
    assert log.symptoms == ["nausea"]
    assert log.mood == "tired"
    logs = await svc.list_daily_logs(profile.id)
    assert len(logs) == 1


@pytest.mark.asyncio
async def test_get_milestone(svc: PregnancyService) -> None:
    milestone = PregnancyMilestone(week=12, development_tip="Baby is fully formed")
    svc.db.add(milestone)
    await svc.db.commit()
    result = await svc.get_milestone(12)
    assert result.development_tip == "Baby is fully formed"


@pytest.mark.asyncio
async def test_get_recommendations(svc: PregnancyService) -> None:
    data = PregnancyProfileCreate(due_date=due_date, lmp_date=lmp_date)
    await svc.create_profile(user_id, data)
    recs = await svc.get_recommendations(user_id)
    assert recs["week"] == 9
    assert recs["trimester"] == "first"
    assert len(recs["tips"]) > 0


@pytest.mark.asyncio
async def test_compute_week(svc: PregnancyService) -> None:
    week = svc._compute_week(date.today() - timedelta(days=14))
    assert week == 3


@pytest.mark.asyncio
async def test_get_trimester(svc: PregnancyService) -> None:
    assert svc._get_trimester(8) == "first"
    assert svc._get_trimester(20) == "second"
    assert svc._get_trimester(30) == "third"
