"""Family FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.family.services import FamilyService


async def get_family_service(
    db: AsyncSession = Depends(get_db),
) -> FamilyService:
    return FamilyService(db=db)


FamilyServiceDep = Annotated[FamilyService, Depends(get_family_service)]
