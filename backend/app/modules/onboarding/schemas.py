"""Pydantic schemas for the onboarding module (backend_rules.md §7.2)."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PastCycleSchema(BaseModel):
    cycle_start: date
    cycle_length: int = Field(..., ge=20, le=45)
    period_length: int = Field(..., ge=2, le=10)
    symptoms: list[str] = Field(default_factory=list)

    @field_validator("cycle_start")
    @classmethod
    def _validate_cycle_start(cls, v: date) -> date:
        if v >= date.today():
            raise ValueError("cycle_start must be in the past")
        return v


class OnboardingCreate(BaseModel):
    age: int = Field(..., ge=13, le=120)
    height_cm: float = Field(..., ge=50, le=250)
    weight_kg: float = Field(..., ge=20, le=300)
    stress_level: str = Field(..., pattern=r"^(low|moderate|high)$")
    exercise_frequency: str = Field(..., pattern=r"^(low|moderate|high)$")
    sleep_hours: float = Field(..., ge=0, le=24)
    diet: str = Field(..., pattern=r"^(balanced|normal|junk)$")
    current_cycle_start: date
    current_cycle_length: int = Field(..., ge=20, le=45)
    current_period_length: int = Field(..., ge=2, le=10)
    current_symptoms: list[str] = Field(default_factory=list)
    past_cycles: list[PastCycleSchema] = Field(default_factory=list, max_length=3)

    @field_validator("current_cycle_start")
    @classmethod
    def _validate_current_cycle_start(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("current_cycle_start cannot be in the future")
        return v


class OnboardingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    age: int | None
    height_cm: float | None
    weight_kg: float | None
    stress_level: str | None
    exercise_frequency: str | None
    sleep_hours: float | None
    diet: str | None
    current_cycle_start: date | None
    current_cycle_length: int | None
    current_period_length: int | None
    current_symptoms: list[str]
    past_cycles: list
    onboarding_completed: bool
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class OnboardingStatusResponse(BaseModel):
    completed: bool
