from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CycleEntry(Base):
    __tablename__ = "cycle_entries"
    __table_args__ = (
        UniqueConstraint("user_id", "period_start_date", name="unique_user_period_start"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    period_start_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    period_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    flow_intensity: Mapped[str | None] = mapped_column(String(10), nullable=True)
    symptoms: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    mood_tags: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    energy_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)  # encrypted

    cycle_type: Mapped[str] = mapped_column(String(20), default="menstrual", nullable=False)

    # Idempotency key for dedup on retries (project invariant §5)
    idempotency_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)

    # Phase 1: correction linking
    corrected_prediction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("predicted_cycles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_correction: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Correction delta: actual_start - predicted_start (positive = late, negative = early)
    correction_delta: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)


class PredictedCycle(Base):
    __tablename__ = "predicted_cycles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    predicted_next_period_start: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    predicted_fertile_window_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    predicted_fertile_window_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    model_version: Mapped[str] = mapped_column(String(20), default="rule_based_v2", nullable=False)

    # Phase 1: correction tracking
    actual_cycle_entry_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cycle_entries.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    prediction_error_days: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    # Phase 2: prediction metadata
    model_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    training_data_points: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    prediction_window_days: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    # Phase 3: check-in notification idempotency
    checkin_sent: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Phase 1: correction feedback
    snooze_events: Mapped[list[SnoozeEvent]] = relationship(
        back_populates="predicted_cycle",
        cascade="all, delete-orphan",
    )


class SnoozeEvent(Base):
    __tablename__ = "snooze_events"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    predicted_cycle_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("predicted_cycles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    snoozed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    day_offset: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    predicted_cycle: Mapped[PredictedCycle] = relationship(back_populates="snooze_events")


class SystemConfig(Base):
    __tablename__ = "system_config"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)


class CycleDay(Base):
    """Canonical per-user-per-day observation record (DayDetailSheet).

    Stores user-logged health observations for a single date. Prediction-derived
    phase / cycle_day are NOT stored here — they are computed on read from the
    prediction engine to avoid drift (see DayDetailShee_plan.md §2).
    """

    __tablename__ = "cycle_days"
    __table_args__ = (
        UniqueConstraint("user_id", "log_date", name="unique_user_day_log_date"),
        CheckConstraint(
            "pain_level IS NULL OR (pain_level >= 0 AND pain_level <= 10)",
            name="ck_cycle_days_pain_range",
        ),
        CheckConstraint(
            "energy_level IS NULL OR (energy_level >= 1 AND energy_level <= 3)",
            name="ck_cycle_days_energy_range",
        ),
        CheckConstraint(
            "sleep_minutes IS NULL OR (sleep_minutes >= 0 AND sleep_minutes <= 1440)",
            name="ck_cycle_days_sleep_range",
        ),
        CheckConstraint(
            "water_glasses IS NULL OR (water_glasses >= 0 AND water_glasses <= 32)",
            name="ck_cycle_days_water_range",
        ),
        CheckConstraint(
            "flow_level IS NULL OR flow_level IN ('none', 'spotting', 'light', 'medium', 'heavy')",
            name="ck_cycle_days_flow_level",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    log_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    mood: Mapped[str | None] = mapped_column(String(50), nullable=True)
    mood_intensity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    pain_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    energy_level: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    sleep_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    water_glasses: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    flow_level: Mapped[str | None] = mapped_column(String(10), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)  # encrypted (service layer)

    day_symptoms: Mapped[list[DaySymptom]] = relationship(
        back_populates="day",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    day_medications: Mapped[list[DayMedication]] = relationship(
        back_populates="day",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class Symptom(Base):
    """Symptom master table — clients never hardcode symptom names (plan §3.1)."""

    __tablename__ = "symptoms"

    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    icon: Mapped[str | None] = mapped_column(String(10), nullable=True)
    display_order: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)


class DaySymptom(Base):
    """Many-to-many: a logged day's symptoms with severity 1-5."""

    __tablename__ = "day_symptoms"
    __table_args__ = (
        UniqueConstraint("day_id", "symptom_id", name="unique_day_symptom"),
        CheckConstraint("severity >= 1 AND severity <= 5", name="ck_day_symptoms_severity"),
    )

    day_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cycle_days.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    symptom_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("symptoms.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    severity: Mapped[int] = mapped_column(SmallInteger, default=3, nullable=False)

    day: Mapped[CycleDay] = relationship(back_populates="day_symptoms")
    symptom: Mapped[Symptom] = relationship(lazy="selectin")


class Medication(Base):
    """Medication master table (painkillers, supplements, hormones)."""

    __tablename__ = "medications"

    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    display_order: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)


class DayMedication(Base):
    """Many-to-many: a logged day's medications with optional dose + taken_at."""

    __tablename__ = "day_medications"
    __table_args__ = (UniqueConstraint("day_id", "medication_id", name="unique_day_medication"),)

    day_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cycle_days.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    medication_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("medications.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    dose: Mapped[str | None] = mapped_column(String(40), nullable=True)
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    day: Mapped[CycleDay] = relationship(back_populates="day_medications")
    medication: Mapped[Medication] = relationship(lazy="selectin")
