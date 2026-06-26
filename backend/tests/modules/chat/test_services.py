"""Chat integration service tests."""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")

import uuid
from collections.abc import AsyncIterator
from datetime import UTC
from typing import ClassVar

import pytest
import pytest_asyncio
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

from app.core.database import Base
from app.modules.chat.exceptions import ChatInviteExpiredError, ChatInviteNotFoundError
from app.modules.chat.services import ChatService


class FakeStreamClient:
    def generate_user_token(self, user_id: str) -> str:
        return f"stream_token_{user_id}"


class FakeSettings:
    environment = "test"
    cors_origins: ClassVar[list[str]] = ["*"]


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models as _auth_models  # noqa: F401 (users table for FK)
        from app.modules.chat import models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> ChatService:
    stream = FakeStreamClient()
    settings = FakeSettings()
    return ChatService(db=db_session, stream=stream, settings=settings)  # type: ignore[arg-type]


user_id = uuid.uuid4()


@pytest.mark.asyncio
async def test_generate_token(svc: ChatService) -> None:
    token = svc.generate_token(str(user_id))
    assert token.startswith("stream_token_")


@pytest.mark.asyncio
async def test_create_invite(svc: ChatService) -> None:
    invite = await svc.create_invite(user_id, room_id="room_123", max_uses=5)
    assert invite.id is not None
    assert invite.room_id == "room_123"
    assert invite.use_count == 0


@pytest.mark.asyncio
async def test_use_invite(svc: ChatService) -> None:
    invite = await svc.create_invite(user_id, room_id="room_abc")
    room_id = await svc.use_invite(invite.invite_token)
    assert room_id == "room_abc"


@pytest.mark.asyncio
async def test_use_invite_not_found(svc: ChatService) -> None:
    with pytest.raises(ChatInviteNotFoundError):
        await svc.use_invite("nonexistent-token")


@pytest.mark.asyncio
async def test_use_expired_invite(svc: ChatService) -> None:
    from datetime import datetime, timedelta

    from sqlalchemy import select

    from app.modules.chat.models import ChatInvite
    invite = await svc.create_invite(user_id, room_id="room_exp")
    stmt = select(ChatInvite).where(ChatInvite.id == invite.id)
    db_invite = (await svc.db.execute(stmt)).scalar_one()
    db_invite.expires_at = datetime.now(tz=UTC) - timedelta(days=1)
    await svc.db.commit()
    with pytest.raises(ChatInviteExpiredError):
        await svc.use_invite(invite.invite_token)


@pytest.mark.asyncio
async def test_use_invite_max_uses(svc: ChatService) -> None:
    invite = await svc.create_invite(user_id, room_id="room_max", max_uses=1)
    await svc.use_invite(invite.invite_token)
    with pytest.raises(Exception, match="reached maximum uses"):
        await svc.use_invite(invite.invite_token)


@pytest.mark.asyncio
async def test_list_rooms(svc: ChatService) -> None:
    rooms = await svc.list_rooms(user_id)
    assert len(rooms) >= 1
