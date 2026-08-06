"""Luna module FastAPI dependencies (AGENTS.md §1.3, §1.5)."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limit import RateLimiterDep
from app.modules.luna.services import LunaService


async def get_luna_service(db: AsyncSession = Depends(get_db)) -> LunaService:
    return LunaService(db=db)


LunaServiceDep = Annotated[LunaService, Depends(get_luna_service)]

__all__ = ["LunaServiceDep", "RateLimiterDep", "get_luna_service"]
