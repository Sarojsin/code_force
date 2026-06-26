"""Safety FastAPI dependencies (backend_rules.md §3.3)."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.database import get_db
from app.integrations.fcm_client import FCMClient
from app.integrations.twilio_client import TwilioClient
from app.modules.safety.services import SafetyService


async def get_twilio_client(settings: Settings = Depends(get_settings)) -> TwilioClient:
    return TwilioClient(settings.twilio)


async def get_fcm_client(settings: Settings = Depends(get_settings)) -> FCMClient:
    return FCMClient(settings.fcm)


async def get_event_bus(request: Request):
    return request.app.state.event_bus


async def get_safety_service(
    db: AsyncSession = Depends(get_db),
    twilio: TwilioClient = Depends(get_twilio_client),
    fcm: FCMClient = Depends(get_fcm_client),
    settings: Settings = Depends(get_settings),
    event_bus=Depends(get_event_bus),
) -> SafetyService:
    return SafetyService(db=db, twilio=twilio, fcm=fcm, settings=settings, event_bus=event_bus)


SafetyServiceDep = Annotated[SafetyService, Depends(get_safety_service)]
