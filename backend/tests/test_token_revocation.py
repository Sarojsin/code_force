import uuid
from unittest.mock import AsyncMock

import pytest

from app.core.token_revocation import TokenRevocationStore, revocation_key


def test_revocation_key_format() -> None:
    jti = "abc-123"
    key = revocation_key(jti)
    assert key == "revoked_jwt:abc-123"


@pytest.mark.asyncio
async def test_revoke_sets_key_with_ttl() -> None:
    mock_redis = AsyncMock()
    store = TokenRevocationStore(mock_redis)

    jti = str(uuid.uuid4())
    await store.revoke(jti, ttl_seconds=3600)
    mock_redis.set.assert_called_once_with(
        f"revoked_jwt:{jti}", "1", ex=3600
    )


@pytest.mark.asyncio
async def test_is_revoked_returns_true_for_revoked_token() -> None:
    mock_redis = AsyncMock()
    mock_redis.exists.return_value = 1
    store = TokenRevocationStore(mock_redis)

    result = await store.is_revoked("test-jti")
    assert result is True


@pytest.mark.asyncio
async def test_is_revoked_returns_false_for_active_token() -> None:
    mock_redis = AsyncMock()
    mock_redis.exists.return_value = 0
    store = TokenRevocationStore(mock_redis)

    result = await store.is_revoked("test-jti")
    assert result is False
