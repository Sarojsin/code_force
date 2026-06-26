"""Cycle tracking HTTP routes (backend_rules.md §2.2: thin routes).

Phase 2 additions:
  GET /api/v1/cycle/calendar       dictionary-encoded calendar
  GET /api/v1/cycle/predictions    extended PredictionDetail
  GET /api/v1/models/status        versioned model info
  GET /api/v1/models/download/...  versioned model file
"""

from __future__ import annotations

import hashlib
import os
import uuid

from fastapi import APIRouter, Header, HTTPException, Query, Response, status
from fastapi.responses import FileResponse

from app.modules.auth.dependencies import CurrentUser
from app.modules.cycle.dependencies import CycleServiceDep
from app.modules.cycle.schemas import (
    AnalyticsResponse,
    CalendarResponse,
    CorrectionCreate,
    CorrectionResponse,
    CycleEntryCreate,
    CycleEntryResponse,
    CycleEntryUpdate,
    ModelStatusResponse,
    PredictionDetail,
    PredictionListResponse,
    SnoozeCreate,
    SnoozeResponse,
)

router = APIRouter(prefix="/cycle", tags=["cycle"])

STORAGE_DIR = "/storage/models"
PROD_DIR = os.path.join(STORAGE_DIR, "prod")


@router.post(
    "/entries",
    response_model=CycleEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a period entry",
)
async def create_entry(
    payload: CycleEntryCreate,
    current_user: CurrentUser,
    svc: CycleServiceDep,
) -> CycleEntryResponse:
    entry = await svc.create_entry(current_user.id, payload)
    return CycleEntryResponse.model_validate(entry)


@router.get(
    "/entries",
    response_model=list[CycleEntryResponse],
    summary="List period entries (paginated, last 6 months by default)",
)
async def list_entries(
    current_user: CurrentUser,
    svc: CycleServiceDep,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    months_back: int = Query(6, ge=1, le=36),
) -> list[CycleEntryResponse]:
    entries = await svc.list_entries(current_user.id, limit=limit, offset=offset, months_back=months_back)
    return [CycleEntryResponse.model_validate(e) for e in entries]


@router.get(
    "/entries/{entry_id}",
    response_model=CycleEntryResponse,
    summary="Get a single period entry",
)
async def get_entry(
    entry_id: uuid.UUID,
    current_user: CurrentUser,
    svc: CycleServiceDep,
) -> CycleEntryResponse:
    entry = await svc.get_entry(entry_id, current_user.id)
    return CycleEntryResponse.model_validate(entry)


@router.put(
    "/entries/{entry_id}",
    response_model=CycleEntryResponse,
    summary="Update a period entry",
)
async def update_entry(
    entry_id: uuid.UUID,
    payload: CycleEntryUpdate,
    current_user: CurrentUser,
    svc: CycleServiceDep,
) -> CycleEntryResponse:
    entry = await svc.update_entry(entry_id, current_user.id, payload)
    return CycleEntryResponse.model_validate(entry)


@router.delete(
    "/entries/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete a period entry",
)
async def delete_entry(
    entry_id: uuid.UUID,
    current_user: CurrentUser,
    svc: CycleServiceDep,
) -> None:
    await svc.delete_entry(entry_id, current_user.id)


@router.get(
    "/predictions",
    response_model=PredictionListResponse,
    summary="Get next 3 predicted cycles",
)
async def get_predictions(
    current_user: CurrentUser,
    svc: CycleServiceDep,
) -> PredictionListResponse:
    predictions = await svc.get_predictions(current_user.id)
    details = [
        PredictionDetail(
            id=p.id,
            predicted_next_period_start=p.predicted_next_period_start,
            predicted_period_end=p.predicted_next_period_start + __import__("datetime").timedelta(days=5),
            predicted_fertile_window_start=p.predicted_fertile_window_start,
            predicted_fertile_window_end=p.predicted_fertile_window_end,
            model_type=p.model_type or p.model_version or "unknown",
            confidence_score=p.confidence_score,
            confidence_label=(
                _confidence_label(p.confidence_score)
                if p.confidence_score is not None else None
            ),
            training_data_points=p.training_data_points or 0,
            prediction_window_days=p.prediction_window_days,
        )
        for p in predictions
    ]

    data_quality = "minimal"
    if predictions and predictions[0].training_data_points:
        n = predictions[0].training_data_points
        if n < 3:
            data_quality = "insufficient"
        elif n < 6:
            data_quality = "minimal"
        elif n < 10:
            data_quality = "good"
        else:
            data_quality = "excellent"

    if predictions:
        model_used = predictions[0].model_type or predictions[0].model_version or "unknown"
    else:
        model_used = "unknown"

    return PredictionListResponse(
        predictions=details,
        model_used=model_used,
        data_quality=data_quality,
    )


def _confidence_label(score: float) -> str:
    if score < 0.31:
        return "Very uncertain"
    if score < 0.51:
        return "Uncertain"
    if score < 0.71:
        return "Fair"
    if score < 0.85:
        return "Good"
    return "Excellent"


@router.get(
    "/analytics",
    response_model=AnalyticsResponse,
    summary="Cycle analytics: average length, common symptoms, mood trends",
)
async def get_analytics(
    current_user: CurrentUser,
    svc: CycleServiceDep,
) -> AnalyticsResponse:
    data = await svc.get_analytics(current_user.id)
    return AnalyticsResponse(**data)


@router.post(
    "/corrections",
    response_model=CorrectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a correction (period start) that may link to a prediction",
)
async def create_correction(
    payload: CorrectionCreate,
    current_user: CurrentUser,
    svc: CycleServiceDep,
) -> CorrectionResponse:
    import uuid as _uuid
    corrected_id = _uuid.UUID(payload.corrected_prediction_id) if payload.corrected_prediction_id else None
    entry = await svc.log_correction(
        user_id=current_user.id,
        period_start_date=payload.period_start_date,
        period_end_date=payload.period_end_date,
        symptoms=payload.symptoms,
        corrected_prediction_id=corrected_id,
    )
    return CorrectionResponse.model_validate(entry)


@router.post(
    "/snooze",
    response_model=SnoozeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a 'Not yet' event for a prediction",
)
async def create_snooze(
    payload: SnoozeCreate,
    current_user: CurrentUser,
    svc: CycleServiceDep,
) -> SnoozeResponse:
    import uuid as _uuid
    snooze = await svc.log_snooze(
        user_id=current_user.id,
        predicted_cycle_id=_uuid.UUID(payload.predicted_cycle_id),
        day_offset=payload.day_offset,
    )
    return SnoozeResponse.model_validate(snooze)


# ---- Phase 2: Calendar ----

@router.get(
    "/calendar",
    response_model=CalendarResponse,
    summary="Get calendar days (dictionary-encoded, ~70% smaller payload)",
)
async def get_calendar(
    current_user: CurrentUser,
    svc: CycleServiceDep,
    months_back: int = Query(3, ge=1, le=12),
    months_forward: int = Query(3, ge=1, le=12),
    if_none_match: str | None = Header(None, alias="If-None-Match"),
) -> Response:
    data = await svc.get_calendar(current_user.id, months_back=months_back, months_forward=months_forward)
    cal = CalendarResponse(**data)
    body = cal.model_dump_json().encode()
    etag = hashlib.sha256(body).hexdigest()
    if if_none_match and if_none_match.strip('"') == etag:
        return Response(status_code=304)
    return Response(
        content=body,
        media_type="application/json",
        headers={"ETag": f'"{etag}"'},
    )


# ---- Phase 2: Model status & download ----

@router.get(
    "/models/status",
    response_model=ModelStatusResponse,
    summary="Get active global model version and download URL",
    tags=["models"],
)
async def get_model_status(
    current_user: CurrentUser,
) -> ModelStatusResponse:
    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.modules.cycle.models import SystemConfig

    async with AsyncSessionLocal() as session:
        version_stmt = select(SystemConfig.value).where(SystemConfig.key == "global_model_version")
        path_stmt = select(SystemConfig.value).where(SystemConfig.key == "global_model_path")
        version = (await session.execute(version_stmt)).scalar_one_or_none()
        path = (await session.execute(path_stmt)).scalar_one_or_none()

    version_num = int(version) if version else 0
    filename = path or "fallback_model.json"
    return ModelStatusResponse(
        current_version=version_num,
        download_url=f"/api/v1/cycle/models/download/{filename}",
    )


@router.get(
    "/models/download/{filename:path}",
    summary="Download a specific versioned global model file",
    tags=["models"],
)
async def download_model(
    filename: str,
    current_user: CurrentUser,
) -> FileResponse:
    filepath = os.path.join(PROD_DIR, filename)
    if not os.path.exists(filepath) or ".." in filename:
        raise HTTPException(status_code=404, detail="Model file not found")
    return FileResponse(filepath, media_type="application/json", filename=filename)


# ---- Module initialisation ----

def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")

    async def _on_onboarding_completed(user_id: str) -> None:
        import uuid

        from app.core.database import AsyncSessionLocal
        from app.modules.cycle.services import CycleService

        async with AsyncSessionLocal() as session:
            svc = CycleService(session)
            try:
                await svc.compute_initial_prediction(uuid.UUID(user_id))
            except Exception:
                import logging
                logging.getLogger(__name__).warning(
                    "cycle.initial_prediction_failed",
                    extra={"user_id": user_id},
                )

    event_bus.subscribe_sync("onboarding_completed", _on_onboarding_completed)
