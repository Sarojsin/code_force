"""Users FastAPI dependencies (backend_rules.md §3.3)."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.encryption import EncryptionService, get_encryption_service
from app.modules.users.services import UserService


async def get_user_service(
    db: AsyncSession = Depends(get_db),
    encryption: EncryptionService = Depends(get_encryption_service),
) -> UserService:
    return UserService(db=db, encryption=encryption)


UserServiceDep = Annotated[UserService, Depends(get_user_service)]
