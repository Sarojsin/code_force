"""Async SQLAlchemy engine, session factory, and base ORM model.

Backend rules:
- §4: UUID primary keys, created_at / updated_at / is_active on all tables
- §1.2: modules import from core, never the other way around
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Annotated

from sqlalchemy import DateTime, MetaData, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.config import get_settings

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=NAMING_CONVENTION)


class Base(DeclarativeBase):
    """Common model mixin: UUID PK + timestamps + soft delete."""

    metadata = metadata

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    client_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)


def _create_engine_kwargs() -> dict:
    """Build engine kwargs, excluding pool settings for SQLite which doesn't support them."""
    s = get_settings()
    kwargs: dict = {
        "url": s.database.url,
        "echo": s.database.echo,
    }
    if "sqlite" not in s.database.url:
        kwargs.update(
            pool_size=s.database.pool_size,
            max_overflow=s.database.max_overflow,
            pool_pre_ping=s.database.pool_pre_ping,
        )
    return kwargs


engine = create_async_engine(**_create_engine_kwargs())

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: yields a transactional session, rolls back on error."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


def get_db_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the session factory for out-of-request-context usage (Celery, audit)."""
    return AsyncSessionLocal

# Convenience type alias for route signatures
DBSession = Annotated[AsyncSession, get_db]
