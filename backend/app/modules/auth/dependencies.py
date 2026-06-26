"""Auth FastAPI dependencies.

Rule §3.3: dependencies.py is where reusable deps live. Override them in tests.

Critical: ``get_current_user`` performs the **usk kill-switch** check by
comparing the SHA-256 hash of the stored ``user_secret_key`` against the
hash embedded in the JWT. If the user changed password, the hashes won't
match and the token is rejected.
"""

from __future__ import annotations

import hashlib
import uuid
from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.core.encryption import EncryptionService, get_encryption_service
from app.core.redis_client import get_redis_client
from app.core.security import get_current_user_id
from app.core.token_revocation import TokenRevocationStore
from app.integrations.twilio_client import TwilioClient
from app.modules.auth.models import User
from app.modules.auth.services import AuthService


def get_twilio_client(settings: Settings = Depends(get_settings)) -> TwilioClient:
    return TwilioClient(settings.twilio)


def get_encryption_dep() -> EncryptionService:
    return get_encryption_service()


def get_revocation_store() -> TokenRevocationStore:
    return TokenRevocationStore(get_redis_client())


async def get_auth_service(
    db: AsyncIterator[AsyncSession] = Depends(get_db),
    twilio: TwilioClient = Depends(get_twilio_client),
    settings: Settings = Depends(get_settings),
    encryption: EncryptionService = Depends(get_encryption_dep),
    revocation: TokenRevocationStore = Depends(get_revocation_store),
) -> AuthService:
    return AuthService(
        db=db, twilio=twilio, settings=settings, encryption=encryption, revocation=revocation,
    )


async def get_current_user(
    payload: Annotated[dict[str, Any], Depends(get_current_user_id)],
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the authenticated user from the JWT subject.

    Rule §14.1: user_id comes from the JWT, never the request body.

    **Kill-switch check:** The token embeds a SHA-256 hash of the user's
    ``user_secret_key``. If the user has rotated their secret (password
    change / security event), the hash won't match and the token is
    rejected — forcing a full re-login.

    **Lockout check:** If ``failed_login_attempts >= 10`` the account is
    locked until the user resets their password.
    """
    user_id_str = payload.get("sub")
    token_usk_hash = payload.get("usk", "")
    if not user_id_str or not token_usk_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token",
        )
    stmt = select(User).where(User.id == uuid.UUID(user_id_str)).where(User.is_active.is_(True))
    user = (await db.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    # Kill-switch: compare SHA-256 hash of stored secret against token's usk claim
    current_usk_hash = hashlib.sha256(user.user_secret_key.encode()).hexdigest()
    if token_usk_hash != current_usk_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
        )
    # Lockout check
    if user.failed_login_attempts >= 10:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account locked. Reset password.",
        )
    return user


CurrentUserId = Annotated[dict[str, Any], Depends(get_current_user_id)]
CurrentUser = Annotated[User, Depends(get_current_user)]
AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
