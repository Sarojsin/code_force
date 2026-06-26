"""Onboarding FastAPI dependencies (backend_rules.md §3.3)."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.modules.onboarding.services import OnboardingService


async def get_onboarding_service(
    db: AsyncSession = Depends(get_db),
) -> OnboardingService:
    return OnboardingService(db=db)


OnboardingServiceDep = Annotated[OnboardingService, Depends(get_onboarding_service)]
