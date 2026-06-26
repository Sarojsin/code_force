from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    TypeDecorator,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UUIDList(TypeDecorator):
    """Stores list[uuid.UUID] as JSON array of hex strings. Works with both PostgreSQL and SQLite."""
    impl = JSON
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return [str(v) for v in value]

    def process_result_value(self, value, dialect):
        if value is None:
            return []
        if isinstance(value, list):
            return [uuid.UUID(v) if isinstance(v, str) else v for v in value]
        return value


class TriggerSource(StrEnum):
    button = "button"
    shake = "shake"
    hardware_triple_press = "hardware_triple_press"


class SOSAlert(Base):
    __tablename__ = "sos_alerts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), index=True, nullable=False
    )
    latitude: Mapped[float] = mapped_column(Numeric(10, 8), nullable=False)
    longitude: Mapped[float] = mapped_column(Numeric(11, 8), nullable=False)
    location_accuracy_m: Mapped[int | None] = mapped_column(Integer, nullable=True)
    contact_ids_notified: Mapped[list[uuid.UUID]] = mapped_column(UUIDList, default=list, nullable=False)
    sms_status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    push_status: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    manual_intervention_needed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    escalation_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    idempotency_key: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)
    trigger_source: Mapped[TriggerSource | None] = mapped_column(
        Enum(TriggerSource, name="trigger_source"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    false_alarm: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class SOSNotificationAttempt(Base):
    __tablename__ = "sos_notification_attempts"

    sos_alert_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sos_alerts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    contact_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("emergency_contacts.id"), nullable=False
    )
    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    retry_count: Mapped[int] = mapped_column(SmallInteger, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(String, nullable=True)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    succeeded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    push_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
