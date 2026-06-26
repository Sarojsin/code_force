"""Users Celery tasks: GDPR cleanup, audit log pruning (backend_rules.md §8)."""

from __future__ import annotations

import logging
from datetime import UTC

from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.modules.users.tasks.prune_audit_logs",
    soft_time_limit=60,
    time_limit=120,
)
def prune_audit_logs() -> int:
    """Delete audit logs older than 90 days. Idempotent."""
    import asyncio
    from datetime import datetime, timedelta

    from app.core.database import AsyncSessionLocal
    from app.modules.users.models import AuditLog

    async def _run() -> int:
        cutoff = datetime.now(tz=UTC) - timedelta(days=90)
        async with AsyncSessionLocal() as session:
            from sqlalchemy import delete
            result = await session.execute(
                delete(AuditLog).where(AuditLog.occurred_at < cutoff).returning(AuditLog.id)
            )
            ids = result.scalars().all()
            await session.commit()
            logger.info("users.prune_audit_logs.count", extra={"count": len(ids)})
            return len(ids)

    return asyncio.run(_run())


@celery_app.task(
    name="app.modules.users.tasks.anonymize_user_data",
    soft_time_limit=30,
    time_limit=60,
)
def anonymize_user_data(user_id: str) -> None:
    """Anonymize a single user's data for GDPR erasure. Idempotent."""
    import asyncio
    import uuid

    from app.core.database import AsyncSessionLocal
    from app.modules.auth.models import User

    async def _run() -> None:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select
            stmt = select(User).where(User.id == uuid.UUID(user_id))
            user = (await session.execute(stmt)).scalar_one_or_none()
            if user is None:
                return
            user.phone_number = f"anon-{user.id.hex[:8]}"
            user.display_name = None
            user.profile_pic_url = None
            user.medical_notes = None
            user.fcm_tokens = []
            user.encryption_key_salt = None
            user.is_active = False
            await session.commit()
            logger.info("users.anonymized", extra={"user_id": user_id})

    asyncio.run(_run())
