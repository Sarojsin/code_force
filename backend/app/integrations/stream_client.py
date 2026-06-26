"""Stream Chat client: user upsert, channel creation, token generation.

Backend rule §18. Backend only manages auth + invite links; chat traffic
flows through Stream's managed infrastructure.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import jwt as pyjwt

from app.core.config import StreamSettings

logger = logging.getLogger(__name__)


class StreamClient:
    def __init__(self, settings: StreamSettings) -> None:
        self._settings = settings

    def generate_user_token(self, user_id: str, exp_seconds: int = 24 * 3600) -> str:
        """Generate a short-lived Stream Chat JWT for a user."""
        payload: dict[str, Any] = {
            "user_id": user_id,
            "iat": int(time.time()),
            "exp": int(time.time()) + exp_seconds,
        }
        return pyjwt.encode(payload, self._settings.api_secret, algorithm="HS256")

    async def upsert_user(self, user_id: str, display_name: str, role: str = "user") -> None:
        """Idempotently create the user in Stream (plan 14)."""
        raise NotImplementedError("StreamClient.upsert_user — plan 14")

    async def create_channel(
        self,
        channel_id: str,
        members: list[str],
        channel_type: str = "messaging",
    ) -> None:
        """Create a private channel with the given members."""
        raise NotImplementedError("StreamClient.create_channel — plan 14")

    async def add_members(self, channel_id: str, members: list[str]) -> None:
        raise NotImplementedError("StreamClient.add_members — plan 14")
