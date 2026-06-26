"""Pregnancy FastAPI dependencies (backend_rules.md §3.3)."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.pregnancy.services import PregnancyService


async def get_pregnancy_service(
    db: AsyncSession = Depends(get_db),
) -> PregnancyService:
    return PregnancyService(db=db)


PregnancyServiceDep = Annotated[PregnancyService, Depends(get_pregnancy_service)]
