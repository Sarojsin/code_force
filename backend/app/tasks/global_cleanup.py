"""Global Celery tasks (cleanup, etc.). Module-specific tasks live in their
own module's tasks.py.
"""

from datetime import UTC

from app.core.celery_app import celery_app


@celery_app.task(name="app.tasks.global_cleanup.prune_expired_tokens")
def prune_expired_tokens() -> int:
    """Plan 13: delete expired refresh tokens. Returns the count removed."""
    raise NotImplementedError("prune_expired_tokens — plan 13")


@celery_app.task(name="app.tasks.global_cleanup.anonymize_deleted_users")
def anonymize_deleted_users() -> int:
    """Plan 21: GDPR anonymization sweep. Returns the count anonymized."""
    raise NotImplementedError("anonymize_deleted_users — plan 21")


@celery_app.task(
    name="app.tasks.global_cleanup.prune_snooze_events",
    soft_time_limit=120,
    time_limit=300,
)
def prune_snooze_events(retention_days: int = 90) -> int:
    """Delete snooze_events older than retention_days (Phase 1 retention policy)."""
    import asyncio
    from datetime import datetime, timedelta

    from sqlalchemy import delete

    async def _run() -> int:
        from app.core.database import AsyncSessionLocal
        from app.modules.cycle.models import SnoozeEvent

        cutoff = datetime.now(tz=UTC) - timedelta(days=retention_days)
        async with AsyncSessionLocal() as session:
            stmt = delete(SnoozeEvent).where(SnoozeEvent.snoozed_at < cutoff)
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount  # type: ignore[return-value]

    return asyncio.run(_run())
