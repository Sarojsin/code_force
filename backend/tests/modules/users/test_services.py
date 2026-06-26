"""User profile service tests."""

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

from app.core.database import Base
from app.core.encryption import EncryptionService
from app.modules.auth.models import User
from app.modules.users.exceptions import UserNotFoundError
from app.modules.users.schemas import ProfileUpdate
from app.modules.users.services import UserService


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models as auth_models  # noqa: F401
        from app.modules.users import models as users_models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> UserService:
    encryption = EncryptionService.__new__(EncryptionService)
    encryption._master_key = b"test-master-key-1234567890abcdef"
    encryption._key_size = 32
    return UserService(db=db_session, encryption=encryption)


async def _seed_user(db: AsyncSession) -> User:
    user = User(phone_number="+14155552671", display_name="Test User")
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest.mark.asyncio
async def test_get_profile(svc: UserService, db_session: AsyncSession) -> None:
    user = await _seed_user(db_session)
    profile = await svc.get_profile(user.id)
    assert profile.display_name == "Test User"


@pytest.mark.asyncio
async def test_get_profile_not_found(svc: UserService) -> None:
    with pytest.raises(UserNotFoundError):
        await svc.get_profile(uuid.uuid4())


@pytest.mark.asyncio
async def test_update_profile(svc: UserService, db_session: AsyncSession) -> None:
    user = await _seed_user(db_session)
    updated = await svc.update_profile(user.id, ProfileUpdate(display_name="Updated Name"))
    assert updated.display_name == "Updated Name"


@pytest.mark.asyncio
async def test_soft_delete(svc: UserService, db_session: AsyncSession) -> None:
    user = await _seed_user(db_session)
    await svc.soft_delete(user.id)
    with pytest.raises(UserNotFoundError):
        await svc.get_profile(user.id)


@pytest.mark.asyncio
async def test_fcm_token_roundtrip(svc: UserService, db_session: AsyncSession) -> None:
    user = await _seed_user(db_session)
    tokens = await svc.register_fcm_token(user.id, "token_123")
    assert "token_123" in tokens
    tokens = await svc.remove_fcm_token(user.id, "token_123")
    assert "token_123" not in tokens


@pytest.mark.asyncio
async def test_list_fcm_tokens(svc: UserService, db_session: AsyncSession) -> None:
    user = await _seed_user(db_session)
    await svc.register_fcm_token(user.id, "token_a")
    await svc.register_fcm_token(user.id, "token_b")
    tokens = await svc.list_fcm_tokens(user.id)
    assert len(tokens) == 2


@pytest.mark.asyncio
async def test_consent_lifecycle(svc: UserService, db_session: AsyncSession) -> None:
    user = await _seed_user(db_session)
    consent = await svc.record_consent(user.id, "privacy_policy", "1.0", True)
    assert consent.granted is True
    consents = await svc.list_consents(user.id)
    assert len(consents) == 1
