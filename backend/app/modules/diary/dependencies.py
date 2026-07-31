"""Diary FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.integrations.s3_client import S3Client
from app.modules.diary.services import DiaryService


async def get_diary_service(
    db: AsyncSession = Depends(get_db),
) -> DiaryService:
    s3 = S3Client()
    return DiaryService(db=db, s3=s3)


DiaryServiceDep = Annotated[DiaryService, Depends(get_diary_service)]
