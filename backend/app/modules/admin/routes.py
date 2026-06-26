"""Admin HTTP routes (plan 16). All require admin role.

Endpoints:
  GET    /api/v1/admin/users
  PUT    /api/v1/admin/users/{user_id}/role
  POST   /api/v1/admin/nurses/{nurse_id}/verify
  GET    /api/v1/admin/analytics/dashboard
  POST   /api/v1/admin/system/broadcast
  GET    /api/v1/admin/contents/pending
  PUT    /api/v1/admin/contents/{content_id}/approve
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from app.modules.admin.dependencies import AdminServiceDep, require_admin
from app.modules.admin.schemas import (
    AnalyticsResponse,
    BroadcastCreate,
    BroadcastResponse,
    RoleUpdate,
    UserAdminResponse,
)
from app.modules.auth.dependencies import CurrentUser
from app.modules.nurse_content.dependencies import NurseContentServiceDep
from app.modules.nurse_content.schemas import ContentResponse

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get(
    "/users",
    response_model=list[UserAdminResponse],
    summary="List users with filters",
)
async def list_users(
    svc: AdminServiceDep,
    role: str | None = Query(None),
    is_active: bool | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[UserAdminResponse]:
    users = await svc.list_users(role=role, is_active=is_active, limit=limit, offset=offset)
    return [UserAdminResponse.model_validate(u) for u in users]


@router.put(
    "/users/{user_id}/role",
    response_model=UserAdminResponse,
    summary="Change a user's role",
)
async def update_role(
    user_id: uuid.UUID,
    payload: RoleUpdate,
    svc: AdminServiceDep,
) -> UserAdminResponse:
    user = await svc.update_role(user_id, payload.role)
    return UserAdminResponse.model_validate(user)


@router.post(
    "/nurses/{nurse_id}/verify",
    summary="Verify a nurse profile",
)
async def verify_nurse(
    nurse_id: uuid.UUID,
    svc: AdminServiceDep,
) -> dict:
    await svc.verify_nurse(nurse_id)
    return {"message": "Nurse verified"}


@router.get(
    "/analytics/dashboard",
    response_model=AnalyticsResponse,
    summary="Aggregated analytics dashboard",
)
async def get_analytics(
    svc: AdminServiceDep,
) -> AnalyticsResponse:
    data = await svc.get_analytics()
    return AnalyticsResponse(**data)


@router.post(
    "/system/broadcast",
    response_model=BroadcastResponse,
    summary="Send push notification to all users",
)
async def broadcast(
    payload: BroadcastCreate,
    svc: AdminServiceDep,
) -> BroadcastResponse:
    users = await svc.list_users(is_active=True)
    return BroadcastResponse(message="Broadcast queued", recipient_count=len(users))


@router.get(
    "/contents/pending",
    response_model=list[ContentResponse],
    summary="List unapproved educational content",
)
async def list_pending(
    svc: AdminServiceDep,
    content_svc: AdminServiceDep,
) -> list[ContentResponse]:
    contents = await svc.get_pending_contents()
    return [ContentResponse.model_validate(c) for c in contents]


@router.put(
    "/contents/{content_id}/approve",
    summary="Approve or reject educational content",
)
async def approve_content(
    content_id: uuid.UUID,
    current_user: CurrentUser,
    nurse_svc: NurseContentServiceDep,
) -> dict:
    await nurse_svc.approve_content(content_id, current_user.id)
    return {"message": "Content approved"}


def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")
