"""Daily check-in Celery task: sends push notification at P-3.

Phase 3: one notification per prediction, suppressed by checkin_sent flag.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import date, timedelta

from sqlalchemy import select

from app.core.celery_app import celery_app

logger = logging.getLogger("app.tasks.checkin")


@celery_app.task(
    name="app.tasks.checkin.daily_checkin",
    soft_time_limit=120,
    time_limit=240,
    acks_late=True,
)
def daily_checkin() -> dict[str, int]:
    """Find predictions at P-3 and send one push notification each."""
    import asyncio

    import redis.asyncio as aredis

    from app.core.config import get_settings

    today = date.today()
    idempotent_key = hashlib.sha256(f"daily_checkin:{today.isoformat()}".encode()).hexdigest()

    async def _run() -> dict[str, int]:
        settings = get_settings()
        r = aredis.from_url(settings.redis.url)
        acquired = await r.setnx(idempotent_key, "1")
        if not acquired:
            logger.info("daily_checkin already ran today (%s), skipping", today)
            return {}
        await r.expire(idempotent_key, 90000)

        from app.core.database import AsyncSessionLocal
        from app.integrations.fcm_client import FCMClient
        from app.modules.auth.models import User
        from app.modules.cycle.models import PredictedCycle

        fcm = FCMClient(settings.fcm)
        notified = 0
        errors = 0

        async with AsyncSessionLocal() as session:
            target_date = today + timedelta(days=3)
            stmt = (
                select(PredictedCycle)
                .where(PredictedCycle.predicted_next_period_start == target_date)
                .where(PredictedCycle.checkin_sent.is_(False))
                .where(PredictedCycle.actual_cycle_entry_id.is_(None))
                .where(PredictedCycle.is_active.is_(True))
            )
            predictions = (await session.execute(stmt)).scalars().all()

            for pred in predictions:
                user_stmt = select(User).where(User.id == pred.user_id).where(User.is_active.is_(True))
                user = (await session.execute(user_stmt)).scalar_one_or_none()
                if user is None:
                    continue

                tokens = list(user.fcm_tokens or [])
                if not tokens:
                    logger.info(
                        "daily_checkin.no_token",
                        extra={"user_id": str(pred.user_id), "prediction_id": str(pred.id)},
                    )
                    pred.checkin_sent = True
                    await session.flush()
                    continue

                try:
                    for token in tokens:
                        await fcm.send_to_token(
                            token=token,
                            title="Period Reminder",
                            body=f"We expected your period around {pred.predicted_next_period_start}. Did it arrive? Tap to confirm or adjust.",
                        )
                    pred.checkin_sent = True
                    await session.flush()
                    notified += 1
                    logger.info(
                        "daily_checkin.sent",
                        extra={
                            "user_id": str(pred.user_id),
                            "prediction_id": str(pred.id),
                            "token_count": len(tokens),
                        },
                    )
                except Exception:
                    logger.exception(
                        "daily_checkin.failed",
                        extra={"user_id": str(pred.user_id), "prediction_id": str(pred.id)},
                    )
                    errors += 1

            await session.commit()

        logger.info("daily_checkin.done", extra={"notified": notified, "errors": errors})
        return {"notifications_sent": notified, "errors": errors}

    return asyncio.run(_run())
