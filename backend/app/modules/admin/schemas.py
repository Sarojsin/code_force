"""Pydantic schemas for admin module."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserAdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone_number: str
    display_name: str | None
    role: str
    is_active: bool
    created_at: datetime


class RoleUpdate(BaseModel):
    role: str = Field(..., max_length=20)


class AnalyticsResponse(BaseModel):
    total_users: int
    active_users: int
    sos_count: int
    pregnancy_count: int
    nurse_count: int


class BroadcastCreate(BaseModel):
    title: str = Field(..., max_length=200)
    body: str = Field(..., max_length=500)
    data: dict[str, str] = Field(default_factory=dict)


class BroadcastResponse(BaseModel):
    message: str
    recipient_count: int
