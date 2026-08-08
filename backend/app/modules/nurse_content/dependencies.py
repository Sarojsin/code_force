"""Nurse content FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.integrations.cloudinary_client import CloudinaryClient
from app.modules.nurse_content.services import NurseContentService


async def get_nurse_content_service(
    db: AsyncSession = Depends(get_db),
) -> NurseContentService:
    cloudinary = CloudinaryClient(settings=get_settings().cloudinary)
    return NurseContentService(db=db, cloudinary=cloudinary)


NurseContentServiceDep = Annotated[NurseContentService, Depends(get_nurse_content_service)]
