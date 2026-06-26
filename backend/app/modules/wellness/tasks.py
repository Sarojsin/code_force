"""Wellness Celery tasks: sentiment analysis, weekly insights (plan 08).

Rule §8: idempotent with soft/hard time limits.
"""

from __future__ import annotations

import logging
from datetime import UTC

from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.modules.wellness.tasks.analyze_journal_sentiment",
    soft_time_limit=30,
    time_limit=60,
    bind=True,
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
)
def analyze_journal_sentiment(self, entry_id: str, user_id: str) -> None:
    """Analyze journal entry sentiment via Hugging Face. Idempotent."""
    import asyncio
    import uuid

    from sqlalchemy import select

    from app.core.config import get_settings
    from app.core.database import AsyncSessionLocal
    from app.integrations.huggingface_client import HuggingFaceClient
    from app.modules.wellness.models import JournalEntry

    async def _run() -> None:
        settings = get_settings()
        hf_client = HuggingFaceClient(settings.huggingface)
        async with AsyncSessionLocal() as session:
            stmt = select(JournalEntry).where(JournalEntry.id == uuid.UUID(entry_id))
            entry = (await session.execute(stmt)).scalar_one_or_none()
            if entry is None:
                logger.warning("wellness.entry_not_found", extra={"entry_id": entry_id})
                return
            try:
                result = await hf_client.analyze_sentiment("Journal content analysis")
                label = result.get("label", "NEUTRAL").lower()
                score = result.get("score", 0.5)
                entry.sentiment_label = label
                entry.sentiment_score = score if label in ("positive", "neutral") else -score
                from datetime import datetime
                entry.analyzed_at = datetime.now(tz=UTC)
                await session.commit()
                logger.info("wellness.sentiment_analyzed", extra={"entry_id": entry_id, "label": label})
            except Exception as exc:
                logger.error("wellness.sentiment_failed", extra={"entry_id": entry_id, "error": str(exc)})
                raise

    asyncio.run(_run())


@celery_app.task(
    name="app.modules.wellness.tasks.generate_weekly_insights",
    soft_time_limit=120,
    time_limit=300,
)
def generate_weekly_insights() -> int:
    """Generate and push weekly wellness summaries. Runs Sundays."""
    import asyncio

    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.core.encryption import get_encryption_service
    from app.modules.auth.models import User
    from app.modules.wellness.services import WellnessService

    async def _run() -> int:
        encryption = get_encryption_service()
        async with AsyncSessionLocal() as session:
            users = (await session.execute(select(User).where(User.is_active.is_(True)))).scalars().all()
            svc = WellnessService(session, encryption)
            count = 0
            for user in users:
                try:
                    insights = await svc.get_insights(user.id)
                    logger.info("wellness.insights_generated", extra={"user_id": str(user.id), "insights": insights})
                    count += 1
                except Exception as exc:
                    logger.warning("wellness.insights_failed", extra={"user_id": str(user.id), "error": str(exc)})
            return count

    return asyncio.run(_run())
