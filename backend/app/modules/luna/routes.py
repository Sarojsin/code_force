"""Luna HTTP routes — asset serving + aggregate state sync endpoints."""

from __future__ import annotations

import hashlib
from pathlib import Path

from fastapi import APIRouter, FastAPI, Header, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.event_bus import EventBus
from app.core.rate_limit import RateLimiterDep
from app.modules.auth.dependencies import CurrentUser
from app.modules.luna.dependencies import LunaServiceDep
from app.modules.luna.schemas import LunaStateResponse, LunaStateUpdate

router = APIRouter(prefix="/features/luna", tags=["luna"])
state_router = APIRouter(prefix="/luna", tags=["luna"])

ASSETS_DIR = Path(__file__).resolve().parent / "assets"

STATE_RATE_LIMIT = 100
STATE_RATE_WINDOW_SECONDS = 60


class LunaAssetMetadata(BaseModel):
    version: str = "2.0.0"
    size_mb: float = 2.6
    checksum_sha256: str = "7f4a80e766cb0337e58fb511439b1b1c1c47345201e790411932459141fe3aa5"
    download_url: str = "/api/v1/features/luna/assets/luna_assets_v2.0.0.zip"


@router.get("/metadata", response_model=LunaAssetMetadata)
async def get_luna_metadata() -> LunaAssetMetadata:
    return LunaAssetMetadata()


@router.get("/assets/{filename}")
async def serve_asset(filename: str) -> FileResponse:
    asset_path = ASSETS_DIR / filename
    if not asset_path.is_file():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Asset not found")
    return FileResponse(str(asset_path), media_type="application/zip")


@state_router.get("/state")
async def get_luna_state(
    current_user: CurrentUser,
    svc: LunaServiceDep,
    rate_limiter: RateLimiterDep,
    if_none_match: str | None = Header(None, alias="If-None-Match"),
) -> Response:
    """Return aggregate state with an ETag for cheap offline revalidation.

    Pattern mirrors ``cycle/routes.py:get_calendar`` (AGENTS.md §3.7): strong
    ETag = SHA-256 of the serialized body; a matching ``If-None-Match`` yields
    a 304 so the mobile client can serve its cached copy.
    """
    await rate_limiter.check(f"luna:state:{current_user.id}", STATE_RATE_LIMIT, STATE_RATE_WINDOW_SECONDS)
    state = await svc.get_state(current_user.id)
    body = LunaStateResponse.model_validate(state).model_dump_json().encode()
    etag = hashlib.sha256(body).hexdigest()
    if if_none_match and if_none_match.strip('"') == etag:
        return Response(status_code=304)
    return Response(
        content=body,
        media_type="application/json",
        headers={"ETag": f'"{etag}"'},
    )


@state_router.put("/state", response_model=LunaStateResponse)
async def put_luna_state(
    payload: LunaStateUpdate,
    current_user: CurrentUser,
    svc: LunaServiceDep,
    rate_limiter: RateLimiterDep,
) -> LunaStateResponse:
    await rate_limiter.check(f"luna:state:{current_user.id}", STATE_RATE_LIMIT, STATE_RATE_WINDOW_SECONDS)
    state = await svc.upsert_state(current_user.id, payload)
    return LunaStateResponse.model_validate(state)


def init_module(app: FastAPI, event_bus: EventBus) -> None:
    app.include_router(router, prefix="/api/v1")
    app.include_router(state_router, prefix="/api/v1")

    # ---- Bridge: cycle module emits `day_logged` when a day is saved ----
    # Subscriber lives in the subscriber's module (AGENTS.md §1.9). Idempotent:
    # dedupes by (date, source="day_logged") so replaying never double-counts.
    async def _on_day_logged(
        user_id: str,
        log_date: str,
        mood: str,
        mood_intensity: int | None = None,
        notes: str | None = None,  # bridge ignores notes
    ) -> None:
        import logging
        from uuid import UUID

        from app.core.database import AsyncSessionLocal
        from app.modules.luna.services import refresh_mood_trend_from_day_logged

        try:
            async with AsyncSessionLocal() as session:
                await refresh_mood_trend_from_day_logged(
                    session,
                    user_id=UUID(user_id),
                    log_date=log_date,
                    mood=mood,
                    mood_intensity=mood_intensity,
                )
        except Exception:
            logging.getLogger("app.modules.luna").exception(
                "luna.day_logged_subscriber",
            )

    if event_bus is not None:
        event_bus.subscribe_sync("day_logged", _on_day_logged)
