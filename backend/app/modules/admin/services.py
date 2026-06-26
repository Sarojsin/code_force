"""Admin service: user management, analytics, broadcasts (plan 16)."""

from __future__ import annotations

import uuid
from datetime import UTC

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.nurse_content.models import NurseProfile
from app.modules.pregnancy.models import PregnancyProfile
from app.modules.safety.models import SOSAlert


class AdminService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_users(
        self, role: str | None = None, is_active: bool | None = None,
        limit: int = 50, offset: int = 0,
    ) -> list[User]:
        stmt = select(User)
        if role:
            stmt = stmt.where(User.role == role)
        if is_active is not None:
            stmt = stmt.where(User.is_active.is_(is_active))
        stmt = stmt.order_by(User.created_at.desc()).offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_role(self, user_id: uuid.UUID, role: str) -> User:
        stmt = select(User).where(User.id == user_id)
        user = (await self.db.execute(stmt)).scalar_one_or_none()
        if user:
            user.role = role
            await self.db.commit()
            await self.db.refresh(user)
        return user

    async def verify_nurse(self, nurse_id: uuid.UUID) -> NurseProfile:
        from datetime import datetime
        stmt = select(NurseProfile).where(NurseProfile.user_id == nurse_id)
        profile = (await self.db.execute(stmt)).scalar_one_or_none()
        if profile:
            profile.verified_at = datetime.now(tz=UTC)
            await self.db.commit()
            await self.db.refresh(profile)
        return profile

    async def get_analytics(self) -> dict:
        total = (await self.db.execute(select(func.count(User.id)))).scalar() or 0
        active = (await self.db.execute(select(func.count(User.id)).where(User.is_active.is_(True)))).scalar() or 0
        sos = (await self.db.execute(select(func.count(SOSAlert.id)))).scalar() or 0
        pregnancy = (await self.db.execute(select(func.count(PregnancyProfile.id)).where(PregnancyProfile.is_active.is_(True)))).scalar() or 0
        nurse = (await self.db.execute(select(func.count(NurseProfile.user_id)))).scalar() or 0
        return {
            "total_users": total,
            "active_users": active,
            "sos_count": sos,
            "pregnancy_count": pregnancy,
            "nurse_count": nurse,
        }

    async def get_pending_contents(self) -> list:
        from app.modules.nurse_content.models import EducationalContent
        stmt = (select(EducationalContent).where(EducationalContent.status == "pending").order_by(EducationalContent.created_at.asc()))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
