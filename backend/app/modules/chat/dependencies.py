"""Chat FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.integrations.stream_client import StreamClient
from app.modules.chat.services import ChatService


async def get_chat_service(
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ChatService:
    stream = StreamClient(settings.stream)
    return ChatService(db=db, stream=stream, settings=settings)


ChatServiceDep = Annotated[ChatService, Depends(get_chat_service)]
