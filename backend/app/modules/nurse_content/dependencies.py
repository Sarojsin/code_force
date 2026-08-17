"""Nurse content FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.integrations.cloudinary_client import CloudinaryClient
from app.modules.auth.dependencies import CurrentUser
from app.modules.nurse_content.services import NurseContentService


async def get_cloudinary_client() -> CloudinaryClient:
    settings = get_settings()
    return CloudinaryClient(settings.cloudinary)


async def get_nurse_content_service(
    db: AsyncSession = Depends(get_db),
    cloudinary: CloudinaryClient = Depends(get_cloudinary_client),
) -> NurseContentService:
    return NurseContentService(db=db, cloudinary=cloudinary)


async def require_nurse(current_user: CurrentUser) -> None:
    """Gate nurse-content mutation routes to nurses and admins (Phase 1.4)."""
    if current_user.role not in {"nurse", "admin"}:
        raise HTTPException(
            status_code=403,
            detail={"code": "NURSE_REQUIRED", "details": "Nurse or admin role required"},
        )


NurseContentServiceDep = Annotated[NurseContentService, Depends(get_nurse_content_service)]
