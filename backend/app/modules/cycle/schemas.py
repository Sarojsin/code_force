"""Pydantic schemas for the cycle module (backend_rules.md §7.2).

Phase 2 additions: CalendarResponse with dictionary encoding,
PredictionDetail, PredictionListResponse, ModelStatusResponse.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, Self

from pydantic import BaseModel, ConfigDict, Field
from pydantic.functional_validators import model_validator

if TYPE_CHECKING:
    from app.modules.cycle.models import CycleDay, DayMedication, DaySymptom


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
    correction_delta: int | None = None
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
    correction_delta: int | None = None
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


# ---- Day observations (DayDetailSheet / cycle_days) ----


class DaySymptomIn(BaseModel):
    """A single symptom selection for a day (name from the master table)."""

    symptom: str
    severity: int = Field(3, ge=1, le=5)


class DayMedicationIn(BaseModel):
    """A single medication selection for a day (name from the master table)."""

    name: str
    dose: str | None = None
    taken_at: datetime | None = None


class DayUpsert(BaseModel):
    """Upsert payload for one day's observations. All fields optional (partial patch).

    ``flow_level`` values: none | spotting | light | medium | heavy.
    ``energy_level``: 1=low, 2=medium, 3=high.
    """

    mood: str | None = None
    mood_intensity: int | None = Field(None, ge=1, le=10)
    pain_level: int | None = Field(None, ge=0, le=10)
    energy_level: int | None = Field(None, ge=1, le=3)
    sleep_minutes: int | None = Field(None, ge=0, le=1440)
    water_glasses: int | None = Field(None, ge=0, le=32)
    flow_level: str | None = Field(None, max_length=10)
    notes: str | None = None
    symptoms: list[DaySymptomIn] = Field(default_factory=list)
    medications: list[DayMedicationIn] = Field(default_factory=list)
    recommendations_completed: list[str] = Field(default_factory=list)


class DaySymptomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str
    icon: str | None = None
    severity: int


class DayMedicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str
    dose: str | None = None
    taken_at: datetime | None = None


class DayResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    log_date: date
    mood: str | None
    mood_intensity: int | None
    pain_level: int | None
    energy_level: int | None
    sleep_minutes: int | None
    water_glasses: int | None
    flow_level: str | None
    notes: str | None
    symptoms: list[DaySymptomResponse] = Field(default_factory=list)
    medications: list[DayMedicationResponse] = Field(default_factory=list)
    recommendations_completed: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    client_updated_at: datetime | None = None

    @classmethod
    def from_day(
        cls,
        day: CycleDay,
        symptoms: list[DaySymptom],
        medications: list[DayMedication],
    ) -> DayResponse:
        return cls(
            id=day.id,
            user_id=day.user_id,
            log_date=day.log_date,
            mood=day.mood,
            mood_intensity=day.mood_intensity,
            pain_level=day.pain_level,
            energy_level=day.energy_level,
            sleep_minutes=day.sleep_minutes,
            water_glasses=day.water_glasses,
            flow_level=day.flow_level,
            notes=day.notes,
            recommendations_completed=day.recommendations_completed,
            symptoms=[
                DaySymptomResponse(
                    id=ds.symptom_id,
                    name=ds.symptom.name,
                    category=ds.symptom.category,
                    icon=ds.symptom.icon,
                    severity=ds.severity,
                )
                for ds in symptoms
            ],
            medications=[
                DayMedicationResponse(
                    id=dm.medication_id,
                    name=dm.medication.name,
                    category=dm.medication.category,
                    dose=dm.dose,
                    taken_at=dm.taken_at,
                )
                for dm in medications
            ],
            created_at=day.created_at,
            updated_at=day.updated_at,
            client_updated_at=day.client_updated_at,
        )


class SymptomResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str
    icon: str | None = None
    display_order: int = 0


class MedicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str
    display_order: int = 0
