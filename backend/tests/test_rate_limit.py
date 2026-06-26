import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.mark.asyncio
async def test_rate_limiter_check_under_limit() -> None:
    from app.core.rate_limit import RateLimiter

    mock_redis = MagicMock()
    mock_pipe = AsyncMock()
    mock_pipe.zremrangebyscore.return_value = None
    mock_pipe.zadd.return_value = None
    mock_pipe.zcard.return_value = 5
    mock_pipe.expire.return_value = None
    mock_pipe.execute.return_value = [None, None, 5, None]
    mock_redis.pipeline.return_value = mock_pipe

    limiter = RateLimiter(mock_redis)
    await limiter.check("test_key", limit=10, window_seconds=60)


@pytest.mark.asyncio
async def test_rate_limiter_check_over_limit_raises() -> None:
    from app.core.rate_limit import RateLimiter
    from app.core.exceptions import RateLimitError

    mock_redis = MagicMock()
    mock_pipe = AsyncMock()
    mock_pipe.execute.return_value = [None, None, 15, None]
    mock_redis.pipeline.return_value = mock_pipe

    limiter = RateLimiter(mock_redis)
    with pytest.raises(RateLimitError) as exc_info:
        await limiter.check("test_key", limit=10, window_seconds=60)
    assert "Rate limit exceeded" in str(exc_info.value)


@pytest.mark.asyncio
async def test_rate_limiter_check_pipeline_called_correctly() -> None:
    from app.core.rate_limit import RateLimiter

    mock_redis = MagicMock()
    mock_pipe = AsyncMock()
    mock_pipe.execute.return_value = [None, None, 3, None]
    mock_redis.pipeline.return_value = mock_pipe

    limiter = RateLimiter(mock_redis)
    await limiter.check("test_key", limit=5, window_seconds=30)

    assert mock_pipe.zremrangebyscore.called
    assert mock_pipe.zadd.called
    assert mock_pipe.zcard.called
    assert mock_pipe.expire.called


def test_get_rate_limiter_returns_limiter() -> None:
    from app.core.rate_limit import get_rate_limiter, RateLimiter

    mock_redis = MagicMock()
    limiter = get_rate_limiter(redis=mock_redis)
    assert isinstance(limiter, RateLimiter)
