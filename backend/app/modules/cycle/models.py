from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
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
        UUID(as_uuid=True), ForeignKey("predicted_cycles.id", ondelete="SET NULL"), nullable=True, index=True
    )
    is_correction: Mapped[bool] = mapped_column(default=False, nullable=False)


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
        UUID(as_uuid=True), ForeignKey("cycle_entries.id", ondelete="SET NULL"), nullable=True, index=True
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
        UUID(as_uuid=True), ForeignKey("predicted_cycles.id", ondelete="CASCADE"), nullable=False, index=True
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
