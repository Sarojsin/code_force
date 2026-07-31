"""Diary HTTP routes (backend_rules §1.2: thin routes — parse, delegate, respond)."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, status

from app.modules.auth.dependencies import CurrentUser
from app.modules.diary.dependencies import DiaryServiceDep
from app.modules.diary.schemas import (
    DiaryCreate,
    DiaryResponse,
    DiaryUpdate,
    DiaryPageCreate,
    DiaryPageResponse,
    DiaryPageUpdate,
    DiaryPageObjectCreate,
    DiaryPageObjectResponse,
    DiaryPageObjectUpdate,
    DiaryMediaCreate,
    DiaryMediaResponse,
    PageOperationBatch,
)

router = APIRouter(prefix="/diary", tags=["diary"])


# ─── Diary ───────────────────────────────────────────────────────────────

@router.post("/diaries", response_model=DiaryResponse, status_code=status.HTTP_201_CREATED)
async def create_diary(
    payload: DiaryCreate,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> DiaryResponse:
    diary = await svc.create_diary(
        current_user.id,
        title=payload.title,
        cover_color=payload.cover_color,
        texture_id=payload.texture_id,
        font_id=payload.font_id,
    )
    return DiaryResponse.model_validate(diary)


@router.get("/diaries", response_model=list[DiaryResponse])
async def list_diaries(
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> list[DiaryResponse]:
    diaries = await svc.list_diaries(current_user.id)
    return [DiaryResponse.model_validate(d) for d in diaries]


@router.get("/diaries/{diary_id}", response_model=DiaryResponse)
async def get_diary(
    diary_id: uuid.UUID,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> DiaryResponse:
    diary = await svc.get_diary(diary_id, current_user.id)
    return DiaryResponse.model_validate(diary)


@router.patch("/diaries/{diary_id}", response_model=DiaryResponse)
async def update_diary(
    diary_id: uuid.UUID,
    payload: DiaryUpdate,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> DiaryResponse:
    updates = payload.model_dump(exclude_unset=True)
    diary = await svc.update_diary(diary_id, current_user.id, updates)
    return DiaryResponse.model_validate(diary)


@router.delete("/diaries/{diary_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_diary(
    diary_id: uuid.UUID,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> None:
    await svc.delete_diary(diary_id, current_user.id)


# ─── Pages ───────────────────────────────────────────────────────────────

@router.post("/diaries/{diary_id}/pages", response_model=DiaryPageResponse, status_code=status.HTTP_201_CREATED)
async def create_page(
    diary_id: uuid.UUID,
    payload: DiaryPageCreate,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> DiaryPageResponse:
    page = await svc.create_page(
        diary_id, current_user.id,
        page_date=payload.page_date,
        memory_title=payload.memory_title,
        memory_tags=payload.memory_tags,
        memory_people=payload.memory_people,
        memory_location=payload.memory_location,
        memory_weather=payload.memory_weather,
        memory_mood=payload.memory_mood,
    )
    return DiaryPageResponse.model_validate(page)


@router.get("/diaries/{diary_id}/pages", response_model=list[DiaryPageResponse])
async def list_pages(
    diary_id: uuid.UUID,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[DiaryPageResponse]:
    pages = await svc.list_pages(diary_id, current_user.id, limit=limit, offset=offset)
    return [DiaryPageResponse.model_validate(p) for p in pages]


@router.get("/diaries/{diary_id}/pages/{page_id}", response_model=DiaryPageResponse)
async def get_page(
    diary_id: uuid.UUID,
    page_id: uuid.UUID,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> DiaryPageResponse:
    page = await svc.get_page(page_id, current_user.id)
    return DiaryPageResponse.model_validate(page)


@router.patch("/diaries/{diary_id}/pages/{page_id}", response_model=DiaryPageResponse)
async def update_page(
    diary_id: uuid.UUID,
    page_id: uuid.UUID,
    payload: DiaryPageUpdate,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> DiaryPageResponse:
    updates = payload.model_dump(exclude_unset=True)
    page = await svc.update_page(page_id, current_user.id, updates)
    return DiaryPageResponse.model_validate(page)


@router.delete("/diaries/{diary_id}/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_page(
    diary_id: uuid.UUID,
    page_id: uuid.UUID,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> None:
    await svc.delete_page(page_id, current_user.id)


# ─── Objects ─────────────────────────────────────────────────────────────

@router.post("/pages/{page_id}/objects", response_model=DiaryPageObjectResponse, status_code=status.HTTP_201_CREATED)
async def create_object(
    page_id: uuid.UUID,
    payload: DiaryPageObjectCreate,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> DiaryPageObjectResponse:
    obj = await svc.create_object(page_id, current_user.id, payload.model_dump())
    return DiaryPageObjectResponse.model_validate(obj)


@router.put("/pages/{page_id}/objects/{obj_id}", response_model=DiaryPageObjectResponse)
async def update_object(
    page_id: uuid.UUID,
    obj_id: uuid.UUID,
    payload: DiaryPageObjectUpdate,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> DiaryPageObjectResponse:
    updates = payload.model_dump(exclude_unset=True)
    obj = await svc.update_object(obj_id, page_id, current_user.id, updates)
    return DiaryPageObjectResponse.model_validate(obj)


@router.delete("/pages/{page_id}/objects/{obj_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_object(
    page_id: uuid.UUID,
    obj_id: uuid.UUID,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> None:
    await svc.delete_object(obj_id, page_id, current_user.id)


# ─── Operations ──────────────────────────────────────────────────────────

@router.post("/pages/{page_id}/operations", response_model=DiaryPageResponse)
async def submit_operations(
    page_id: uuid.UUID,
    payload: PageOperationBatch,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> DiaryPageResponse:
    ops = [op.model_dump() for op in payload.operations]
    page = await svc.apply_operations(page_id, current_user.id, ops)
    return DiaryPageResponse.model_validate(page)


# ─── Media ───────────────────────────────────────────────────────────────

@router.post("/media", response_model=DiaryMediaResponse, status_code=status.HTTP_201_CREATED)
async def create_media(
    payload: DiaryMediaCreate,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> DiaryMediaResponse:
    media = await svc.create_media(
        current_user.id,
        media_type=payload.media_type,
        file_size_bytes=payload.file_size_bytes,
        mime_type=payload.mime_type,
        local_file_path=payload.local_file_path,
    )
    return DiaryMediaResponse.model_validate(media)


@router.patch("/media/{media_id}", response_model=DiaryMediaResponse)
async def update_media(
    media_id: uuid.UUID,
    payload: dict,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> DiaryMediaResponse:
    media = await svc.update_media(media_id, current_user.id, payload)
    return DiaryMediaResponse.model_validate(media)


@router.get("/media/{media_id}", response_model=DiaryMediaResponse)
async def get_media(
    media_id: uuid.UUID,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> DiaryMediaResponse:
    media = await svc.get_media(media_id, current_user.id)
    return DiaryMediaResponse.model_validate(media)


@router.get("/media/{media_id}/upload-url")
async def get_media_upload_url(
    media_id: uuid.UUID,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> dict:
    return await svc.get_presigned_upload_url(
        current_user.id, media_id,
        content_type="application/octet-stream",
    )


@router.delete("/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_media(
    media_id: uuid.UUID,
    current_user: CurrentUser,
    svc: DiaryServiceDep,
) -> None:
    await svc.delete_media(media_id, current_user.id)


# ─── Search & Timeline ───────────────────────────────────────────────────

@router.get("/search", response_model=list[DiaryPageResponse])
async def search_pages(
    current_user: CurrentUser,
    svc: DiaryServiceDep,
    q: str | None = Query(None),
    date: date | None = Query(None),
    tag: str | None = Query(None),
    person: str | None = Query(None),
    location: str | None = Query(None),
    weather: str | None = Query(None),
    mood: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[DiaryPageResponse]:
    pages = await svc.search(
        current_user.id, q=q, date=date, tag=tag, person=person,
        location=location, weather=weather, mood=mood,
        limit=limit, offset=offset,
    )
    return [DiaryPageResponse.model_validate(p) for p in pages]


@router.get("/timeline")
async def get_timeline(
    current_user: CurrentUser,
    svc: DiaryServiceDep,
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
) -> list[dict]:
    return await svc.get_timeline(current_user.id, year=year, month=month)


# ─── Module Registration ────────────────────────────────────────────────

def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")
