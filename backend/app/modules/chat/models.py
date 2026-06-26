from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ChatInvite(Base):
    __tablename__ = "chat_invites"

    room_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    inviter_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    invite_token: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    max_uses: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    use_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
