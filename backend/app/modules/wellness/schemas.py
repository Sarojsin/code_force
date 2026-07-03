"""Pydantic schemas for the wellness module."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class JournalEntryCreate(BaseModel):
    title: str | None = Field(None, max_length=200)
    content: str = Field(..., min_length=1)
    entry_date: date | None = None
    mood: str | None = None


class JournalEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str | None
    content: str
    mood: str | None
    sentiment_score: float | None
    sentiment_label: str | None
    entry_date: date
    created_at: datetime
    updated_at: datetime


class JournalEntryMetadata(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str | None
    entry_date: date
    sentiment_label: str | None
    mood: str | None
    created_at: datetime


class MoodLogCreate(BaseModel):
    mood: str = Field(..., max_length=50)
    intensity: int = Field(default=3, ge=1, le=10)
    notes: str | None = None
    logged_at: datetime | None = None


class MoodLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    mood: str
    intensity: int
    notes: str | None
    logged_at: datetime


class BreathingExerciseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    title: str
    description: str | None = None
    technique: str | None = None
    duration_seconds: int
    instructions: dict
    audio_url: str | None

    @classmethod
    def model_validate(cls, obj, **kwargs):
        inst = obj.instructions or {}
        return cls(
            id=obj.id,
            name=obj.name,
            title=obj.name,
            description=inst.get("description", obj.name),
            technique=inst.get("technique", ""),
            duration_seconds=obj.duration_seconds,
            instructions=obj.instructions,
            audio_url=obj.audio_url,
        )


class ExerciseSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    exercise_id: uuid.UUID
    completed_at: datetime


class InsightResponse(BaseModel):
    total_journal_entries: int = 0
    total_mood_logs: int = 0
    average_mood_intensity: float | None = None
    most_common_mood: str | None = None
    recommendation: str | None = None


class JournalAnalysisCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    journal_id: uuid.UUID
    mood_score: float = Field(..., ge=1, le=10)
    sentiment: str = Field(..., pattern=r"^(positive|negative|neutral)$")
    symptom_mentions: list[str] = Field(default_factory=list)
    crisis_flags: dict[str, bool] = Field(default_factory=dict)
    model_version: str = Field(..., max_length=20)
    inference_time_ms: float = Field(..., ge=0)


class JournalAnalysisResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: uuid.UUID
    journal_id: uuid.UUID
    user_id: uuid.UUID
    mood_score: float
    sentiment: str
    symptom_mentions: list[str]
    crisis_flags: dict[str, bool]
    model_version: str
    inference_time_ms: float
    created_at: datetime


class ModelVersionResponse(BaseModel):
    version: str
    size_mb: int
    checksum_sha256: str
