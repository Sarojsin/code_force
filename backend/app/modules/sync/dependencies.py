from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.sync.services import SyncService


async def get_sync_service(db: AsyncSession = Depends(get_db)) -> SyncService:
    return SyncService(db=db)


SyncServiceDep = Annotated[SyncService, Depends(get_sync_service)]
