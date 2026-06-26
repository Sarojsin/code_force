"""Family Celery task tests: cleanup_expired_tokens."""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.celery_app import celery_app
from app.core.database import Base


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@pytest.fixture(autouse=True)
def eager_celery() -> None:
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = True
    yield
    celery_app.conf.task_always_eager = False
    celery_app.conf.task_eager_propagates = False


@pytest.fixture
def db_session():
    import app.core.database as db_module
    from app.modules.auth import models as _auth_models  # noqa: F401
    from app.modules.family import models  # noqa: F401

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    async def _init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_init())

    sm = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    original = db_module.AsyncSessionLocal
    db_module.AsyncSessionLocal = sm

    yield sm

    db_module.AsyncSessionLocal = original
    asyncio.run(engine.dispose())


def _run(coro):
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# cleanup_expired_tokens
# ---------------------------------------------------------------------------


def test_cleanup_expired_tokens_empty(db_session) -> None:
    from app.modules.family.tasks import cleanup_expired_tokens

    result = cleanup_expired_tokens.delay()

    assert result.successful()
    assert result.result == 0


def test_cleanup_expired_tokens_revokes_expired(db_session) -> None:
    from app.modules.family.tasks import cleanup_expired_tokens

    sm = db_session
    user_id = uuid.uuid4()
    link_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            from app.modules.auth.models import User
            from app.modules.family.models import FamilyLink

            session.add(
                User(id=user_id, email="family@test.com", provider="local", is_verified=True)
            )
            session.add(
                FamilyLink(
                    id=link_id,
                    user_id=user_id,
                    invite_token="expired-token",
                    token_expires_at=datetime.now(tz=UTC) - timedelta(days=30),
                    status="pending",
                    is_active=True,
                )
            )
            await session.commit()

    _run(_seed())

    result = cleanup_expired_tokens.delay()

    assert result.successful()
    assert result.result == 1

    async def _verify() -> None:
        from sqlalchemy import select

        from app.modules.family.models import FamilyLink

        async with sm() as session:
            link = (
                await session.execute(select(FamilyLink).where(FamilyLink.id == link_id))
            ).scalar_one()
            assert link.is_active is False
            assert link.status == "revoked"

    _run(_verify())


def test_cleanup_expired_tokens_skips_valid(db_session) -> None:
    from app.modules.family.tasks import cleanup_expired_tokens

    sm = db_session
    user_id = uuid.uuid4()
    link_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            from app.modules.auth.models import User
            from app.modules.family.models import FamilyLink

            session.add(
                User(id=user_id, email="family2@test.com", provider="local", is_verified=True)
            )
            session.add(
                FamilyLink(
                    id=link_id,
                    user_id=user_id,
                    invite_token="valid-token",
                    token_expires_at=datetime.now(tz=UTC) + timedelta(days=30),
                    status="pending",
                    is_active=True,
                )
            )
            await session.commit()

    _run(_seed())

    result = cleanup_expired_tokens.delay()

    assert result.successful()
    assert result.result == 0

    async def _verify() -> None:
        from sqlalchemy import select

        from app.modules.family.models import FamilyLink

        async with sm() as session:
            link = (
                await session.execute(select(FamilyLink).where(FamilyLink.id == link_id))
            ).scalar_one()
            assert link.is_active is True
            assert link.status == "pending"

    _run(_verify())
