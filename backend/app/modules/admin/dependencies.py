"""Admin FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.admin.services import AdminService
from app.modules.auth.dependencies import CurrentUser


async def get_admin_service(
    db: AsyncSession = Depends(get_db),
) -> AdminService:
    return AdminService(db=db)


async def require_admin(current_user: CurrentUser) -> None:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail={"code": "ADMIN_REQUIRED", "details": "Admin role required"})


AdminServiceDep = Annotated[AdminService, Depends(get_admin_service)]
