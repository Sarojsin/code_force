"""Auth Celery tasks: GDPR anonymization, MFA rotation, etc.

Plan 04: tasks live in the module's tasks.py.
Plan 21: anonymize_deleted_users is the GDPR worker.
Rule §8: idempotent + soft/hard time limits.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy import select, update

from app.core.celery_app import celery_app
from app.core.database import get_db_session_factory
from app.modules.auth.models import User, UserSession

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.modules.auth.tasks.anonymize_deleted_users",
    soft_time_limit=60,
    time_limit=120,
    bind=True,
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=600,
)
def anonymize_deleted_users(self) -> int:
    """Plan 21: anonymize users whose `is_active` has been False for >30 days.

    Replaces PII with placeholders, drops the phone number, clears fcm_tokens,
    drops sessions, and revokes tokens. Idempotent: running twice is safe.
    """
    import asyncio

    return asyncio.run(_anonymize_deleted_users_async())


async def _anonymize_deleted_users_async() -> int:

    factory = get_db_session_factory()
    async with factory() as session:
        # Find users deleted > 30 days ago.
        cutoff = datetime.now(tz=UTC).replace(microsecond=0)
        from datetime import timedelta
        cutoff = cutoff - timedelta(days=30)
        stmt = select(User).where(
            User.is_active.is_(False),
            User.updated_at < cutoff,
            User.display_name.is_not(None),  # unanonymized
        )
        users = (await session.execute(stmt)).scalars().all()
        count = 0
        for user in users:
            user.phone_number = f"anon-{user.id.hex[:8]}"
            user.display_name = None
            user.profile_pic_url = None
            user.medical_notes = None
            user.mfa_secret = None
            user.hashed_password = None
            user.fcm_tokens = []
            user.encryption_key_salt = None
            count += 1
        # Drop all sessions for the anonymized users.
        user_ids = [u.id for u in users]
        if user_ids:
            await session.execute(
                update(UserSession)
                .where(UserSession.user_id.in_(user_ids))
                .values(is_active=False, revoked_at=datetime.now(tz=UTC))
            )
        await session.commit()
        logger.info("auth.anonymize_deleted_users.count", extra={"count": count})
        return count


@celery_app.task(
    name="app.modules.auth.tasks.prune_expired_sessions",
    soft_time_limit=30,
    time_limit=60,
)
def prune_expired_sessions() -> int:
    """Mark expired refresh sessions inactive. Idempotent."""
    import asyncio

    return asyncio.run(_prune_expired_sessions_async())


async def _prune_expired_sessions_async() -> int:
    now = datetime.now(tz=UTC)
    factory = get_db_session_factory()
    async with factory() as session:
        result = await session.execute(
            update(UserSession)
            .where(UserSession.is_active.is_(True), UserSession.expires_at < now)
            .values(is_active=False, revoked_at=now)
            .returning(UserSession.id)
        )
        ids = result.scalars().all()
        await session.commit()
        return len(ids)
