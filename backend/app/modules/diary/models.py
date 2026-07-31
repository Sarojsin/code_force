"""Diary module database models."""

from __future__ import annotations

import uuid
from datetime import date
from enum import Enum

from sqlalchemy import Boolean, Date, Enum as SQLAlchemyEnum, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CanvasObjectType(str, Enum):
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    VOICE = "voice"
    MOOD = "mood"
    STICKER = "sticker"


class Diary(Base):
    __tablename__ = "diaries"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    cover_color: Mapped[str] = mapped_column(String(20), default="primary")
    texture_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    font_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    lock_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)

    # Base columns: id (UUID PK), created_at, updated_at


class DiaryPage(Base):
    __tablename__ = "diary_pages"

    diary_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("diaries.id", ondelete="CASCADE"), index=True, nullable=False
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    page_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    memory_title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    memory_tags: Mapped[dict] = mapped_column(JSONB, default=list, nullable=False)
    memory_people: Mapped[dict] = mapped_column(JSONB, default=list, nullable=False)
    memory_location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    memory_weather: Mapped[str | None] = mapped_column(String(50), nullable=True)
    memory_mood: Mapped[str | None] = mapped_column(String(50), nullable=True)

    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(default=True)

    objects: Mapped[list[DiaryPageObject]] = relationship(
        "DiaryPageObject", lazy="selectin",
        primaryjoin="and_(DiaryPage.id == DiaryPageObject.page_id, DiaryPageObject.is_active == True)",
        viewonly=True,
    )

    # Unique constraint: (diary_id, page_number)
    # Base columns


class DiaryPageObject(Base):
    __tablename__ = "diary_page_objects"

    page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("diary_pages.id", ondelete="CASCADE"), index=True, nullable=False
    )
    object_type: Mapped[CanvasObjectType] = mapped_column(
        SQLAlchemyEnum(CanvasObjectType), nullable=False
    )

    text_content: Mapped[str | None] = mapped_column(String, nullable=True)
    font_family: Mapped[str | None] = mapped_column(String(50), nullable=True)
    font_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    text_alignment: Mapped[str | None] = mapped_column(String(10), nullable=True)

    media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("diary_media.id", ondelete="SET NULL"), nullable=True
    )
    caption: Mapped[str | None] = mapped_column(String(500), nullable=True)

    thumbnail_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    video_duration_sec: Mapped[int | None] = mapped_column(Integer, nullable=True)

    sticker_id: Mapped[str | None] = mapped_column(String(50), nullable=True)

    object_metadata: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")

    position_x: Mapped[float] = mapped_column(Float, nullable=False)
    position_y: Mapped[float] = mapped_column(Float, nullable=False)
    width: Mapped[float | None] = mapped_column(Float, nullable=True)
    height: Mapped[float | None] = mapped_column(Float, nullable=True)
    rotation: Mapped[float | None] = mapped_column(Float, default=0, nullable=True)
    z_index: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(default=True)

    # Base columns


class DiaryMedia(Base):
    __tablename__ = "diary_media"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False
    )
    media_type: Mapped[str] = mapped_column(String(10), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(50), nullable=False)

    s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    thumbnail_s3_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    upload_status: Mapped[str] = mapped_column(String(20), default="local")

    duration_sec: Mapped[int | None] = mapped_column(Integer, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)

    local_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)

    # Base columns
