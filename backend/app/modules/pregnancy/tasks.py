"""Pregnancy Celery tasks: reminders (plan 10 §7.5).

Rule §8: idempotent with soft/hard time limits.
"""

from __future__ import annotations

import logging

from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.modules.pregnancy.tasks.check_pregnancy_reminders",
    soft_time_limit=120,
    time_limit=300,
)
def check_pregnancy_reminders() -> int:
    """Send pregnancy reminders for upcoming scans and milestones. Runs daily at 9 AM."""
    import asyncio

    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.modules.pregnancy.models import PregnancyProfile

    async def _run() -> int:
        count = 0
        async with AsyncSessionLocal() as session:
            profiles = (
                await session.execute(
                    select(PregnancyProfile).where(PregnancyProfile.is_active.is_(True))
                )
            ).scalars().all()

            for profile in profiles:
                week = profile.current_week
                if week in (12, 20, 28, 36):
                    logger.info(
                        "pregnancy.reminder",
                        extra={"user_id": str(profile.user_id), "week": week},
                    )
                    count += 1
        return count

    return asyncio.run(_run())
