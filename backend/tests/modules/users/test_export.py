"""User data export (GDPR) service tests."""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("JWT__SECRET_KEY", "test-secret-key")
os.environ.setdefault("JWT__REFRESH_SECRET_KEY", "test-refresh-secret-key")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import sqlite3
import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

sqlite3.register_adapter(uuid.UUID, str)


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


from app.core.database import Base
from app.core.encryption import EncryptionService
from app.modules.auth.models import User
from app.modules.users.exceptions import UserNotFoundError
from app.modules.users.schemas import DataExportResponse
from app.modules.users.services import UserService


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models as _auth_models  # noqa: F401
        from app.modules.cycle import models as _cycle_models  # noqa: F401
        from app.modules.pregnancy import models as _pregnancy_models  # noqa: F401
        from app.modules.safety import models as _safety_models  # noqa: F401
        from app.modules.users import models as _users_models  # noqa: F401
        from app.modules.wellness import models as _wellness_models  # noqa: F401
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
    user = User(phone_number="+14155552671", display_name="Export User")
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _seed_consent(db: AsyncSession, user_id: uuid.UUID) -> None:
    from app.modules.users.models import UserConsent

    db.add(
        UserConsent(
            user_id=user_id,
            consent_type="privacy_policy",
            version="2.0",
            granted=True,
        )
    )
    await db.commit()


async def _seed_emergency_contact(db: AsyncSession, user_id: uuid.UUID) -> None:
    from app.modules.users.models import EmergencyContact

    db.add(
        EmergencyContact(
            user_id=user_id,
            name="Mom",
            phone_number="+14155551234",
            relationship="mother",
            is_primary=True,
        )
    )
    await db.commit()


@pytest.mark.asyncio
async def test_export_user_data_structure(svc: UserService, db_session: AsyncSession) -> None:
    user = await _seed_user(db_session)
    await _seed_consent(db_session, user.id)
    await _seed_emergency_contact(db_session, user.id)

    result = await svc.export_user_data(user.id)

    assert isinstance(result, DataExportResponse)
    assert result.user.id == user.id
    assert result.user.display_name == "Export User"
    assert result.user.phone_number == "+14155552671"

    assert isinstance(result.consents, list)
    assert len(result.consents) == 1
    assert result.consents[0].consent_type == "privacy_policy"

    assert isinstance(result.emergency_contacts, list)
    assert isinstance(result.journal_entries, list)
    assert isinstance(result.mood_logs, list)
    assert isinstance(result.cycle_entries, list)
    assert isinstance(result.pregnancy_profiles, list)
    assert isinstance(result.pregnancy_daily_logs, list)
    assert isinstance(result.sos_alerts, list)
    assert isinstance(result.audit_logs, list)
    assert result.generated_at is not None


@pytest.mark.asyncio
async def test_export_user_data_empty_lists(svc: UserService, db_session: AsyncSession) -> None:
    user = await _seed_user(db_session)

    result = await svc.export_user_data(user.id)

    assert result.journal_entries == []
    assert result.mood_logs == []
    assert result.cycle_entries == []
    assert result.pregnancy_profiles == []
    assert result.pregnancy_daily_logs == []
    assert result.sos_alerts == []
    assert result.consents == []
    assert result.emergency_contacts == []


@pytest.mark.asyncio
async def test_export_user_data_not_found(svc: UserService) -> None:
    with pytest.raises(UserNotFoundError):
        await svc.export_user_data(uuid.uuid4())
