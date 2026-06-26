import uuid
from unittest.mock import MagicMock, patch

import pytest
from app.core.config import JWTSettings


@pytest.fixture
def jwt_settings() -> JWTSettings:
    return JWTSettings(
        secret_key="test-secret-key-1234567890",
        refresh_secret_key="test-refresh-secret-1234567890",
        algorithm="HS256",
        access_token_expire_minutes=15,
        refresh_token_expire_days=7,
    )


def test_create_access_token_returns_token_jti_expires(jwt_settings: JWTSettings) -> None:
    from app.core.security import create_access_token

    user_id = uuid.uuid4()
    token, jti, expires_in = create_access_token(
        user_id=user_id,
        email="test@example.com",
        role="user",
        user_secret_key="test-secret",
        settings=jwt_settings,
    )
    assert isinstance(token, str)
    assert len(token) > 20
    assert isinstance(jti, str)
    assert isinstance(expires_in, int)
    assert expires_in == 15 * 60


def test_create_refresh_token_returns_token_jti_expires_at(jwt_settings: JWTSettings) -> None:
    from app.core.security import create_refresh_token

    user_id = uuid.uuid4()
    token, jti, expires_at = create_refresh_token(
        user_id=user_id,
        user_secret_key="test-secret",
        settings=jwt_settings,
    )
    assert isinstance(token, str)
    assert isinstance(jti, str)
    assert hasattr(expires_at, "timestamp")


def test_decode_valid_access_token(jwt_settings: JWTSettings) -> None:
    from app.core.security import create_access_token, decode_token

    user_id = uuid.uuid4()
    token, jti, _ = create_access_token(
        user_id=user_id, email="test@example.com", role="user",
        user_secret_key="test-secret", settings=jwt_settings,
    )
    payload = decode_token(token, secret=jwt_settings.secret_key, expected_type="access", algorithm=jwt_settings.algorithm)
    assert payload["sub"] == str(user_id)
    assert payload["email"] == "test@example.com"
    assert payload["jti"] == jti


def test_decode_token_wrong_type_raises(jwt_settings: JWTSettings) -> None:
    from app.core.security import create_access_token, decode_token
    from fastapi import HTTPException

    token, _, _ = create_access_token(
        user_id=uuid.uuid4(), email="test@example.com", role="user",
        user_secret_key="test-secret", settings=jwt_settings,
    )
    with pytest.raises(HTTPException) as exc:
        decode_token(token, secret=jwt_settings.secret_key, expected_type="refresh", algorithm=jwt_settings.algorithm)
    assert exc.value.status_code == 401


def test_decode_invalid_token_raises(jwt_settings: JWTSettings) -> None:
    from app.core.security import decode_token
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        decode_token("invalid.token.here", secret=jwt_settings.secret_key, expected_type="access", algorithm=jwt_settings.algorithm)
    assert exc.value.status_code == 401
