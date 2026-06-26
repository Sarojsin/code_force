"""Onboarding HTTP routes (backend_rules.md §2.2: thin routes).

Endpoints:
  PUT   /api/v1/onboarding       Create or update onboarding data (idempotent upsert)
  GET   /api/v1/onboarding       Fetch current onboarding data
  GET   /api/v1/onboarding/status Return {"completed": bool}
"""

from __future__ import annotations

from fastapi import APIRouter, status

from app.core.event_bus import EventBus
from app.modules.auth.dependencies import CurrentUser
from app.modules.onboarding.dependencies import OnboardingServiceDep
from app.modules.onboarding.schemas import (
    OnboardingCreate,
    OnboardingResponse,
    OnboardingStatusResponse,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


@router.put(
    "",
    response_model=OnboardingResponse,
    status_code=status.HTTP_200_OK,
    summary="Create or update onboarding data (idempotent upsert). Triggers backfill + event on first completion.",
)
async def upsert_onboarding(
    payload: OnboardingCreate,
    current_user: CurrentUser,
    svc: OnboardingServiceDep,
) -> OnboardingResponse:
    onboarding = await svc.create_or_update(current_user.id, payload)
    return OnboardingResponse.model_validate(onboarding)


@router.get(
    "",
    response_model=OnboardingResponse,
    summary="Fetch current onboarding data (404 if not set up).",
)
async def get_onboarding(
    current_user: CurrentUser,
    svc: OnboardingServiceDep,
) -> OnboardingResponse:
    onboarding = await svc.get_onboarding(current_user.id)
    return OnboardingResponse.model_validate(onboarding)


@router.get(
    "/status",
    response_model=OnboardingStatusResponse,
    summary="Check if the user has completed onboarding.",
)
async def get_onboarding_status(
    current_user: CurrentUser,
    svc: OnboardingServiceDep,
) -> OnboardingStatusResponse:
    completed = await svc.get_status(current_user.id)
    return OnboardingStatusResponse(completed=completed)


def init_module(app, event_bus: EventBus) -> None:
    app.include_router(router, prefix="/api/v1")
