"""Family linking service tests."""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

from app.core.database import Base
from app.modules.family.exceptions import InviteTokenExpiredError, LinkNotFoundError, SelfLinkError
from app.modules.family.models import FamilyLink
from app.modules.family.schemas import PermissionUpdate
from app.modules.family.services import FamilyService


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models as _auth_models  # noqa: F401 (users table for FK)
        from app.modules.family import models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> FamilyService:
    return FamilyService(db=db_session)


user_id = uuid.uuid4()
linked_id = uuid.uuid4()
other_user_id = uuid.uuid4()


@pytest.mark.asyncio
async def test_generate_invite(svc: FamilyService) -> None:
    link, token = await svc.generate_invite(user_id, permission_level=7)
    assert link.id is not None
    assert token is not None
    assert link.status == "pending"


@pytest.mark.asyncio
async def test_accept_invite(svc: FamilyService) -> None:
    _, token = await svc.generate_invite(user_id, permission_level=7)
    accepted = await svc.accept_invite(token, linked_id)
    assert accepted.status == "accepted"
    assert accepted.linked_user_id == linked_id


@pytest.mark.asyncio
async def test_accept_own_invite_raises(svc: FamilyService) -> None:
    _, token = await svc.generate_invite(user_id, permission_level=1)
    with pytest.raises(SelfLinkError):
        await svc.accept_invite(token, user_id)


@pytest.mark.asyncio
async def test_get_invite_info_not_found(svc: FamilyService) -> None:
    with pytest.raises(LinkNotFoundError):
        await svc.get_invite_info("nonexistent-token")


@pytest.mark.asyncio
async def test_list_links(svc: FamilyService) -> None:
    _, token = await svc.generate_invite(user_id, permission_level=3)
    await svc.accept_invite(token, linked_id)
    links = await svc.list_links(user_id)
    assert len(links) >= 1


@pytest.mark.asyncio
async def test_update_permissions(svc: FamilyService) -> None:
    link, token = await svc.generate_invite(user_id, permission_level=1)
    await svc.accept_invite(token, linked_id)
    updated = await svc.update_permissions(link.id, user_id, PermissionUpdate(permission_level=7))
    assert updated.permission_level == 7


@pytest.mark.asyncio
async def test_revoke_link(svc: FamilyService) -> None:
    link, token = await svc.generate_invite(user_id, permission_level=1)
    await svc.accept_invite(token, linked_id)
    await svc.revoke_link(link.id, user_id)
    links = await svc.list_links(user_id)
    assert len(links) == 0


@pytest.mark.asyncio
async def test_get_invite_info_success(svc: FamilyService) -> None:
    link, token = await svc.generate_invite(user_id, permission_level=5)
    result = await svc.get_invite_info(token)
    assert result.id == link.id
    assert result.status == "pending"


@pytest.mark.asyncio
async def test_get_invite_info_expired(svc: FamilyService, db_session: AsyncSession) -> None:
    expired = FamilyLink(
        user_id=user_id,
        invite_token="expired-token-123",
        token_expires_at=datetime.now(tz=UTC) - timedelta(hours=1),
        permission_level=1,
        status="pending",
    )
    db_session.add(expired)
    await db_session.commit()
    with pytest.raises(InviteTokenExpiredError):
        await svc.get_invite_info("expired-token-123")


@pytest.mark.asyncio
async def test_get_shared_data_empty(svc: FamilyService) -> None:
    result = await svc.get_shared_data(other_user_id)
    assert result == {"mood_data": [], "cycle_data": [], "pregnancy_data": None}
