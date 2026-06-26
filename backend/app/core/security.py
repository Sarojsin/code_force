"""JWT issuance, verification, and refresh-token helpers.

Backend rules:
- §5.3: secrets come from settings, never hardcoded
- §3.1: dependency-injected
- §14.1: row-level permission is enforced in the dependency
- Plan 40: token revocation list checked on every authenticated request

The ``user_secret_key`` is embedded as a **SHA-256 hash** so that:
  - The plain secret never leaves the database
  - Password rotation instantly invalidates all prior tokens (kill-switch)
  - A stolen token cannot be used once the secret is rotated
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import JWTSettings, get_settings
from app.core.token_revocation import TokenRevocationStore

bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(
    user_id: uuid.UUID,
    email: str,
    role: str,
    user_secret_key: str,
    settings: JWTSettings,
) -> tuple[str, str, int]:
    """Mint a short-lived access token. Returns (token, jti, expires_in_seconds).

    The ``user_secret_key`` is embedded as a **SHA-256 hash** so that every
    auth check can instantly detect a rotated secret (password change /
    security event invalidates all old tokens). The plain secret never
    leaves the database.
    """
    now = datetime.now(tz=UTC)
    expires_in = settings.access_token_expire_minutes * 60
    jti = str(uuid.uuid4())
    usk_hash = hashlib.sha256(user_secret_key.encode()).hexdigest()
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "usk": usk_hash,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in)).timestamp()),
        "jti": jti,
        "type": "access",
    }
    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    return token, jti, expires_in


def create_refresh_token(
    user_id: uuid.UUID,
    user_secret_key: str,
    settings: JWTSettings,
) -> tuple[str, str, datetime]:
    """Mint a long-lived refresh token. Returns (token, jti, expires_at).

    Also embeds the **SHA-256 hash** of ``user_secret_key`` so the refresh
    endpoint can detect a rotated secret and reject the token (forcing a
    full re-login).
    """
    expires_at = datetime.now(tz=UTC) + timedelta(days=settings.refresh_token_expire_days)
    jti = str(uuid.uuid4())
    usk_hash = hashlib.sha256(user_secret_key.encode()).hexdigest()
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "usk": usk_hash,
        "iat": int(datetime.now(tz=UTC).timestamp()),
        "exp": int(expires_at.timestamp()),
        "jti": jti,
        "type": "refresh",
    }
    token = jwt.encode(payload, settings.refresh_secret_key, algorithm=settings.algorithm)
    return token, jti, expires_at


def decode_token(token: str, *, secret: str, expected_type: str, algorithm: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, secret, algorithms=[algorithm])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_TOKEN", "details": str(exc)},
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    if payload.get("type") != expected_type:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "WRONG_TOKEN_TYPE", "details": f"expected {expected_type} token"},
        )
    return payload


def get_token_revocation_store(
    redis: object = Depends(lambda: None),  # placeholder; overridden by dependency below
) -> TokenRevocationStore:
    """Real dependency: redis-backed revocation store."""
    from app.core.redis_client import get_redis_client

    return TokenRevocationStore(get_redis_client())


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: JWTSettings = Depends(lambda: get_settings().jwt),
    revocation: TokenRevocationStore = Depends(get_token_revocation_store),
) -> dict[str, Any]:
    """FastAPI dependency: returns the decoded JWT payload (sub, usk, role, email, jti).

    Implements rule §14.1: user_id comes from the JWT, never the request body.
    Also checks the Redis revocation list (plan 40).
    The caller (usually a service or another dependency) can inspect ``usk``
    to verify the user's secret hasn't rotated since the token was issued.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MISSING_BEARER", "details": "Authorization Bearer token required"},
        )
    payload = decode_token(
        credentials.credentials,
        secret=settings.secret_key,
        expected_type="access",
        algorithm=settings.algorithm,
    )
    jti = payload.get("jti", "")
    if jti and await revocation.is_revoked(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "TOKEN_REVOKED", "details": "This token has been revoked"},
        )
    if "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "MALFORMED_CLAIMS", "details": "Missing subject claim"},
        )
    return payload
