"""Pydantic schemas for the cycle module (backend_rules.md §7.2).

Phase 2 additions: CalendarResponse with dictionary encoding,
PredictionDetail, PredictionListResponse, ModelStatusResponse.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field
from pydantic.functional_validators import model_validator
from typing_extensions import Self


class CycleEntryCreate(BaseModel):
    period_start_date: date
    period_end_date: date | None = None
    flow_intensity: str | None = Field(None, max_length=10)
    symptoms: list[str] = Field(default_factory=list)
    mood_tags: list[str] = Field(default_factory=list)
    energy_level: int | None = Field(None, ge=1, le=5)
    notes: str | None = None
    cycle_type: str = "menstrual"

    @model_validator(mode="after")
    def validate_dates(self) -> Self:
        if self.period_end_date is not None and self.period_end_date < self.period_start_date:
            raise ValueError("period_end_date must be on or after period_start_date")
        return self


class CycleEntryUpdate(BaseModel):
    period_start_date: date | None = None
    period_end_date: date | None = None
    flow_intensity: str | None = Field(None, max_length=10)
    symptoms: list[str] | None = None
    mood_tags: list[str] | None = None
    energy_level: int | None = Field(None, ge=1, le=5)
    notes: str | None = None
    cycle_type: str | None = None


class CycleEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    period_start_date: date
    period_end_date: date | None
    flow_intensity: str | None
    symptoms: list[str]
    mood_tags: list[str]
    energy_level: int | None
    notes: str | None
    is_correction: bool
    corrected_prediction_id: uuid.UUID | None
    cycle_type: str
    created_at: datetime


class PredictionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    predicted_next_period_start: date
    predicted_fertile_window_start: date | None
    predicted_fertile_window_end: date | None
    model_version: str


class CorrectionCreate(BaseModel):
    period_start_date: date
    period_end_date: date | None = None
    symptoms: list[str] = Field(default_factory=list)
    corrected_prediction_id: str | None = None
    client_updated_at: str | None = None
    cycle_type: str = "menstrual"


class CorrectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    period_start_date: date
    period_end_date: date | None
    symptoms: list[str]
    is_correction: bool
    corrected_prediction_id: uuid.UUID | None
    cycle_type: str
    created_at: datetime
    avg_period_length: int = 5


class SnoozeCreate(BaseModel):
    predicted_cycle_id: str
    day_offset: int = Field(..., ge=0)


class SnoozeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    predicted_cycle_id: uuid.UUID
    snoozed_at: datetime
    day_offset: int


class AnalyticsResponse(BaseModel):
    average_cycle_length_days: float | None
    shortest_cycle_days: int | None
    longest_cycle_days: int | None
    common_symptoms: list[dict[str, str | int]]
    common_moods: list[dict[str, str | int]]
    total_entries: int


# ---- Phase 2: Calendar & Prediction schemas ----


class PredictionDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    predicted_next_period_start: date
    predicted_period_end: date | None = None
    predicted_fertile_window_start: date | None
    predicted_fertile_window_end: date | None
    model_type: str
    confidence_score: float | None
    confidence_label: str | None
    training_data_points: int
    prediction_window_days: int | None


class CalendarResponse(BaseModel):
    days: dict[str, str]  # "YYYY-MM-DD" → type code
    predictions: PredictionDetail | None = None
    next_period_in_days: int | None = None
    needs_checkin: bool = False


class NextPredictionResponse(BaseModel):
    prediction: PredictionDetail | None
    days_until: int | None
    model_used: str
    data_quality: str  # insufficient | minimal | good | excellent


class PredictionHistoryItem(BaseModel):
    id: str
    month: str
    predicted_date: str
    actual_date: str | None = None
    delta_days: int | None = None
    on_time: bool = False


class PredictionHistoryResponse(BaseModel):
    items: list[PredictionHistoryItem] = []


class ModelStatusResponse(BaseModel):
    current_version: int
    download_url: str
