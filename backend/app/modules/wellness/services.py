"""Wellness service methods: journals, mood logs, breathing exercises, insights."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.encryption import EncryptionService
from app.integrations.huggingface_client import HuggingFaceClient
from app.modules.wellness.exceptions import ExerciseNotFoundError, JournalEntryNotFoundError
from app.modules.wellness.models import (
    BreathingExercise,
    JournalAnalysis,
    JournalEntry,
    MoodLog,
    UserExerciseSession,
)
from app.modules.wellness.schemas import (
    JournalAnalysisCreate,
    JournalEntryCreate,
    MoodLogCreate,
)


class WellnessService:
    def __init__(
        self, db: AsyncSession, encryption: EncryptionService, hf_client: HuggingFaceClient,
    ) -> None:
        self.db = db
        self.encryption = encryption
        self.hf_client = hf_client

    async def create_journal_entry(
        self, user_id: uuid.UUID, data: JournalEntryCreate, user_salt: str | None,
    ) -> JournalEntry:
        encrypted_content = self.encryption.encrypt_for_user(data.content, user_salt or "")
        entry = JournalEntry(
            user_id=user_id,
            content=encrypted_content,
            entry_date=data.entry_date or date.today(),
        )
        self.db.add(entry)
        await self.db.commit()
        await self.db.refresh(entry)
        return entry

    async def get_journal_entry(self, entry_id: uuid.UUID, user_id: uuid.UUID) -> JournalEntry:
        stmt = (
            select(JournalEntry)
            .where(JournalEntry.id == entry_id)
            .where(JournalEntry.user_id == user_id)
            .where(JournalEntry.is_active.is_(True))
        )
        entry = (await self.db.execute(stmt)).scalar_one_or_none()
        if entry is None:
            raise JournalEntryNotFoundError("Journal entry not found")
        return entry

    async def list_journal_entries(
        self, user_id: uuid.UUID, limit: int = 50, offset: int = 0,
    ) -> list[JournalEntry]:
        stmt = (
            select(JournalEntry)
            .where(JournalEntry.user_id == user_id)
            .where(JournalEntry.is_active.is_(True))
            .order_by(JournalEntry.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def delete_journal_entry(self, entry_id: uuid.UUID, user_id: uuid.UUID) -> None:
        entry = await self.get_journal_entry(entry_id, user_id)
        entry.is_active = False
        await self.db.commit()

    async def log_mood(self, user_id: uuid.UUID, data: MoodLogCreate) -> MoodLog:
        mood = MoodLog(
            user_id=user_id,
            mood=data.mood,
            intensity=data.intensity,
            logged_at=data.logged_at or datetime.now(tz=UTC),
        )
        self.db.add(mood)
        await self.db.commit()
        await self.db.refresh(mood)
        return mood

    async def list_mood_history(
        self, user_id: uuid.UUID, days_back: int = 30,
    ) -> list[MoodLog]:
        cutoff = datetime.now(tz=UTC) - timedelta(days=days_back)
        stmt = (
            select(MoodLog)
            .where(MoodLog.user_id == user_id)
            .where(MoodLog.logged_at >= cutoff)
            .order_by(MoodLog.logged_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_exercises(self) -> list[BreathingExercise]:
        stmt = select(BreathingExercise).where(BreathingExercise.is_active.is_(True))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def log_exercise_completion(
        self, user_id: uuid.UUID, exercise_id: uuid.UUID,
    ) -> UserExerciseSession:
        ex_stmt = select(BreathingExercise).where(BreathingExercise.id == exercise_id)
        exercise = (await self.db.execute(ex_stmt)).scalar_one_or_none()
        if exercise is None:
            raise ExerciseNotFoundError("Exercise not found")
        session = UserExerciseSession(
            user_id=user_id,
            exercise_id=exercise_id,
            completed_at=datetime.now(tz=UTC),
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def get_insights(self, user_id: uuid.UUID) -> dict:
        journal_count_q = (
            select(func.count(JournalEntry.id))
            .where(JournalEntry.user_id == user_id)
            .where(JournalEntry.is_active.is_(True))
        )
        journal_count = (await self.db.execute(journal_count_q)).scalar() or 0

        cutoff = datetime.now(tz=UTC) - timedelta(days=30)
        mood_count_q = (
            select(func.count(MoodLog.id))
            .where(MoodLog.user_id == user_id)
            .where(MoodLog.logged_at >= cutoff)
        )
        mood_count = (await self.db.execute(mood_count_q)).scalar() or 0

        avg_intensity_q = (
            select(func.avg(MoodLog.intensity))
            .where(MoodLog.user_id == user_id)
            .where(MoodLog.logged_at >= cutoff)
        )
        avg = (await self.db.execute(avg_intensity_q)).scalar()

        most_common_q = (
            select(MoodLog.mood, func.count(MoodLog.id).label("cnt"))
            .where(MoodLog.user_id == user_id)
            .where(MoodLog.logged_at >= cutoff)
            .group_by(MoodLog.mood)
            .order_by(func.count(MoodLog.id).desc())
            .limit(1)
        )
        top = (await self.db.execute(most_common_q)).first()
        most_common_mood = top[0] if top else None

        recommendation = "Keep logging your moods and journal entries for personalized insights."
        if journal_count >= 5 and mood_count >= 10:
            recommendation = "Great consistency! Consider reviewing your mood patterns weekly."

        return {
            "total_journal_entries": journal_count,
            "total_mood_logs": mood_count,
            "average_mood_intensity": round(float(avg), 2) if avg else None,
            "most_common_mood": most_common_mood,
            "recommendation": recommendation,
        }


class JournalAnalysisService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_analysis(
        self, user_id: uuid.UUID, data: JournalAnalysisCreate,
    ) -> JournalAnalysis:
        stmt = (
            select(JournalEntry)
            .where(JournalEntry.id == data.journal_id)
            .where(JournalEntry.user_id == user_id)
            .where(JournalEntry.is_active.is_(True))
        )
        entry = (await self.db.execute(stmt)).scalar_one_or_none()
        if entry is None:
            raise JournalEntryNotFoundError("Journal entry not found")

        analysis = JournalAnalysis(
            journal_id=data.journal_id,
            user_id=user_id,
            mood_score=data.mood_score,
            sentiment=data.sentiment,
            symptom_mentions=data.symptom_mentions,
            crisis_flags=data.crisis_flags,
            model_version=data.model_version,
            inference_time_ms=data.inference_time_ms,
            created_at=datetime.now(tz=UTC),
        )
        self.db.add(analysis)
        await self.db.commit()
        await self.db.refresh(analysis)
        return analysis

    async def get_analysis(
        self, journal_id: uuid.UUID, user_id: uuid.UUID,
    ) -> JournalAnalysis | None:
        stmt = (
            select(JournalAnalysis)
            .where(JournalAnalysis.journal_id == journal_id)
            .where(JournalAnalysis.user_id == user_id)
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()
