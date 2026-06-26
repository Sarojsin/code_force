"""User / auth ORM models. Module-owned per backend rule §4.1.

Each module that owns a table owns its model. Other modules reach this data
through services or the auth dependency, not by importing the model directly.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, ClassVar

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    # id / created_at / updated_at / is_active come from Base.
    email: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    phone_number: Mapped[str | None] = mapped_column(String(20), unique=True, index=True, nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    profile_pic_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    date_of_birth: Mapped[datetime | None] = mapped_column(DateTime(timezone=False), nullable=True)
    blood_group: Mapped[str | None] = mapped_column(String(5), nullable=True)
    medical_notes: Mapped[str | None] = mapped_column(String, nullable=True)  # encrypted by service
    role: Mapped[str] = mapped_column(String(20), default="user", nullable=False, index=True)

    user_secret_key: Mapped[str] = mapped_column(String(64), nullable=False, server_default="")
    provider: Mapped[str] = mapped_column(String(20), nullable=False, server_default="local")
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(default=0, nullable=False)

    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mfa_secret: Mapped[str | None] = mapped_column(String(255), nullable=True)  # encrypted
    encryption_key_salt: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fcm_tokens: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)

    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Phase 1: ML metrics (updated by cycle module via correction feedback loop)
    avg_cycle_length: Mapped[float | None] = mapped_column(nullable=True)
    cycle_length_std_dev: Mapped[float | None] = mapped_column(nullable=True)
    avg_prediction_error_days: Mapped[float] = mapped_column(default=0.0, nullable=False)
    total_cycles_logged: Mapped[int] = mapped_column(default=0, nullable=False)
    is_dirty_for_retraining: Mapped[bool] = mapped_column(default=False, nullable=False)

    sessions: Mapped[list[UserSession]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )

    __mapper_args__: ClassVar[dict[str, Any]] = {
        "polymorphic_on": role,
    }


class UserSession(Base):
    __tablename__ = "user_sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    refresh_token_hash: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    refresh_jti: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    device_info: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="sessions")


class OTPAttempt(Base):
    """Per-phone OTP attempt audit row. Phone number is hashed (rule §14 privacy)."""

    __tablename__ = "otp_attempts"

    phone_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    consumed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    attempt_count: Mapped[int] = mapped_column(default=0, nullable=False)
