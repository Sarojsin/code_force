"""Redis client factory.

Backend rules §1.2 / §18.3: clients live in core/ and are registered as singletons.
"""

from __future__ import annotations

from typing import Annotated

import redis.asyncio as redis_async
from fastapi import Depends

from app.core.config import Settings, get_settings

_pool: redis_async.ConnectionPool | None = None


def _get_pool() -> redis_async.ConnectionPool:
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = redis_async.ConnectionPool.from_url(
            settings.redis.url,
            decode_responses=True,
        )
    return _pool


def get_redis_client() -> redis_async.Redis:
    return redis_async.Redis(connection_pool=_get_pool())


RedisClient = Annotated[redis_async.Redis, Depends(get_redis_client)]


async def close_redis() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None


def get_redis_for_settings(settings: Settings) -> redis_async.Redis:
    """Override hook for tests: separate Redis URL per test run."""
    return redis_async.from_url(settings.redis.rate_limit_url, decode_responses=True)
