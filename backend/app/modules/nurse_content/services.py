"""Nurse content service: profiles, CRUD, approval (plan 13)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.cloudinary_client import CloudinaryClient
from app.modules.nurse_content.exceptions import (
    ContentNotFoundError,
    UnauthorizedContentError,
)
from app.modules.nurse_content.models import EducationalContent, NurseProfile
from app.modules.nurse_content.schemas import ContentCreate, ContentUpdate


class NurseContentService:
    def __init__(self, db: AsyncSession, cloudinary: CloudinaryClient | None = None) -> None:
        self.db = db
        self.cloudinary = cloudinary

    async def get_or_create_profile(self, user_id: uuid.UUID) -> NurseProfile:
        stmt = select(NurseProfile).where(NurseProfile.user_id == user_id)
        profile = (await self.db.execute(stmt)).scalar_one_or_none()
        if profile is None:
            profile = NurseProfile(user_id=user_id)
            self.db.add(profile)
            await self.db.commit()
            await self.db.refresh(profile)
        return profile

    async def create_content(self, nurse_id: uuid.UUID, data: ContentCreate) -> EducationalContent:
        content = EducationalContent(
            nurse_id=nurse_id,
            title=data.title,
            description=data.description,
            summary=data.summary,
            body=data.body,
            reading_time_minutes=data.reading_time_minutes,
            author_name=data.author_name,
            content_type=data.content_type,
            video_public_id=data.video_public_id,
            video_url=data.video_url,
            video_duration_seconds=data.video_duration_seconds,
            thumbnail_public_id=data.thumbnail_public_id,
            thumbnail_url=data.thumbnail_url,
            images=[img.model_dump() for img in data.images] if data.images else [],
            category=data.category,
            tags=data.tags,
        )
        self.db.add(content)
        await self.db.commit()
        await self.db.refresh(content)
        return content

    async def list_own_content(self, nurse_id: uuid.UUID) -> list[EducationalContent]:
        stmt = (
            select(EducationalContent)
            .where(EducationalContent.nurse_id == nurse_id)
            .order_by(EducationalContent.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_all_content(
        self, category: str | None = None, content_type: str | None = None,
        limit: int = 100, offset: int = 0,
    ) -> list[EducationalContent]:
        stmt = select(EducationalContent).where(EducationalContent.is_active.is_(True))
        if category:
            stmt = stmt.where(EducationalContent.category == category)
        if content_type:
            stmt = stmt.where(EducationalContent.content_type == content_type)
        stmt = stmt.order_by(EducationalContent.created_at.desc()).offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_content(self, content_id: uuid.UUID) -> EducationalContent:
        stmt = select(EducationalContent).where(EducationalContent.id == content_id)
        content = (await self.db.execute(stmt)).scalar_one_or_none()
        if content is None:
            raise ContentNotFoundError("Educational content not found")
        return content

    async def update_content(
        self, content_id: uuid.UUID, nurse_id: uuid.UUID, data: ContentUpdate,
    ) -> EducationalContent:
        content = await self.get_content(content_id)
        if content.nurse_id != nurse_id:
            raise UnauthorizedContentError("Not your content")
        update_data = data.model_dump(exclude_unset=True)
        if "images" in update_data and update_data["images"] is not None:
            update_data["images"] = [img.model_dump() if hasattr(img, "model_dump") else img for img in update_data["images"]]
        for key, value in update_data.items():
            setattr(content, key, value)
        await self.db.commit()
        await self.db.refresh(content)
        return content

    async def delete_content(self, content_id: uuid.UUID, nurse_id: uuid.UUID) -> None:
        content = await self.get_content(content_id)
        if content.nurse_id != nurse_id:
            raise UnauthorizedContentError("Not your content")
        content.is_active = False
        await self.db.commit()

    async def approve_content(self, content_id: uuid.UUID, admin_id: uuid.UUID) -> EducationalContent:
        content = await self.get_content(content_id)
        content.status = "approved"
        content.approved_by = admin_id
        content.published_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(content)
        return content

    async def list_pending(self) -> list[EducationalContent]:
        stmt = (
            select(EducationalContent)
            .where(EducationalContent.status == "pending")
            .where(EducationalContent.is_active.is_(True))
            .order_by(EducationalContent.created_at.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_approved(
        self, category: str | None = None, content_type: str | None = None,
        limit: int = 50, offset: int = 0,
    ) -> list[EducationalContent]:
        stmt = (
            select(EducationalContent)
            .where(EducationalContent.status == "approved")
            .where(EducationalContent.is_active.is_(True))
        )
        if category:
            stmt = stmt.where(EducationalContent.category == category)
        if content_type:
            stmt = stmt.where(EducationalContent.content_type == content_type)
        stmt = stmt.order_by(EducationalContent.published_at.desc()).offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())