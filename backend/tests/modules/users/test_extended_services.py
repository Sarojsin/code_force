from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.database import Base
from app.core.encryption import EncryptionService
from app.modules.auth.models import User
from app.modules.users.schemas import ProfileUpdate
from app.modules.users.services import UserService


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models as auth_models  # noqa: F401
        from app.modules.users import models as users_models  # noqa: F401
        from app.modules.wellness import models as wellness_models  # noqa: F401
        from app.modules.cycle import models as cycle_models  # noqa: F401
        from app.modules.safety import models as safety_models  # noqa: F401
        from app.modules.pregnancy import models as pregnancy_models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> UserService:
    settings = get_settings()
    encryption = EncryptionService(settings.encryption)
    return UserService(db=db_session, encryption=encryption)


async def _seed_user(db: AsyncSession) -> User:
    user = User(phone_number="+14155552671", display_name="Test User")
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.mark.asyncio
async def test_update_profile_with_medical_notes(svc: UserService, db_session: AsyncSession) -> None:
    user = await _seed_user(db_session)
    updated = await svc.update_profile(user.id, ProfileUpdate(medical_notes="Confidential note"))
    assert updated.medical_notes is not None
    assert updated.medical_notes != "Confidential note"


@pytest.mark.asyncio
async def test_register_duplicate_fcm_token(svc: UserService, db_session: AsyncSession) -> None:
    user = await _seed_user(db_session)
    tokens = await svc.register_fcm_token(user.id, "dup_token")
    tokens = await svc.register_fcm_token(user.id, "dup_token")
    assert tokens == ["dup_token"]


@pytest.mark.asyncio
async def test_remove_nonexistent_fcm_token(svc: UserService, db_session: AsyncSession) -> None:
    user = await _seed_user(db_session)
    tokens = await svc.remove_fcm_token(user.id, "nonexistent")
    assert tokens == []


@pytest.mark.asyncio
async def test_soft_delete_and_export_fails(svc: UserService, db_session: AsyncSession) -> None:
    user = await _seed_user(db_session)
    await svc.soft_delete(user.id)
    from app.modules.users.exceptions import UserNotFoundError
    with pytest.raises(UserNotFoundError):
        await svc.get_profile(user.id)
