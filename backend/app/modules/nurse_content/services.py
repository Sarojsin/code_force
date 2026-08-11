"""Nurse content service: profiles, CRUD, approval workflow (plan 13).

Content status state machine (Phase 1.6 / plans/13-nurse-content-upgrade.md):

    draft --submit--> pending --approve--> approved --unpublish--> unpublished
      ^                     |                 ^                          |
      |            --reject--> rejected       +--------publish-----------+
      +---------------------------------------+

    - create:   draft
    - submit:   draft | rejected  -> pending   (nurse, owner)
    - approve:  pending           -> approved  (admin; sets approved_by, published_at)
    - reject:   pending           -> rejected  (admin)
    - publish:  unpublished       -> approved  (admin; re-sets published_at)
    - unpublish: approved         -> unpublished (admin; clears published_at)
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.nurse_content.exceptions import (
    ContentNotFoundError,
    ContentStateError,
    UnauthorizedContentError,
)
from app.modules.nurse_content.models import EducationalContent, NurseProfile
from app.modules.nurse_content.schemas import ContentCreate, ContentUpdate

STATUS_DRAFT = "draft"
STATUS_PENDING = "pending"
STATUS_APPROVED = "approved"
STATUS_REJECTED = "rejected"
STATUS_UNPUBLISHED = "unpublished"

_ALL_STATUSES = (STATUS_DRAFT, STATUS_PENDING, STATUS_APPROVED, STATUS_REJECTED, STATUS_UNPUBLISHED)


class NurseContentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    @staticmethod
    def _ensure_transition(content: EducationalContent, *allowed: str) -> None:
        if content.status not in allowed:
            raise ContentStateError(
                f"Invalid status transition from {content.status!r}; allowed from: {list(allowed)}"
            )

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
            category=data.category,
            tags=data.tags,
            status=STATUS_DRAFT,
        )
        self.db.add(content)
        await self.db.commit()
        await self.db.refresh(content)
        return content

    async def list_own_content(self, nurse_id: uuid.UUID) -> list[EducationalContent]:
        stmt = (
            select(EducationalContent)
            .where(EducationalContent.nurse_id == nurse_id)
            .where(EducationalContent.is_active.is_(True))
            .order_by(EducationalContent.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_content(self, content_id: uuid.UUID) -> EducationalContent:
        stmt = select(EducationalContent).where(EducationalContent.id == content_id)
        content = (await self.db.execute(stmt)).scalar_one_or_none()
        if content is None:
            raise ContentNotFoundError("Educational content not found")
        return content

    async def get_public_content(self, content_id: uuid.UUID) -> EducationalContent:
        """Return content only when approved + active (fixes public leak, Phase 1.3)."""
        stmt = (
            select(EducationalContent)
            .where(EducationalContent.id == content_id)
            .where(EducationalContent.status == STATUS_APPROVED)
            .where(EducationalContent.is_active.is_(True))
        )
        content = (await self.db.execute(stmt)).scalar_one_or_none()
        if content is None:
            raise ContentNotFoundError("Educational content not found")
        return content

    async def update_content(
        self,
        content_id: uuid.UUID,
        nurse_id: uuid.UUID,
        data: ContentUpdate,
    ) -> EducationalContent:
        content = await self.get_content(content_id)
        if content.nurse_id != nurse_id:
            raise UnauthorizedContentError("Not your content")
        # Only drafts and rejected items may be edited in place.
        self._ensure_transition(content, STATUS_DRAFT, STATUS_REJECTED)
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(content, key, value)
        if content.status == STATUS_REJECTED:
            content.status = STATUS_DRAFT
        await self.db.commit()
        await self.db.refresh(content)
        return content

    async def delete_content(self, content_id: uuid.UUID, nurse_id: uuid.UUID) -> None:
        content = await self.get_content(content_id)
        if content.nurse_id != nurse_id:
            raise UnauthorizedContentError("Not your content")
        content.is_active = False
        await self.db.commit()

    async def submit_content(
        self, content_id: uuid.UUID, nurse_id: uuid.UUID
    ) -> EducationalContent:
        """draft | rejected -> pending (nurse submits for review)."""
        content = await self.get_content(content_id)
        if content.nurse_id != nurse_id:
            raise UnauthorizedContentError("Not your content")
        self._ensure_transition(content, STATUS_DRAFT, STATUS_REJECTED)
        content.status = STATUS_PENDING
        await self.db.commit()
        await self.db.refresh(content)
        return content

    async def approve_content(
        self, content_id: uuid.UUID, admin_id: uuid.UUID
    ) -> EducationalContent:
        """pending -> approved (admin)."""
        content = await self.get_content(content_id)
        self._ensure_transition(content, STATUS_PENDING)
        content.status = STATUS_APPROVED
        content.approved_by = admin_id
        content.published_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(content)
        return content

    async def reject_content(
        self, content_id: uuid.UUID, admin_id: uuid.UUID
    ) -> EducationalContent:
        """pending -> rejected (admin)."""
        content = await self.get_content(content_id)
        self._ensure_transition(content, STATUS_PENDING)
        content.status = STATUS_REJECTED
        content.approved_by = admin_id
        await self.db.commit()
        await self.db.refresh(content)
        return content

    async def publish_content(
        self, content_id: uuid.UUID, admin_id: uuid.UUID
    ) -> EducationalContent:
        """unpublished -> approved (admin re-publishes)."""
        content = await self.get_content(content_id)
        self._ensure_transition(content, STATUS_UNPUBLISHED)
        content.status = STATUS_APPROVED
        content.approved_by = admin_id
        content.published_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(content)
        return content

    async def unpublish_content(
        self, content_id: uuid.UUID, admin_id: uuid.UUID
    ) -> EducationalContent:
        """approved -> unpublished (admin)."""
        content = await self.get_content(content_id)
        self._ensure_transition(content, STATUS_APPROVED)
        content.status = STATUS_UNPUBLISHED
        content.approved_by = admin_id
        content.published_at = None
        await self.db.commit()
        await self.db.refresh(content)
        return content

    async def list_pending(self) -> list[EducationalContent]:
        stmt = (
            select(EducationalContent)
            .where(EducationalContent.status == STATUS_PENDING)
            .where(EducationalContent.is_active.is_(True))
            .order_by(EducationalContent.created_at.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_approved(
        self,
        category: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[EducationalContent]:
        stmt = (
            select(EducationalContent)
            .where(EducationalContent.status == STATUS_APPROVED)
            .where(EducationalContent.is_active.is_(True))
        )
        if category:
            stmt = stmt.where(EducationalContent.category == category)
        stmt = stmt.order_by(EducationalContent.published_at.desc()).offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
