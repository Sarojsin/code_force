"""Redis-backed JWT revocation list.

Backend rule §5.2 + plan 40: support remote logout / token revocation.
Each access token's jti is stored with the same exp as the token. The
get_current_user_id dependency checks the revocation set on every request.
"""

from __future__ import annotations

from app.core.redis_client import RedisClient

REVOCATION_KEY_PREFIX = "revoked_jwt:"


def revocation_key(jti: str) -> str:
    return f"{REVOCATION_KEY_PREFIX}{jti}"


class TokenRevocationStore:
    def __init__(self, redis: RedisClient) -> None:
        self._redis = redis

    async def revoke(self, jti: str, ttl_seconds: int) -> None:
        """Add jti to the revocation set with a TTL matching the token's exp."""
        await self._redis.set(revocation_key(jti), "1", ex=ttl_seconds)

    async def is_revoked(self, jti: str) -> bool:
        return bool(await self._redis.exists(revocation_key(jti)))
