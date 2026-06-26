"""Pydantic schemas for chat module."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ChatTokenResponse(BaseModel):
    token: str
    user_id: str
    expires_in: int = 86400


class InviteLinkCreate(BaseModel):
    room_id: str = Field(..., max_length=255)
    max_uses: int = Field(default=10, ge=1)


class InviteLinkResponse(BaseModel):
    invite_token: str
    room_id: str
    expires_at: datetime


class RoomResponse(BaseModel):
    room_id: str
    member_count: int = 0
