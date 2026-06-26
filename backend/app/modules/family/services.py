"""Family linking service: invites, permissions, shared data (plan 12)."""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.family.exceptions import (
    InviteTokenExpiredError,
    InviteTokenUsedError,
    LinkNotFoundError,
    SelfLinkError,
)
from app.modules.family.models import FamilyLink
from app.modules.family.schemas import PermissionUpdate


class FamilyService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def generate_invite(
        self, user_id: uuid.UUID, permission_level: int,
    ) -> tuple[FamilyLink, str]:
        token = secrets.token_urlsafe(32)
        link = FamilyLink(
            user_id=user_id,
            invite_token=token,
            token_expires_at=datetime.now(tz=UTC) + timedelta(days=7),
            permission_level=permission_level,
        )
        self.db.add(link)
        await self.db.commit()
        await self.db.refresh(link)
        return link, token

    async def get_invite_info(self, token: str) -> FamilyLink:
        stmt = select(FamilyLink).where(FamilyLink.invite_token == token)
        link = (await self.db.execute(stmt)).scalar_one_or_none()
        if link is None:
            raise LinkNotFoundError("Invite link not found")
        expires = link.token_expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        if expires < datetime.now(tz=UTC):
            raise InviteTokenExpiredError("Invite link has expired")
        return link

    async def accept_invite(self, token: str, linked_user_id: uuid.UUID) -> FamilyLink:
        link = await self.get_invite_info(token)
        if link.status != "pending":
            raise InviteTokenUsedError("Invite link has already been used")
        if link.user_id == linked_user_id:
            raise SelfLinkError("Cannot accept your own invite")

        link.linked_user_id = linked_user_id
        link.status = "accepted"
        link.accepted_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(link)
        return link

    async def list_links(self, user_id: uuid.UUID) -> list[FamilyLink]:
        stmt = (
            select(FamilyLink)
            .where(
                or_(FamilyLink.user_id == user_id, FamilyLink.linked_user_id == user_id),
            )
            .where(FamilyLink.is_active.is_(True))
            .order_by(FamilyLink.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_permissions(
        self, link_id: uuid.UUID, user_id: uuid.UUID, data: PermissionUpdate,
    ) -> FamilyLink:
        stmt = (
            select(FamilyLink)
            .where(FamilyLink.id == link_id)
            .where(FamilyLink.user_id == user_id)
            .where(FamilyLink.is_active.is_(True))
        )
        link = (await self.db.execute(stmt)).scalar_one_or_none()
        if link is None:
            raise LinkNotFoundError("Family link not found")
        link.permission_level = data.permission_level
        await self.db.commit()
        await self.db.refresh(link)
        return link

    async def revoke_link(self, link_id: uuid.UUID, user_id: uuid.UUID) -> None:
        stmt = (
            select(FamilyLink)
            .where(FamilyLink.id == link_id)
            .where(
                or_(FamilyLink.user_id == user_id, FamilyLink.linked_user_id == user_id),
            )
            .where(FamilyLink.is_active.is_(True))
        )
        link = (await self.db.execute(stmt)).scalar_one_or_none()
        if link is None:
            raise LinkNotFoundError("Family link not found")
        link.is_active = False
        link.status = "revoked"
        await self.db.commit()

    async def get_shared_data(self, user_id: uuid.UUID) -> dict:
        stmt = (
            select(FamilyLink)
            .where(FamilyLink.linked_user_id == user_id)
            .where(FamilyLink.status == "accepted")
            .where(FamilyLink.is_active.is_(True))
        )
        links = (await self.db.execute(stmt)).scalars().all()

        mood_data = []
        cycle_data = []
        pregnancy_data = None

        for link in links:
            perm = link.permission_level
            if perm & 1:
                from app.modules.wellness.models import MoodLog
                mood_stmt = (
                    select(MoodLog)
                    .where(MoodLog.user_id == link.user_id)
                    .order_by(MoodLog.logged_at.desc())
                    .limit(10)
                )
                moods = (await self.db.execute(mood_stmt)).scalars().all()
                mood_data = [{"mood": m.mood, "intensity": m.intensity, "logged_at": m.logged_at.isoformat()} for m in moods]

            if perm & 2:
                from app.modules.cycle.models import CycleEntry
                cycle_stmt = (
                    select(CycleEntry)
                    .where(CycleEntry.user_id == link.user_id)
                    .order_by(CycleEntry.period_start_date.desc())
                    .limit(6)
                )
                cycles = (await self.db.execute(cycle_stmt)).scalars().all()
                cycle_data = [{"period_start": str(c.period_start_date), "period_end": str(c.period_end_date) if c.period_end_date else None} for c in cycles]

            if perm & 4:
                from app.modules.pregnancy.models import PregnancyProfile
                preg_stmt = (
                    select(PregnancyProfile)
                    .where(PregnancyProfile.user_id == link.user_id)
                    .where(PregnancyProfile.is_active.is_(True))
                )
                profile = (await self.db.execute(preg_stmt)).scalar_one_or_none()
                if profile:
                    pregnancy_data = {
                        "due_date": str(profile.due_date),
                        "current_week": profile.current_week,
                    }

        return {
            "mood_data": mood_data,
            "cycle_data": cycle_data,
            "pregnancy_data": pregnancy_data,
        }
