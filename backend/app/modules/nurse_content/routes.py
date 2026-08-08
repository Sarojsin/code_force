"""Nurse content HTTP routes.

Admin endpoints (single-admin model):
  POST   /api/v1/admin/contents/upload-url   - Cloudinary signed upload URL
  POST   /api/v1/admin/contents              - create content (auto-approved)
  GET    /api/v1/admin/contents              - list ALL content
  PUT    /api/v1/admin/contents/{id}         - edit content
  DELETE /api/v1/admin/contents/{id}         - delete content

Public:
  GET    /api/v1/contents                    - approved content list
  GET    /api/v1/contents/{id}               - approved content detail
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query

from app.modules.admin.dependencies import require_admin
from app.modules.auth.dependencies import CurrentUser
from app.modules.nurse_content.dependencies import NurseContentServiceDep
from app.modules.nurse_content.schemas import (
    ContentCreate,
    ContentResponse,
    ContentUpdate,
    UploadUrlResponse,
)

router = APIRouter(
    prefix="/admin",
    tags=["nurse-content-admin"],
    dependencies=[Depends(require_admin)],
)
public_router = APIRouter(prefix="/contents", tags=["content"])


@router.post(
    "/contents/upload-url",
    response_model=UploadUrlResponse,
    summary="Get Cloudinary signed upload URL for media",
)
async def get_upload_url(
    current_user: CurrentUser,
    svc: NurseContentServiceDep,
    resource_type: str = Query("image", pattern="^(image|video)$"),
) -> UploadUrlResponse:
    payload = svc.cloudinary.signed_upload_payload(
        resource_type=resource_type,
        folder="health_content",
        tags=[f"content-{current_user.id}"],
    )
    return UploadUrlResponse(
        upload_url="https://api.cloudinary.com/v1_1/"
        + payload["cloud_name"]
        + "/"
        + resource_type
        + "/upload",
        cloud_name=payload["cloud_name"],
        api_key=payload["api_key"],
        timestamp=payload["timestamp"],
        folder=payload["folder"],
        tags=payload["tags"],
        signature=payload["signature"],
        expires_at=payload.get("expires_at"),
    )


@router.post(
    "/contents",
    response_model=ContentResponse,
    status_code=201,
    summary="Create educational content (auto-approved)",
)
async def create_content(
    payload: ContentCreate,
    current_user: CurrentUser,
    svc: NurseContentServiceDep,
) -> ContentResponse:
    content = await svc.create_content(current_user.id, payload)
    return ContentResponse.model_validate(content)


@router.get(
    "/contents",
    response_model=list[ContentResponse],
    summary="List ALL educational content (admin)",
)
async def list_all_content(
    current_user: CurrentUser,
    svc: NurseContentServiceDep,
    category: str | None = Query(None),
    content_type: str | None = Query(None, pattern="^(article|video|image)$"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[ContentResponse]:
    contents = await svc.list_all_content(
        category=category, content_type=content_type, limit=limit, offset=offset
    )
    return [ContentResponse.model_validate(c) for c in contents]


@router.put(
    "/contents/{content_id}",
    response_model=ContentResponse,
    summary="Update educational content (admin)",
)
async def update_content(
    content_id: uuid.UUID,
    payload: ContentUpdate,
    current_user: CurrentUser,
    svc: NurseContentServiceDep,
) -> ContentResponse:
    content = await svc.update_content(content_id, current_user.id, payload)
    return ContentResponse.model_validate(content)


@router.delete(
    "/contents/{content_id}",
    response_model=None,
    status_code=204,
    summary="Delete educational content (admin)",
)
async def delete_content(
    content_id: uuid.UUID,
    current_user: CurrentUser,
    svc: NurseContentServiceDep,
) -> None:
    await svc.delete_content(content_id, current_user.id)
    return None


@public_router.get(
    "",
    response_model=list[ContentResponse],
    summary="List approved educational content (public)",
)
async def list_approved_content(
    svc: NurseContentServiceDep,
    category: str | None = Query(None),
    content_type: str | None = Query(None, pattern="^(article|video|image)$"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[ContentResponse]:
    contents = await svc.list_approved(
        category=category, content_type=content_type, limit=limit, offset=offset
    )
    return [ContentResponse.model_validate(c) for c in contents]


@public_router.get(
    "/{content_id}",
    response_model=ContentResponse,
    summary="Get a single approved content item (public)",
)
async def get_public_content(
    content_id: uuid.UUID,
    svc: NurseContentServiceDep,
) -> ContentResponse:
    content = await svc.get_content(content_id)
    return ContentResponse.model_validate(content)


def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")
    app.include_router(public_router, prefix="/api/v1")