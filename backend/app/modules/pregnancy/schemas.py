"""Pydantic schemas for the pregnancy module (backend_rules.md §7.2)."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class PregnancyProfileCreate(BaseModel):
    due_date: date
    lmp_date: date


class PregnancyProfileUpdate(BaseModel):
    due_date: date | None = None
    lmp_date: date | None = None


class PregnancyProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    due_date: date
    lmp_date: date
    current_week: int
    is_active: bool
    created_at: datetime


class DailyLogCreate(BaseModel):
    symptoms: list[str] = Field(default_factory=list)
    cravings: list[str] = Field(default_factory=list)
    mood: str | None = Field(None, max_length=50)
    notes: str | None = None
    log_date: date | None = None


class DailyLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pregnancy_id: uuid.UUID
    symptoms: list[str]
    cravings: list[str]
    mood: str | None
    notes: str | None
    log_date: date


class MilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    week: int
    baby_size_cm: float | None
    baby_weight_g: float | None
    development_tip: str


class RecommendationResponse(BaseModel):
    week: int
    trimester: str
    tips: list[str]
