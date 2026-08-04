"""Cycle FastAPI dependencies (backend_rules.md §3.3)."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.encryption import EncryptionService, get_encryption_service
from app.modules.cycle.services import CycleService


async def get_cycle_service(
    db: AsyncSession = Depends(get_db),
    encryption: EncryptionService = Depends(get_encryption_service),
) -> CycleService:
    return CycleService(db=db, encryption=encryption)


CycleServiceDep = Annotated[CycleService, Depends(get_cycle_service)]
