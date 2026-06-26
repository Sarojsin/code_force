"""Nurse content FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.nurse_content.services import NurseContentService


async def get_nurse_content_service(
    db: AsyncSession = Depends(get_db),
) -> NurseContentService:
    return NurseContentService(db=db)


NurseContentServiceDep = Annotated[NurseContentService, Depends(get_nurse_content_service)]
