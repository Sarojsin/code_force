"""Family Celery tasks: cleanup expired tokens (plan 12)."""

from __future__ import annotations

import logging
from datetime import UTC

from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.modules.family.tasks.cleanup_expired_tokens",
    soft_time_limit=30,
    time_limit=60,
)
def cleanup_expired_tokens() -> int:
    """Revoke expired family link invite tokens. Runs hourly."""
    import asyncio
    from datetime import datetime

    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.modules.family.models import FamilyLink

    async def _run() -> int:
        count = 0
        async with AsyncSessionLocal() as session:
            stmt = select(FamilyLink).where(
                FamilyLink.is_active.is_(True),
                FamilyLink.status == "pending",
                FamilyLink.token_expires_at < datetime.now(tz=UTC),
            )
            links = (await session.execute(stmt)).scalars().all()
            for link in links:
                link.is_active = False
                link.status = "revoked"
                count += 1
            await session.commit()
        return count

    return asyncio.run(_run())
