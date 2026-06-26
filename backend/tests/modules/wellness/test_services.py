"""Wellness journal service tests."""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import uuid
from collections.abc import AsyncIterator
from datetime import date

import pytest
import pytest_asyncio
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.database import Base
from app.core.encryption import EncryptionService, make_user_salt


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"
from app.modules.wellness.exceptions import ExerciseNotFoundError, JournalEntryNotFoundError
from app.modules.wellness.models import BreathingExercise
from app.modules.wellness.schemas import JournalAnalysisCreate, JournalEntryCreate, MoodLogCreate
from app.modules.wellness.services import JournalAnalysisService, WellnessService


class _FakeHuggingFaceClient:
    async def analyze(self, text: str) -> dict:
        return {"sentiment": "positive", "score": 0.9}


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models as _auth_models  # noqa: F401 (users table for FK)
        from app.modules.wellness import models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> WellnessService:
    encryption = EncryptionService()
    return WellnessService(db=db_session, encryption=encryption, hf_client=_FakeHuggingFaceClient())


user_id = uuid.uuid4()
user_salt = make_user_salt()


@pytest.mark.asyncio
async def test_create_journal_entry(svc: WellnessService) -> None:
    data = JournalEntryCreate(content="Today was a good day")
    entry = await svc.create_journal_entry(user_id, data, user_salt)
    assert entry.id is not None
    assert entry.content != "Today was a good day"
    assert entry.entry_date == date.today()


@pytest.mark.asyncio
async def test_get_journal_entry(svc: WellnessService) -> None:
    data = JournalEntryCreate(content="Feeling great")
    entry = await svc.create_journal_entry(user_id, data, user_salt)
    fetched = await svc.get_journal_entry(entry.id, user_id)
    assert fetched.id == entry.id


@pytest.mark.asyncio
async def test_get_journal_entry_not_found(svc: WellnessService) -> None:
    with pytest.raises(JournalEntryNotFoundError):
        await svc.get_journal_entry(uuid.uuid4(), user_id)


@pytest.mark.asyncio
async def test_list_journal_entries(svc: WellnessService) -> None:
    for i in range(3):
        await svc.create_journal_entry(user_id, JournalEntryCreate(content=f"Entry {i}"), user_salt)
    entries = await svc.list_journal_entries(user_id)
    assert len(entries) == 3


@pytest.mark.asyncio
async def test_delete_journal_entry(svc: WellnessService) -> None:
    data = JournalEntryCreate(content="To delete")
    entry = await svc.create_journal_entry(user_id, data, user_salt)
    await svc.delete_journal_entry(entry.id, user_id)
    with pytest.raises(JournalEntryNotFoundError):
        await svc.get_journal_entry(entry.id, user_id)


@pytest.mark.asyncio
async def test_log_mood(svc: WellnessService) -> None:
    data = MoodLogCreate(mood="happy", intensity=4)
    mood = await svc.log_mood(user_id, data)
    assert mood.mood == "happy"
    assert mood.intensity == 4


@pytest.mark.asyncio
async def test_list_mood_history(svc: WellnessService) -> None:
    await svc.log_mood(user_id, MoodLogCreate(mood="happy", intensity=4))
    await svc.log_mood(user_id, MoodLogCreate(mood="calm", intensity=3))
    moods = await svc.list_mood_history(user_id, days_back=30)
    assert len(moods) == 2


@pytest.mark.asyncio
async def test_list_exercises(svc: WellnessService) -> None:
    # Seed an exercise directly
    exercise = BreathingExercise(name="4-7-8 Breathing", instructions={"description": "Inhale 4, hold 7, exhale 8"}, duration_seconds=120)
    svc.db.add(exercise)
    await svc.db.commit()
    exercises = await svc.list_exercises()
    assert len(exercises) == 1


@pytest.mark.asyncio
async def test_log_exercise_completion_not_found(svc: WellnessService) -> None:
    with pytest.raises(ExerciseNotFoundError):
        await svc.log_exercise_completion(user_id, uuid.uuid4())


@pytest.mark.asyncio
async def test_get_insights_empty(svc: WellnessService) -> None:
    insights = await svc.get_insights(user_id)
    assert insights["total_journal_entries"] == 0
    assert insights["total_mood_logs"] == 0
    assert insights["recommendation"] is not None


@pytest.mark.asyncio
async def test_get_insights(svc: WellnessService) -> None:
    await svc.create_journal_entry(user_id, JournalEntryCreate(content="Day 1"), user_salt)
    await svc.log_mood(user_id, MoodLogCreate(mood="happy", intensity=5))
    insights = await svc.get_insights(user_id)
    assert insights["total_journal_entries"] == 1
    assert insights["total_mood_logs"] == 1


@pytest.mark.asyncio
async def test_log_exercise_completion_success(svc: WellnessService) -> None:
    exercise = BreathingExercise(name="Box Breathing", instructions={"desc": "4-4-4-4"}, duration_seconds=60)
    svc.db.add(exercise)
    await svc.db.commit()
    await svc.db.refresh(exercise)
    session = await svc.log_exercise_completion(user_id, exercise.id)
    assert session.exercise_id == exercise.id
    assert session.user_id == user_id
    assert session.completed_at is not None


@pytest.mark.asyncio
async def test_get_insights_great_consistency(svc: WellnessService) -> None:
    for i in range(5):
        await svc.create_journal_entry(user_id, JournalEntryCreate(content=f"Day {i}"), user_salt)
    for _ in range(10):
        await svc.log_mood(user_id, MoodLogCreate(mood="happy", intensity=3))
    insights = await svc.get_insights(user_id)
    assert insights["total_journal_entries"] >= 5
    assert insights["total_mood_logs"] >= 10
    assert insights["recommendation"] == "Great consistency! Consider reviewing your mood patterns weekly."


@pytest.mark.asyncio
async def test_list_mood_history_empty(svc: WellnessService) -> None:
    moods = await svc.list_mood_history(user_id, days_back=7)
    assert moods == []


@pytest.mark.asyncio
async def test_create_analysis(svc: WellnessService) -> None:
    entry = await svc.create_journal_entry(user_id, JournalEntryCreate(content="Analysis test"), user_salt)
    analysis_svc = JournalAnalysisService(db=svc.db)
    data = JournalAnalysisCreate(
        journal_id=entry.id,
        mood_score=7.5,
        sentiment="positive",
        symptom_mentions=["headache"],
        crisis_flags={"crisis": False},
        model_version="v1.0",
        inference_time_ms=150.0,
    )
    analysis = await analysis_svc.create_analysis(user_id, data)
    assert analysis.journal_id == entry.id
    assert analysis.sentiment == "positive"
    assert analysis.mood_score == 7.5


@pytest.mark.asyncio
async def test_create_analysis_entry_not_found(svc: WellnessService) -> None:
    analysis_svc = JournalAnalysisService(db=svc.db)
    data = JournalAnalysisCreate(
        journal_id=uuid.uuid4(),
        mood_score=5.0,
        sentiment="neutral",
        model_version="v1.0",
        inference_time_ms=100.0,
    )
    with pytest.raises(JournalEntryNotFoundError):
        await analysis_svc.create_analysis(user_id, data)


@pytest.mark.asyncio
async def test_get_analysis(svc: WellnessService) -> None:
    entry = await svc.create_journal_entry(user_id, JournalEntryCreate(content="Get analysis test"), user_salt)
    analysis_svc = JournalAnalysisService(db=svc.db)
    data = JournalAnalysisCreate(
        journal_id=entry.id,
        mood_score=8.0,
        sentiment="positive",
        model_version="v1.0",
        inference_time_ms=120.0,
    )
    await analysis_svc.create_analysis(user_id, data)
    result = await analysis_svc.get_analysis(entry.id, user_id)
    assert result is not None
    assert result.sentiment == "positive"


@pytest.mark.asyncio
async def test_get_analysis_not_found(svc: WellnessService) -> None:
    analysis_svc = JournalAnalysisService(db=svc.db)
    result = await analysis_svc.get_analysis(uuid.uuid4(), user_id)
    assert result is None
