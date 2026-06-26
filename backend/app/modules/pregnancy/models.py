from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, SmallInteger, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PregnancyProfile(Base):
    __tablename__ = "pregnancy_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    due_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    lmp_date: Mapped[date] = mapped_column(Date, nullable=False)
    current_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)


class PregnancyDailyLog(Base):
    __tablename__ = "pregnancy_daily_logs"

    pregnancy_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pregnancy_profiles.id", ondelete="CASCADE"), index=True, nullable=False
    )
    symptoms: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    cravings: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    mood: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)  # encrypted
    log_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)


class PregnancyMilestone(Base):
    __tablename__ = "pregnancy_milestones"

    week: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    baby_size_cm: Mapped[float | None] = mapped_column(nullable=True)
    baby_weight_g: Mapped[float | None] = mapped_column(nullable=True)
    development_tip: Mapped[str] = mapped_column(String, nullable=False)
