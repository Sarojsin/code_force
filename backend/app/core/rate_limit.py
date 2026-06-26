"""Redis-backed sliding-window rate limiter.

Backend rule §14.3: per-endpoint rate limiting.
Backend plan 24: auth stricter (5/10min), default 100/min.
"""

from __future__ import annotations

import time
from typing import Annotated

from fastapi import Depends

from app.core.redis_client import RedisClient, get_redis_client


class RateLimiter:
    """Sliding-window rate limit using sorted sets in Redis.

    Each call adds a timestamp to a per-key ZSET, prunes entries older than
    the window, and counts the rest. If over the limit, raises the module's
    RateLimitError.
    """

    def __init__(self, redis: RedisClient) -> None:
        self._redis = redis

    async def check(self, key: str, limit: int, window_seconds: int) -> None:
        """Add a hit for `key` and raise if the count exceeds `limit`."""
        from app.core.exceptions import RateLimitError

        now_ms = int(time.time() * 1000)
        window_start_ms = now_ms - window_seconds * 1000
        member = f"{now_ms}:{id(object())}"  # uniqueness within the same ms

        pipe = self._redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start_ms)
        pipe.zadd(key, {member: now_ms})
        pipe.zcard(key)
        pipe.expire(key, window_seconds + 1)
        results = await pipe.execute()
        count = results[2] or 0
        if count > limit:
            retry_after = window_seconds
            raise RateLimitError(
                f"Rate limit exceeded: {count}/{limit} in {window_seconds}s. Retry in {retry_after}s."
            )


def get_rate_limiter(redis: RedisClient = Depends(get_redis_client)) -> RateLimiter:
    """FastAPI dependency: provides a RateLimiter backed by the shared Redis client."""
    return RateLimiter(redis)


RateLimiterDep = Annotated[RateLimiter, Depends(get_rate_limiter)]
