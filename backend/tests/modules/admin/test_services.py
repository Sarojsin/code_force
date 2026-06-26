"""Admin module service tests."""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base
from app.modules.admin.services import AdminService
from app.modules.auth.models import User


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models  # noqa: F401
        from app.modules.pregnancy import models as preg_models  # noqa: F401
        from app.modules.safety import models as safety_models  # noqa: F401
        from app.modules.users import models as users_models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> AdminService:
    return AdminService(db=db_session)


async def _seed_user(db: AsyncSession, role: str = "user", is_active: bool = True) -> User:
    user = User(phone_number=f"+1415555{role}", role=role, is_active=is_active)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.mark.asyncio
async def test_list_users(svc: AdminService, db_session: AsyncSession) -> None:
    await _seed_user(db_session, role="user")
    await _seed_user(db_session, role="admin")
    users = await svc.list_users()
    assert len(users) >= 2


@pytest.mark.asyncio
async def test_list_users_by_role(svc: AdminService, db_session: AsyncSession) -> None:
    await _seed_user(db_session, role="user")
    await _seed_user(db_session, role="nurse")
    admins = await svc.list_users(role="nurse")
    assert len(admins) == 1


@pytest.mark.asyncio
async def test_update_role(svc: AdminService, db_session: AsyncSession) -> None:
    user = await _seed_user(db_session, role="user")
    updated = await svc.update_role(user.id, "nurse")
    assert updated.role == "nurse"


@pytest.mark.asyncio
async def test_get_analytics(svc: AdminService, db_session: AsyncSession) -> None:
    await _seed_user(db_session, role="user")
    await _seed_user(db_session, role="admin")
    analytics = await svc.get_analytics()
    assert analytics["total_users"] >= 2
    assert analytics["active_users"] >= 2
    assert analytics["sos_count"] == 0
