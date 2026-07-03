"""Pregnancy HTTP routes (backend_rules.md §2.2: thin routes).

Endpoints:
  POST   /api/v1/pregnancy/profile
  GET    /api/v1/pregnancy/profile
  PUT    /api/v1/pregnancy/profile
  DELETE /api/v1/pregnancy/profile
  POST   /api/v1/pregnancy/daily-log
  GET    /api/v1/pregnancy/daily-logs
  GET    /api/v1/pregnancy/milestone
  GET    /api/v1/pregnancy/recommendations
"""

from __future__ import annotations

from fastapi import APIRouter, Query, status

from app.modules.auth.dependencies import CurrentUser
from app.modules.pregnancy.dependencies import PregnancyServiceDep
from app.modules.pregnancy.schemas import (
    DailyLogCreate,
    DailyLogResponse,
    MilestoneResponse,
    PregnancyProfileCreate,
    PregnancyProfileResponse,
    PregnancyProfileUpdate,
    RecommendationResponse,
)

router = APIRouter(prefix="/pregnancy", tags=["pregnancy"])


@router.post(
    "/profile",
    response_model=PregnancyProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a pregnancy profile from LMP or due date",
)
async def create_profile(
    payload: PregnancyProfileCreate,
    current_user: CurrentUser,
    svc: PregnancyServiceDep,
) -> PregnancyProfileResponse:
    profile = await svc.create_profile(current_user.id, payload)
    return PregnancyProfileResponse.model_validate(profile)


@router.get(
    "/profile",
    response_model=PregnancyProfileResponse,
    summary="Get current pregnancy info",
)
async def get_profile(
    current_user: CurrentUser,
    svc: PregnancyServiceDep,
) -> PregnancyProfileResponse:
    profile = await svc.get_profile(current_user.id)
    return PregnancyProfileResponse.model_validate(profile)


@router.put(
    "/profile",
    response_model=PregnancyProfileResponse,
    summary="Update pregnancy profile",
)
async def update_profile(
    payload: PregnancyProfileUpdate,
    current_user: CurrentUser,
    svc: PregnancyServiceDep,
) -> PregnancyProfileResponse:
    profile = await svc.update_profile(current_user.id, payload)
    return PregnancyProfileResponse.model_validate(profile)


@router.delete(
    "/profile",
    response_model=None,
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archive pregnancy profile after delivery",
)
async def archive_profile(
    current_user: CurrentUser,
    svc: PregnancyServiceDep,
) -> None:
    await svc.archive_profile(current_user.id)
    return None


@router.post(
    "/daily-log",
    response_model=DailyLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log daily symptoms, cravings, and mood",
)
async def create_daily_log(
    payload: DailyLogCreate,
    current_user: CurrentUser,
    svc: PregnancyServiceDep,
) -> DailyLogResponse:
    profile = await svc.get_profile(current_user.id)
    log = await svc.create_daily_log(profile.id, payload)
    return DailyLogResponse.model_validate(log)


@router.get(
    "/daily-logs",
    response_model=list[DailyLogResponse],
    summary="List daily logs",
)
async def list_daily_logs(
    current_user: CurrentUser,
    svc: PregnancyServiceDep,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[DailyLogResponse]:
    profile = await svc.get_profile(current_user.id)
    logs = await svc.list_daily_logs(profile.id, limit=limit, offset=offset)
    return [DailyLogResponse.model_validate(log) for log in logs]


@router.get(
    "/milestone",
    response_model=MilestoneResponse,
    summary="Get current week's milestone",
)
async def get_milestone(
    current_user: CurrentUser,
    svc: PregnancyServiceDep,
) -> MilestoneResponse:
    milestone = await svc.get_current_milestone(current_user.id)
    return MilestoneResponse.model_validate(milestone)


@router.get(
    "/recommendations",
    response_model=RecommendationResponse,
    summary="Get personalized diet/exercise tips based on trimester",
)
async def get_recommendations(
    current_user: CurrentUser,
    svc: PregnancyServiceDep,
) -> RecommendationResponse:
    data = await svc.get_recommendations(current_user.id)
    return RecommendationResponse(**data)


def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")
