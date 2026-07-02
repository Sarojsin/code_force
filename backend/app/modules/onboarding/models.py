"""UserOnboarding ORM model (Phase 1).

Module-owned table per backend rule §4.1. The ``onboarding_completed``
flag gates whether the mobile app shows MainTabs or the OnboardingStack.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, SmallInteger, String, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserOnboarding(Base):
    __tablename__ = "user_onboarding"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False,
    )
    age: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    stress_level: Mapped[str | None] = mapped_column(String(10), nullable=True)
    exercise_frequency: Mapped[str | None] = mapped_column(String(10), nullable=True)
    sleep_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    diet: Mapped[str | None] = mapped_column(String(10), nullable=True)
    current_cycle_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    current_cycle_length: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    current_period_length: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    current_symptoms: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    past_cycles: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
