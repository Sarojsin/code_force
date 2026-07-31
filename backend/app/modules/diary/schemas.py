"""Diary Pydantic schemas (backend_rules §1.7: split Create/Update/Response/InDB)."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


# ─── Diary ───────────────────────────────────────────────────────────────

class DiaryCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    cover_color: str = "primary"
    texture_id: str | None = None
    font_id: str | None = None


class DiaryUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    cover_color: str | None = None
    texture_id: str | None = None
    font_id: str | None = None
    is_locked: bool | None = None
    lock_type: str | None = None


class DiaryResponse(BaseModel):
    id: uuid.UUID
    title: str
    cover_color: str
    texture_id: str | None
    font_id: str | None
    page_count: int
    is_locked: bool
    lock_type: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Diary Page ──────────────────────────────────────────────────────────

class DiaryPageCreate(BaseModel):
    page_date: date
    memory_title: str | None = None
    memory_tags: list[str] = Field(default_factory=list)
    memory_people: list[str] = Field(default_factory=list)
    memory_location: str | None = None
    memory_weather: str | None = None
    memory_mood: str | None = None


class DiaryPageUpdate(BaseModel):
    memory_title: str | None = None
    memory_tags: list[str] | None = None
    memory_people: list[str] | None = None
    memory_location: str | None = None
    memory_weather: str | None = None
    memory_mood: str | None = None
    is_favorite: bool | None = None


class DiaryPageResponse(BaseModel):
    id: uuid.UUID
    diary_id: uuid.UUID
    page_number: int
    page_date: date
    version: int
    memory_title: str | None
    memory_tags: list
    memory_people: list
    memory_location: str | None
    memory_weather: str | None
    memory_mood: str | None
    is_favorite: bool
    objects: list[DiaryPageObjectResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


# ─── Diary Page Object ───────────────────────────────────────────────────

class DiaryPageObjectCreate(BaseModel):
    object_type: str  # CanvasObjectType
    text_content: str | None = None
    font_family: str | None = None
    font_size: int | None = None
    color: str | None = None
    text_alignment: str | None = None
    media_id: uuid.UUID | None = None
    caption: str | None = None
    thumbnail_s3_key: str | None = None
    video_duration_sec: int | None = None
    sticker_id: str | None = None
    object_metadata: dict = Field(default_factory=dict, alias="metadata")
    position_x: float
    position_y: float
    width: float | None = None
    height: float | None = None
    rotation: float | None = 0
    z_index: int = 0


class DiaryPageObjectUpdate(BaseModel):
    object_type: str | None = None
    text_content: str | None = None
    font_family: str | None = None
    font_size: int | None = None
    color: str | None = None
    text_alignment: str | None = None
    media_id: uuid.UUID | None = None
    caption: str | None = None
    thumbnail_s3_key: str | None = None
    video_duration_sec: int | None = None
    sticker_id: str | None = None
    object_metadata: dict | None = Field(default=None, alias="metadata")
    position_x: float | None = None
    position_y: float | None = None
    width: float | None = None
    height: float | None = None
    rotation: float | None = None
    z_index: int | None = None


class DiaryPageObjectResponse(BaseModel):
    id: uuid.UUID
    page_id: uuid.UUID
    object_type: str
    text_content: str | None
    font_family: str | None
    font_size: int | None
    color: str | None
    text_alignment: str | None
    media_id: uuid.UUID | None
    caption: str | None
    thumbnail_s3_key: str | None
    video_duration_sec: int | None
    sticker_id: str | None
    object_metadata: dict = Field(alias="metadata")
    position_x: float
    position_y: float
    width: float | None
    height: float | None
    rotation: float | None
    z_index: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True, "populate_by_name": True}


# ─── Diary Media ─────────────────────────────────────────────────────────

class DiaryMediaCreate(BaseModel):
    media_type: str = Field(..., pattern="^(image|video|voice)$")
    file_size_bytes: int
    mime_type: str
    local_file_path: str | None = None


class DiaryMediaResponse(BaseModel):
    id: uuid.UUID
    media_type: str
    file_size_bytes: int
    mime_type: str
    upload_status: str
    duration_sec: int | None
    width: int | None
    height: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Operations ──────────────────────────────────────────────────────────

class PageOperation(BaseModel):
    op_id: str
    op_type: str  # MOVE_OBJECT, RESIZE_OBJECT, etc.
    page_version: int
    data: dict


class PageOperationBatch(BaseModel):
    operations: list[PageOperation]
