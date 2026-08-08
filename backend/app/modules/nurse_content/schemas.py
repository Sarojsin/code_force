"""Pydantic schemas for nurse content module."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ContentType = Literal["article", "video", "image"]


class ContentImage(BaseModel):
    """An image in the gallery: {url, public_id, caption, order}."""

    url: str
    public_id: str | None = None
    caption: str | None = None
    order: int = 0


class ContentCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: str | None = None
    summary: str | None = None
    body: str | None = None
    reading_time_minutes: int | None = Field(None, ge=1, le=600)
    author_name: str | None = Field(None, max_length=100)
    content_type: ContentType = "article"
    video_public_id: str | None = None
    video_url: str | None = None
    video_duration_seconds: int | None = Field(None, ge=1, le=86400)
    thumbnail_public_id: str | None = None
    thumbnail_url: str | None = None
    images: list[ContentImage] = Field(default_factory=list)
    category: str = Field(..., max_length=50)
    tags: list[str] = Field(default_factory=list)


class ContentUpdate(BaseModel):
    title: str | None = Field(None, max_length=200)
    description: str | None = None
    summary: str | None = None
    body: str | None = None
    reading_time_minutes: int | None = Field(None, ge=1, le=600)
    author_name: str | None = Field(None, max_length=100)
    content_type: ContentType | None = None
    video_public_id: str | None = None
    video_url: str | None = None
    video_duration_seconds: int | None = Field(None, ge=1, le=86400)
    thumbnail_public_id: str | None = None
    thumbnail_url: str | None = None
    images: list[ContentImage] | None = None
    category: str | None = Field(None, max_length=50)
    tags: list[str] | None = None


class ContentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nurse_id: uuid.UUID
    title: str
    description: str | None
    summary: str | None
    body: str | None
    reading_time_minutes: int | None
    author_name: str | None
    content_type: str
    video_public_id: str | None
    video_url: str | None
    video_duration_seconds: int | None
    thumbnail_public_id: str | None
    thumbnail_url: str | None
    images: list[ContentImage] | None
    category: str
    tags: list[str]
    status: str
    approved_by: uuid.UUID | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime


class UploadUrlResponse(BaseModel):
    """Payload for a client-side Cloudinary signed upload."""

    upload_url: str
    cloud_name: str
    api_key: str
    timestamp: int
    folder: str
    tags: str
    signature: str
    expires_at: int | None = None


class ContentApproveResponse(BaseModel):
    message: str = "Content approved"


class NurseProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: uuid.UUID
    qualification: str | None
    verified_at: datetime | None
    hospital_affiliation: str | None
