"""Pydantic schemas for family module."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class InviteGenerateCreate(BaseModel):
    permission_level: int = Field(default=1, ge=0, le=15)


class InviteGenerateResponse(BaseModel):
    invite_token: str
    expires_at: datetime
    shareable_link: str


class InviteInfoResponse(BaseModel):
    inviter_name: str | None
    token_expires_at: datetime


class InviteAcceptResponse(BaseModel):
    message: str = "Family link established"


class FamilyLinkResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    linked_user_id: uuid.UUID
    permission_level: int
    status: str
    accepted_at: datetime | None
    created_at: datetime


class PermissionUpdate(BaseModel):
    permission_level: int = Field(..., ge=0, le=15)


class SharedDataResponse(BaseModel):
    mood_data: list | None = None
    cycle_data: list | None = None
    pregnancy_data: dict | None = None
