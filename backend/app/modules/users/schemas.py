"""Pydantic schemas for the users module (backend_rules.md §7.2)."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(None, max_length=100)
    date_of_birth: date | None = None
    blood_group: str | None = Field(None, max_length=5)
    medical_notes: str | None = None


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone_number: str
    display_name: str | None
    profile_pic_url: str | None
    date_of_birth: date | None
    blood_group: str | None
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AvatarUploadResponse(BaseModel):
    url: str
    presigned_url: str | None = None


class FCMTokenCreate(BaseModel):
    token: str = Field(..., min_length=1, max_length=512)
    device_os: str | None = Field(None, max_length=20)


class FCMTokenResponse(BaseModel):
    tokens: list[str]


class ConsentCreate(BaseModel):
    consent_type: str = Field(..., max_length=50)
    version: str = Field(..., max_length=20)
    granted: bool = True


class ConsentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    consent_type: str
    version: str
    granted: bool
    created_at: datetime


class DeleteAccountResponse(BaseModel):
    message: str = "Account deletion scheduled. Your data will be anonymized within 30 days."


class DataExportResponse(BaseModel):
    generated_at: datetime
    user: ProfileResponse
    journal_entries: list[dict[str, object]] = []
    mood_logs: list[dict[str, object]] = []
    cycle_entries: list[dict[str, object]] = []
    pregnancy_profiles: list[dict[str, object]] = []
    pregnancy_daily_logs: list[dict[str, object]] = []
    sos_alerts: list[dict[str, object]] = []
    emergency_contacts: list[dict[str, object]] = []
    consents: list[ConsentResponse] = []
    audit_logs: list[dict[str, object]] = []
