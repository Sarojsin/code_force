"""Retention & data-cleanup Celery tasks.

Backend rule §8: tasks live in the owning module. Retention cleanup is a
global task (not owned by any single feature) so it lives in app/tasks/.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import delete

from app.core.celery_app import celery_app

logger = logging.getLogger("app.tasks.retention_cleanup")


@celery_app.task(
    name="app.tasks.retention_cleanup.cleanup",
    soft_time_limit=300,
    time_limit=360,
)
def cleanup() -> dict[str, int]:
    """One-shot retention sweep. Logs counts and returns them."""
    import asyncio

    import redis.asyncio as aredis

    from app.core.config import get_settings

    today = date.today().isoformat()
    idempotent_key = hashlib.sha256(f"retention_cleanup:{today}".encode()).hexdigest()

    async def _run() -> dict[str, int]:
        settings = get_settings()
        r = aredis.from_url(settings.redis.url)
        acquired = await r.setnx(idempotent_key, "1")
        if not acquired:
            logger.info("retention_cleanup already ran today (%s), skipping", today)
            return {}
        await r.expire(idempotent_key, 90000)

        from app.core.database import AsyncSessionLocal
        from app.modules.auth.models import User
        from app.modules.family.models import FamilyLink
        from app.modules.users.models import AuditLog

        results: dict[str, int] = {}
        async with AsyncSessionLocal() as session:
            cutoff_users = datetime.now(tz=UTC) - timedelta(days=30)
            stmt = delete(User).where(
                User.is_active.is_(False), User.updated_at < cutoff_users
            )
            result = await session.execute(stmt)
            results["deleted_users"] = result.rowcount or 0

            cutoff_audit = datetime.now(tz=UTC) - timedelta(days=90)
            stmt = delete(AuditLog).where(AuditLog.occurred_at < cutoff_audit)
            result = await session.execute(stmt)
            results["purged_audit_logs"] = result.rowcount or 0

            cutoff_invites = datetime.now(tz=UTC) - timedelta(days=30)
            stmt = delete(FamilyLink).where(
                FamilyLink.status == "pending",
                FamilyLink.token_expires_at < cutoff_invites,
            )
            result = await session.execute(stmt)
            results["deleted_expired_invites"] = result.rowcount or 0

            await session.commit()

        for key, count in results.items():
            logger.info("retention_cleanup: %s = %d", key, count)

        return results

    return asyncio.run(_run())
