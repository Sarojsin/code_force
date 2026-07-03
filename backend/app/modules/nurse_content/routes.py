"""Nurse content HTTP routes (plan 13).

Endpoints:
  POST   /api/v1/nurse/contents
  GET    /api/v1/nurse/contents
  PUT    /api/v1/nurse/contents/{content_id}
  DELETE /api/v1/nurse/contents/{content_id}
  GET    /api/v1/contents (public)
  GET    /api/v1/contents/{content_id} (public)
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Query

from app.modules.auth.dependencies import CurrentUser
from app.modules.nurse_content.dependencies import NurseContentServiceDep
from app.modules.nurse_content.schemas import (
    ContentCreate,
    ContentResponse,
    ContentUpdate,
)

router = APIRouter(prefix="/nurse", tags=["nurse"])
public_router = APIRouter(prefix="/contents", tags=["content"])


@router.post(
    "/contents",
    response_model=ContentResponse,
    status_code=201,
    summary="Upload content metadata",
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
    summary="List own content",
)
async def list_own_content(
    current_user: CurrentUser,
    svc: NurseContentServiceDep,
) -> list[ContentResponse]:
    contents = await svc.list_own_content(current_user.id)
    return [ContentResponse.model_validate(c) for c in contents]


@router.put(
    "/contents/{content_id}",
    response_model=ContentResponse,
    summary="Update own content",
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
    summary="Delete own content",
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
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[ContentResponse]:
    contents = await svc.list_approved(category=category, limit=limit, offset=offset)
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
