"""Pregnancy service: profile, daily logs, milestones, recommendations (plan 10)."""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.pregnancy.exceptions import (
    ActivePregnancyExistsError,
    PregnancyProfileNotFoundError,
)
from app.modules.pregnancy.models import (
    PregnancyDailyLog,
    PregnancyMilestone,
    PregnancyProfile,
)
from app.modules.pregnancy.schemas import (
    DailyLogCreate,
    PregnancyProfileCreate,
    PregnancyProfileUpdate,
)


class PregnancyService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    @staticmethod
    def _compute_week(lmp_date: date) -> int:
        days = (date.today() - lmp_date).days
        return max(1, min(42, (days // 7) + 1))

    @staticmethod
    def _get_trimester(week: int) -> str:
        if week <= 13:
            return "first"
        elif week <= 27:
            return "second"
        return "third"

    # ---- Profile ----

    async def create_profile(
        self, user_id: uuid.UUID, data: PregnancyProfileCreate,
    ) -> PregnancyProfile:
        stmt = (
            select(PregnancyProfile)
            .where(PregnancyProfile.user_id == user_id)
            .where(PregnancyProfile.is_active.is_(True))
        )
        existing = (await self.db.execute(stmt)).scalar_one_or_none()
        if existing:
            raise ActivePregnancyExistsError("An active pregnancy profile already exists")

        profile = PregnancyProfile(
            user_id=user_id,
            due_date=data.due_date,
            lmp_date=data.lmp_date,
            current_week=self._compute_week(data.lmp_date),
        )
        self.db.add(profile)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile

    async def get_profile(self, user_id: uuid.UUID) -> PregnancyProfile:
        stmt = (
            select(PregnancyProfile)
            .where(PregnancyProfile.user_id == user_id)
            .where(PregnancyProfile.is_active.is_(True))
        )
        profile = (await self.db.execute(stmt)).scalar_one_or_none()
        if profile is None:
            raise PregnancyProfileNotFoundError("No active pregnancy profile found")
        # Recompute week on every read
        profile.current_week = self._compute_week(profile.lmp_date)
        return profile

    async def update_profile(
        self, user_id: uuid.UUID, data: PregnancyProfileUpdate,
    ) -> PregnancyProfile:
        profile = await self.get_profile(user_id)
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(profile, key, value)
        profile.current_week = self._compute_week(profile.lmp_date)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile

    async def archive_profile(self, user_id: uuid.UUID) -> None:
        profile = await self.get_profile(user_id)
        profile.is_active = False
        await self.db.commit()

    # ---- Daily Logs ----

    async def create_daily_log(
        self, pregnancy_id: uuid.UUID, data: DailyLogCreate,
    ) -> PregnancyDailyLog:
        log = PregnancyDailyLog(
            pregnancy_id=pregnancy_id,
            symptoms=data.symptoms,
            cravings=data.cravings,
            mood=data.mood,
            notes=data.notes,
            log_date=data.log_date or date.today(),
        )
        self.db.add(log)
        await self.db.commit()
        await self.db.refresh(log)
        return log

    async def list_daily_logs(
        self, pregnancy_id: uuid.UUID, limit: int = 50, offset: int = 0,
    ) -> list[PregnancyDailyLog]:
        stmt = (
            select(PregnancyDailyLog)
            .where(PregnancyDailyLog.pregnancy_id == pregnancy_id)
            .order_by(PregnancyDailyLog.log_date.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ---- Milestones ----

    async def get_milestone(self, week: int) -> PregnancyMilestone:
        stmt = select(PregnancyMilestone).where(PregnancyMilestone.week == week)
        milestone = (await self.db.execute(stmt)).scalar_one_or_none()
        if milestone is None:
            stmt = select(PregnancyMilestone).order_by(PregnancyMilestone.week.desc()).limit(1)
            milestone = (await self.db.execute(stmt)).scalar_one_or_none()
        return milestone

    async def get_current_milestone(self, user_id: uuid.UUID) -> PregnancyMilestone:
        profile = await self.get_profile(user_id)
        return await self.get_milestone(profile.current_week)

    # ---- Recommendations ----

    async def get_recommendations(self, user_id: uuid.UUID) -> dict:
        profile = await self.get_profile(user_id)
        week = profile.current_week
        trimester = self._get_trimester(week)

        tips_by_trimester = {
            "first": [
                "Take prenatal vitamins with folic acid",
                "Stay hydrated — aim for 8-10 glasses of water daily",
                "Get plenty of rest and manage stress",
                "Avoid alcohol, tobacco, and caffeine",
                "Gentle exercise like walking or prenatal yoga",
            ],
            "second": [
                "Continue prenatal checkups every 4 weeks",
                "Exercise regularly — swimming and walking are great",
                "Eat iron-rich foods to prevent anemia",
                "Sleep on your side with a pillow between your knees",
                "Start planning for maternity leave",
            ],
            "third": [
                "Visit your doctor every 2 weeks (weekly after 36 weeks)",
                "Practice breathing exercises for labor",
                "Pack your hospital bag",
                "Monitor fetal movements daily",
                "Finalize birth plan and childcare arrangements",
            ],
        }

        return {
            "week": week,
            "trimester": trimester,
            "tips": tips_by_trimester.get(trimester, []),
        }
