"""Luna companion schemas.

Schema split per AGENTS.md §1.7: ``LunaStateUpdate`` (PUT, all optional) vs
``LunaStateResponse`` (GET, includes id + timestamps). Size caps are enforced
both here (Pydantic constraints → 422) and in the service layer — uploads over
the cap fail loudly, never silently truncate.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

MoodValue = Literal["happy", "sad", "anxious", "angry", "neutral"]
MoodSource = Literal["day_logged", "manual", "journal_analysis"]
MoodTrendValue = Literal["improving", "declining", "stable", "volatile"]

MAX_MOOD_SAMPLES = 30
MAX_ACHIEVEMENTS = 100
MAX_PREFERENCES_KEYS = 50
MAX_HABIT_KEYS = 100
MAX_TOP_LOG_TYPES = 20


class MoodSample(BaseModel):
    """Typed mood sample — never a free-form dict (prevents drift)."""

    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$", description="Local date YYYY-MM-DD")
    mood: MoodValue
    intensity: int = Field(ge=1, le=5)
    source: MoodSource
    created_at: datetime

    @field_validator("date")
    @classmethod
    def _valid_date(cls, value: str) -> str:
        date.fromisoformat(value)  # raises ValueError on malformed dates
        return value


class MoodTrendPayload(BaseModel):
    """Client-supplied mood aggregate; ``trend`` is always recomputed server-side."""

    samples: list[MoodSample] = Field(default_factory=list, max_length=MAX_MOOD_SAMPLES)
    trend: MoodTrendValue | None = None
    updated_at: datetime | None = None


class AchievementItem(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    unlocked_at: datetime


class LunaStateUpdate(BaseModel):
    """PUT body — all fields optional (LWW merge, fields not sent stay untouched)."""

    xp: int | None = Field(default=None, ge=0)
    level: int | None = Field(default=None, ge=1)
    coins: int | None = Field(default=None, ge=0)
    relationship_level: int | None = Field(default=None, ge=1)
    mood_trend: MoodTrendPayload | None = None
    preferences: dict[str, object] | None = None
    achievements: list[AchievementItem] | None = Field(
        default=None, max_length=MAX_ACHIEVEMENTS
    )
    habit_patterns: dict[str, object] | None = None
    client_updated_at: datetime | None = None

    @field_validator("preferences")
    @classmethod
    def _cap_preferences(cls, value: dict[str, object] | None) -> dict[str, object] | None:
        if value is not None and len(value) > MAX_PREFERENCES_KEYS:
            raise ValueError(f"preferences exceeds {MAX_PREFERENCES_KEYS} keys")
        return value

    @field_validator("habit_patterns")
    @classmethod
    def _cap_habit_patterns(cls, value: dict[str, object] | None) -> dict[str, object] | None:
        if value is None:
            return value
        if len(value) > MAX_HABIT_KEYS:
            raise ValueError(f"habit_patterns exceeds {MAX_HABIT_KEYS} keys")
        top_log_types = value.get("top_log_types")
        if isinstance(top_log_types, list) and len(top_log_types) > MAX_TOP_LOG_TYPES:
            raise ValueError(f"habit_patterns.top_log_types exceeds {MAX_TOP_LOG_TYPES} entries")
        return value


class LunaStateResponse(BaseModel):
    id: uuid.UUID
    xp: int
    level: int
    coins: int
    relationship_level: int
    mood_trend: MoodTrendPayload
    preferences: dict[str, object]
    achievements: list[AchievementItem]
    habit_patterns: dict[str, object]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
