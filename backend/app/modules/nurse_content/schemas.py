"""Pydantic schemas for nurse content module."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ContentCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: str | None = None
    video_url: str | None = None
    thumbnail_url: str | None = None
    category: str = Field(..., max_length=50)
    tags: list[str] = Field(default_factory=list)


class ContentUpdate(BaseModel):
    title: str | None = Field(None, max_length=200)
    description: str | None = None
    video_url: str | None = None
    thumbnail_url: str | None = None
    category: str | None = Field(None, max_length=50)
    tags: list[str] | None = None


class ContentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nurse_id: uuid.UUID
    title: str
    description: str | None
    video_url: str | None
    thumbnail_url: str | None
    category: str
    tags: list[str]
    status: str
    approved_by: uuid.UUID | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime

    content_type: str = "article"

    @model_validator(mode="after")
    def derive_content_type(self) -> "ContentResponse":
        if self.video_url:
            self.content_type = "video"
        elif self.thumbnail_url:
            self.content_type = "image"
        else:
            self.content_type = "article"
        return self


class ContentApproveResponse(BaseModel):
    message: str = "Content approved"


class NurseProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    qualification: str | None
    verified_at: datetime | None
    hospital_affiliation: str | None
