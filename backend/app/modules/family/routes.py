"""Family linking HTTP routes (plan 12).

Endpoints:
  POST   /api/v1/family/link/generate
  GET    /api/v1/family/link/{token}/info
  POST   /api/v1/family/link/{token}/accept
  GET    /api/v1/family/links
  PUT    /api/v1/family/links/{link_id}/permissions
  DELETE /api/v1/family/links/{link_id}
  GET    /api/v1/family/shared-data
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.modules.auth.dependencies import CurrentUser
from app.modules.family.dependencies import FamilyServiceDep
from app.modules.family.schemas import (
    FamilyLinkResponse,
    InviteAcceptResponse,
    InviteGenerateCreate,
    InviteGenerateResponse,
    InviteInfoResponse,
    PermissionUpdate,
    SharedDataResponse,
)

router = APIRouter(prefix="/family", tags=["family"])


@router.post(
    "/link/generate",
    response_model=InviteGenerateResponse,
    summary="Generate a family invite link",
)
async def generate_invite(
    payload: InviteGenerateCreate,
    current_user: CurrentUser,
    svc: FamilyServiceDep,
) -> InviteGenerateResponse:
    link, token = await svc.generate_invite(current_user.id, payload.permission_level)
    return InviteGenerateResponse(
        invite_token=token,
        expires_at=link.token_expires_at,
        shareable_link=f"/family/link/{token}/info",
    )


@router.get(
    "/link/{token}/info",
    response_model=InviteInfoResponse,
    summary="Get public info about an invite link",
)
async def get_invite_info(
    token: str,
    svc: FamilyServiceDep,
) -> InviteInfoResponse:
    link = await svc.get_invite_info(token)
    return InviteInfoResponse(
        inviter_name=None,
        token_expires_at=link.token_expires_at,
    )


@router.post(
    "/link/{token}/accept",
    response_model=InviteAcceptResponse,
    summary="Accept a family invite link",
)
async def accept_invite(
    token: str,
    current_user: CurrentUser,
    svc: FamilyServiceDep,
) -> InviteAcceptResponse:
    await svc.accept_invite(token, current_user.id)
    return InviteAcceptResponse()


@router.get(
    "/links",
    response_model=list[FamilyLinkResponse],
    summary="List all family links",
)
async def list_links(
    current_user: CurrentUser,
    svc: FamilyServiceDep,
) -> list[FamilyLinkResponse]:
    links = await svc.list_links(current_user.id)
    return [FamilyLinkResponse.model_validate(link) for link in links]


@router.put(
    "/links/{link_id}/permissions",
    response_model=FamilyLinkResponse,
    summary="Update permission level for a link",
)
async def update_permissions(
    link_id: uuid.UUID,
    payload: PermissionUpdate,
    current_user: CurrentUser,
    svc: FamilyServiceDep,
) -> FamilyLinkResponse:
    link = await svc.update_permissions(link_id, current_user.id, payload)
    return FamilyLinkResponse.model_validate(link)


@router.delete(
    "/links/{link_id}",
    response_model=None,
    status_code=204,
    summary="Revoke a family link",
)
async def revoke_link(
    link_id: uuid.UUID,
    current_user: CurrentUser,
    svc: FamilyServiceDep,
) -> None:
    await svc.revoke_link(link_id, current_user.id)
    return None


@router.get(
    "/shared-data",
    response_model=SharedDataResponse,
    summary="Get aggregated shared data from linked family members",
)
async def get_shared_data(
    current_user: CurrentUser,
    svc: FamilyServiceDep,
) -> SharedDataResponse:
    data = await svc.get_shared_data(current_user.id)
    return SharedDataResponse(**data)


def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")
