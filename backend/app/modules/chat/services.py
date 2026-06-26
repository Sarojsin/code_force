"""Chat service: Stream tokens, invite links (plan 14)."""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.integrations.stream_client import StreamClient
from app.modules.chat.exceptions import (
    ChatInviteExpiredError,
    ChatInviteMaxUsesError,
    ChatInviteNotFoundError,
)
from app.modules.chat.models import ChatInvite


class ChatService:
    def __init__(self, db: AsyncSession, stream: StreamClient, settings: Settings) -> None:
        self.db = db
        self.stream = stream
        self.settings = settings

    def generate_token(self, user_id: str) -> str:
        return self.stream.generate_user_token(user_id)

    async def create_invite(self, inviter_id: uuid.UUID, room_id: str, max_uses: int = 10) -> ChatInvite:
        token = secrets.token_urlsafe(32)
        invite = ChatInvite(
            room_id=room_id,
            inviter_user_id=inviter_id,
            invite_token=token,
            expires_at=datetime.now(tz=UTC) + timedelta(days=7),
            max_uses=max_uses,
        )
        self.db.add(invite)
        await self.db.commit()
        await self.db.refresh(invite)
        return invite

    async def use_invite(self, token: str) -> str:
        stmt = select(ChatInvite).where(ChatInvite.invite_token == token)
        invite = (await self.db.execute(stmt)).scalar_one_or_none()
        if invite is None:
            raise ChatInviteNotFoundError("Chat invite not found")
        expires = invite.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        if expires < datetime.now(tz=UTC):
            raise ChatInviteExpiredError("Chat invite has expired")
        if invite.use_count >= invite.max_uses:
            raise ChatInviteMaxUsesError("Chat invite has reached maximum uses")
        invite.use_count += 1
        await self.db.commit()
        return invite.room_id

    async def list_rooms(self, user_id: uuid.UUID) -> list[dict]:
        return [{"room_id": "demo-room", "member_count": 1}]
