"""Startup seeders: idempotent creation of fixed accounts / reference data.

Currently seeds the single admin account used by the mobile admin dashboard.
Backend rule: secrets come from env (get_settings().admin), never hardcoded.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.modules.auth.models import User
from app.modules.auth.services import hash_password

logger = logging.getLogger("app.seed")


async def seed_admin(db: AsyncSession) -> None:
    """Idempotently create the admin account if it does not exist."""
    settings = get_settings()
    email = settings.admin.email.strip().lower()
    if not email:
        logger.warning("seed.admin_empty_email")
        return

    stmt = select(User).where(User.email == email)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing is not None:
        logger.info("seed.admin_exists", extra={"email": email})
        return

    admin = User(
        email=email,
        display_name="SheCare Admin",
        role="admin",
        is_verified=True,
        is_active=True,
        hashed_password=hash_password(settings.admin.password),
        provider="local",
    )
    db.add(admin)
    await db.commit()
    logger.info("seed.admin_created", extra={"email": email})