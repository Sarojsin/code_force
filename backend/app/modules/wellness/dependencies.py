"""Wellness FastAPI dependencies (backend_rules.md §3.3)."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.encryption import EncryptionService, get_encryption_service
from app.integrations.huggingface_client import HuggingFaceClient
from app.modules.wellness.services import WellnessService


async def get_wellness_service(
    db: AsyncSession = Depends(get_db),
    encryption: EncryptionService = Depends(get_encryption_service),
) -> WellnessService:
    settings = get_settings()
    hf_client = HuggingFaceClient(settings.huggingface)
    return WellnessService(db=db, encryption=encryption, hf_client=hf_client)


WellnessServiceDep = Annotated[WellnessService, Depends(get_wellness_service)]
