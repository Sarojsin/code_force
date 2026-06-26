from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Query

from app.modules.auth.dependencies import CurrentUser
from app.modules.sync.dependencies import SyncServiceDep
from app.modules.sync.schemas import SyncBatchRequest, SyncBatchResponse, SyncChangesResponse

router = APIRouter(prefix="/sync", tags=["sync"])


@router.post(
    "/batch",
    response_model=SyncBatchResponse,
    summary="Push a batch of offline operations",
)
async def sync_batch(
    payload: SyncBatchRequest,
    current_user: CurrentUser,
    svc: SyncServiceDep,
) -> SyncBatchResponse:
    return await svc.push_batch(current_user.id, payload)


@router.get(
    "/changes",
    response_model=SyncChangesResponse,
    summary="Pull server changes since a timestamp",
)
async def sync_changes(
    current_user: CurrentUser,
    svc: SyncServiceDep,
    since: str | None = Query(None, description="ISO-8601 timestamp"),
    limit: int = Query(50, ge=1, le=200),
) -> SyncChangesResponse:
    since_dt: datetime | None = None
    if since:
        since_dt = datetime.fromisoformat(since)
    return await svc.pull_changes(current_user.id, since=since_dt, limit=limit)


def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")
