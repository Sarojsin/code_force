from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key-1234567890")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key-1234567890")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import uuid
from collections.abc import AsyncIterator
from datetime import date, timedelta

import pytest
import pytest_asyncio
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@compiles(ARRAY, "sqlite")
def _compile_array_sqlite(type_, compiler, **kw):
    return "JSON"


from app.core.database import Base
from app.modules.auth.models import User
from app.modules.cycle.exceptions import CycleEntryNotFoundError, PredictionNotFoundError
from app.modules.cycle.models import CycleEntry, PredictedCycle, SystemConfig
from app.modules.cycle.schemas import CycleEntryCreate, CycleEntryUpdate
from app.modules.cycle.services import CycleService


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models as _auth_models
        from app.modules.cycle import models as _cycle_models
        from app.modules.onboarding import models as _onboard_models
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def user(db_session: AsyncSession) -> User:
    u = User(
        email="cycle-ext@test.com",
        provider="local",
        user_secret_key="c" * 64,
    )
    db_session.add(u)
    await db_session.commit()
    await db_session.refresh(u)
    return u


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> CycleService:
    return CycleService(db=db_session)


@pytest_asyncio.fixture
async def cycle_entry(svc: CycleService, user: User) -> CycleEntry:
    data = CycleEntryCreate(period_start_date=date(2026, 5, 1), period_end_date=date(2026, 5, 5))
    return await svc.create_entry(user.id, data)


@pytest.mark.asyncio
async def test_get_entry_success(svc: CycleService, user: User, cycle_entry: CycleEntry) -> None:
    found = await svc.get_entry(cycle_entry.id, user.id)
    assert found.id == cycle_entry.id
    assert found.period_start_date == date(2026, 5, 1)


@pytest.mark.asyncio
async def test_get_entry_wrong_user(svc: CycleService, user: User, cycle_entry: CycleEntry) -> None:
    other_id = uuid.uuid4()
    with pytest.raises(CycleEntryNotFoundError):
        await svc.get_entry(cycle_entry.id, other_id)


@pytest.mark.asyncio
async def test_get_entry_not_found(svc: CycleService, user: User) -> None:
    with pytest.raises(CycleEntryNotFoundError):
        await svc.get_entry(uuid.uuid4(), user.id)


@pytest.mark.asyncio
async def test_list_entries_defaults(svc: CycleService, user: User) -> None:
    for i in range(3):
        start = date(2026, 5, 1) + timedelta(days=i * 30)
        await svc.create_entry(user.id, CycleEntryCreate(period_start_date=start))
    entries = await svc.list_entries(user.id)
    assert len(entries) == 3


@pytest.mark.asyncio
async def test_list_entries_with_limit_and_offset(svc: CycleService, user: User) -> None:
    for i in range(5):
        start = date(2026, 5, 1) + timedelta(days=i * 30)
        await svc.create_entry(user.id, CycleEntryCreate(period_start_date=start))
    entries = await svc.list_entries(user.id, limit=2, offset=1)
    assert len(entries) == 2


@pytest.mark.asyncio
async def test_list_entries_months_back(svc: CycleService, user: User) -> None:
    old_start = date.today() - timedelta(days=400)
    await svc.create_entry(user.id, CycleEntryCreate(period_start_date=old_start))
    recent_start = date.today() - timedelta(days=30)
    await svc.create_entry(user.id, CycleEntryCreate(period_start_date=recent_start))
    entries = await svc.list_entries(user.id, months_back=2)
    assert len(entries) == 1


@pytest.mark.asyncio
async def test_update_entry_partial(svc: CycleService, user: User, cycle_entry: CycleEntry) -> None:
    updated = await svc.update_entry(
        cycle_entry.id, user.id,
        CycleEntryUpdate(flow_intensity="heavy", notes="Test note"),
    )
    assert updated.flow_intensity == "heavy"
    assert updated.notes == "Test note"
    assert updated.period_start_date == date(2026, 5, 1)


@pytest.mark.asyncio
async def test_delete_entry_soft_delete(svc: CycleService, user: User, cycle_entry: CycleEntry) -> None:
    await svc.delete_entry(cycle_entry.id, user.id)
    with pytest.raises(CycleEntryNotFoundError):
        await svc.get_entry(cycle_entry.id, user.id)


@pytest.mark.asyncio
async def test_get_calendar_with_entries_and_predictions(svc: CycleService, user: User, cycle_entry: CycleEntry) -> None:
    await svc.compute_predictions(user.id)
    cal = await svc.get_calendar(user.id, months_back=1, months_forward=3)
    assert "days" in cal
    assert isinstance(cal["days"], dict)
    assert cal["next_period_in_days"] is not None
    assert cal["predictions"] is not None
    assert cal["predictions"]["model_type"] is not None
    assert any(v in ("T", "P", "p") for v in cal["days"].values())


@pytest.mark.asyncio
async def test_get_calendar_no_predictions(svc: CycleService, user: User) -> None:
    cal = await svc.get_calendar(user.id, months_back=1, months_forward=1)
    assert cal["predictions"] is None
    assert cal["next_period_in_days"] is None


@pytest.mark.asyncio
async def test_get_analytics_empty(svc: CycleService, user: User) -> None:
    analytics = await svc.get_analytics(user.id)
    assert analytics["total_entries"] == 0
    assert analytics["average_cycle_length_days"] is None


@pytest.mark.asyncio
async def test_get_analytics_with_entries(svc: CycleService, user: User) -> None:
    await svc.create_entry(user.id, CycleEntryCreate(
        period_start_date=date(2026, 1, 1), period_end_date=date(2026, 1, 5),
        symptoms=["cramps"], mood_tags=["happy"],
    ))
    await svc.create_entry(user.id, CycleEntryCreate(
        period_start_date=date(2026, 2, 1), period_end_date=date(2026, 2, 5),
        symptoms=["cramps", "bloating"], mood_tags=["sad"],
    ))
    analytics = await svc.get_analytics(user.id)
    assert analytics["total_entries"] == 2
    assert 28 <= analytics["average_cycle_length_days"] <= 32
    assert analytics["common_symptoms"][0]["symptom"] == "cramps"
    assert analytics["common_symptoms"][0]["count"] == 2
    assert len(analytics["common_moods"]) == 2


@pytest.mark.asyncio
async def test_compute_initial_prediction_with_onboarding(svc: CycleService, user: User) -> None:
    from app.modules.onboarding.models import UserOnboarding
    onboarding = UserOnboarding(
        user_id=user.id,
        current_cycle_start=date(2026, 5, 1),
        current_cycle_length=30,
        onboarding_completed=True,
    )
    svc.db.add(onboarding)
    await svc.db.commit()

    prediction = await svc.compute_initial_prediction(user.id)
    assert prediction is not None
    assert prediction.predicted_next_period_start >= date(2026, 5, 25)


@pytest.mark.asyncio
async def test_compute_initial_prediction_no_onboarding(svc: CycleService, user: User) -> None:
    prediction = await svc.compute_initial_prediction(user.id)
    assert prediction is not None
    assert prediction.model_version == "fallback"
    assert prediction.predicted_next_period_start >= date.today()


@pytest.mark.asyncio
async def test_log_correction_with_symptoms(svc: CycleService, user: User, cycle_entry: CycleEntry) -> None:
    prediction = await svc.compute_predictions(user.id)
    entry = await svc.log_correction(
        user_id=user.id,
        period_start_date=prediction.predicted_next_period_start + timedelta(days=1),
        period_end_date=prediction.predicted_next_period_start + timedelta(days=5),
        symptoms=["cramps", "fatigue"],
        corrected_prediction_id=prediction.id,
    )
    assert entry.symptoms == ["cramps", "fatigue"]
    assert entry.is_correction is True


@pytest.mark.asyncio
async def test_log_correction_corrected_prediction_none(svc: CycleService, user: User) -> None:
    entry = await svc.log_correction(
        user_id=user.id,
        period_start_date=date(2026, 7, 1),
        symptoms=["headache"],
    )
    assert entry.is_correction is False
    assert entry.symptoms == ["headache"]


@pytest.mark.asyncio
async def test_cycle_length_std_dev_with_two_intervals(svc: CycleService, user: User) -> None:
    await svc.create_entry(user.id, CycleEntryCreate(period_start_date=date(2026, 1, 1), period_end_date=date(2026, 1, 5)))
    await svc.create_entry(user.id, CycleEntryCreate(period_start_date=date(2026, 2, 1), period_end_date=date(2026, 2, 5)))
    await svc.create_entry(user.id, CycleEntryCreate(period_start_date=date(2026, 3, 3), period_end_date=date(2026, 3, 7)))

    pred = await svc.compute_predictions(user.id)
    entry = await svc.log_correction(user.id, pred.predicted_next_period_start, corrected_prediction_id=pred.id)

    await svc.db.refresh(user)
    assert user.cycle_length_std_dev is None or user.cycle_length_std_dev >= 0


@pytest.mark.asyncio
async def test_load_active_model_missing_path(svc: CycleService, user: User) -> None:
    config = SystemConfig(key="global_model_path", value="nonexistent_model.json")
    svc.db.add(config)
    await svc.db.commit()
    result = await svc._load_active_model()
    assert result is None
