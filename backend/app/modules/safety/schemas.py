"""Pydantic schemas for the safety module (backend_rules.md §7.2)."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EmergencyContactCreate(BaseModel):
    name: str = Field(..., max_length=100)
    phone_number: str = Field(..., max_length=20, pattern=r"^\+[1-9]\d{6,14}$")
    relationship: str | None = Field(None, max_length=50)
    is_primary: bool = False
    contact_user_id: str | None = Field(None, description="UUID of a registered user to push-notify instead of SMS")


class EmergencyContactUpdate(BaseModel):
    name: str | None = Field(None, max_length=100)
    phone_number: str | None = Field(None, max_length=20, pattern=r"^\+[1-9]\d{6,14}$")
    relationship: str | None = Field(None, max_length=50)
    is_primary: bool | None = None
    contact_user_id: str | None = None


class EmergencyContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    phone_number: str
    relationship: str | None
    is_primary: bool
    contact_user_id: str | None = None
    contact_user_id_linked_at: datetime | None = None


class SOSAlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    triggered_at: datetime
    latitude: float
    longitude: float
    location_accuracy_m: int | None
    sms_status: str
    cancelled_at: datetime | None
    resolved_at: datetime | None
    false_alarm: bool
    manual_intervention_needed: bool
    trigger_source: str | None = None


class SOSHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    triggered_at: datetime
    latitude: float
    longitude: float
    sms_status: str
    cancelled_at: datetime | None
    resolved_at: datetime | None
    false_alarm: bool
    manual_intervention_needed: bool


class SOSCancelResponse(BaseModel):
    message: str = "SOS alert cancelled"
    false_alarm: bool = True
    contacts_notified_of_false_alarm: bool = False


class SafetyStatusResponse(BaseModel):
    active_sos: SOSAlertResponse | None = None
    emergency_contacts: list[EmergencyContactResponse] = []
    sos_enabled: bool = True
