"""Safety Celery tasks: SOS notification with retry and escalation (plan 11).

Rule §8: idempotent with soft/hard time limits. Uses priority queue.
"""

from __future__ import annotations

import logging

from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.modules.safety.tasks.send_sos_alerts",
    soft_time_limit=60,
    time_limit=120,
    bind=True,
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=30,
    default_retry_delay=5,
)
def send_sos_alerts(self, alert_id: str) -> str:
    """Send SMS and push notifications for an SOS alert. Retries on failure."""
    import asyncio
    import uuid

    from app.core.config import get_settings
    from app.core.database import AsyncSessionLocal
    from app.integrations.fcm_client import FCMClient
    from app.integrations.twilio_client import TwilioClient
    from app.modules.safety.services import SafetyService

    async def _run() -> str:
        settings = get_settings()
        async with AsyncSessionLocal() as session:
            svc = SafetyService(
                db=session,
                twilio=TwilioClient(settings.twilio),
                fcm=FCMClient(settings.fcm),
                settings=settings,
            )
            await svc.process_sos_notifications(uuid.UUID(alert_id))
        return alert_id

    return asyncio.run(_run())


@celery_app.task(
    name="app.modules.safety.tasks.sos_checkin",
    soft_time_limit=30,
    time_limit=60,
    default_retry_delay=900,
    max_retries=4,
)
def sos_checkin(alert_id: str) -> None:
    """Re-notify contacts if SOS not resolved after 15 min. Idempotent."""
    import asyncio
    import uuid

    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.modules.safety.models import SOSAlert

    async def _run() -> None:
        async with AsyncSessionLocal() as session:
            stmt = select(SOSAlert).where(SOSAlert.id == uuid.UUID(alert_id))
            alert = (await session.execute(stmt)).scalar_one_or_none()
            if alert is None or alert.resolved_at or alert.cancelled_at:
                return
            alert.manual_intervention_needed = True
            await session.commit()
            logger.warning("sos.checkin.reminder", extra={"alert_id": alert_id})

    asyncio.run(_run())


@celery_app.task(
    name="app.modules.safety.tasks.escalate_sos",
    soft_time_limit=30,
    time_limit=60,
)
def escalate_sos(alert_id: str) -> None:
    """Escalate SOS alerts that need manual intervention. Idempotent."""
    import asyncio
    import uuid

    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.modules.safety.models import SOSAlert

    async def _run() -> None:
        async with AsyncSessionLocal() as session:
            stmt = select(SOSAlert).where(SOSAlert.id == uuid.UUID(alert_id))
            alert = (await session.execute(stmt)).scalar_one_or_none()
            if alert and alert.manual_intervention_needed and not alert.escalation_flag:
                alert.escalation_flag = True
                await session.commit()
                logger.warning("sos.escalated", extra={"alert_id": alert_id})

    asyncio.run(_run())
