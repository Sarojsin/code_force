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
from datetime import date

from fastapi import APIRouter, Header, HTTPException, Query, Response, status
from fastapi.responses import FileResponse

from app.integrations.prediction_engine import PROD_DIR
from app.modules.auth.dependencies import CurrentUser
from app.modules.cycle.dependencies import CycleServiceDep
from app.modules.cycle.exceptions import CycleConflictError
from app.modules.cycle.schemas import (
    AnalyticsResponse,
    CalendarResponse,
    CorrectionCreate,
    CorrectionResponse,
    CycleEntryCreate,
    CycleEntryResponse,
    CycleEntryUpdate,
    CycleReportResponse,
    DayResponse,
    DayUpsert,
    MedicationResponse,
    ModelStatusResponse,
    NextPredictionResponse,
    PredictionDetail,
    PredictionHistoryResponse,
    ReportEmptyResponse,
    ReportGenerateRequest,
    SnoozeCreate,
    SnoozeResponse,
    SymptomResponse,
)

router = APIRouter(prefix="/cycle", tags=["cycle"])


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
    entries = await svc.list_entries(
        current_user.id, limit=limit, offset=offset, months_back=months_back
    )
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
    response_model=None,
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
    response_model=NextPredictionResponse,
    summary="Get next predicted cycle",
)
async def get_predictions(
    current_user: CurrentUser,
    svc: CycleServiceDep,
) -> NextPredictionResponse:
    prediction = await svc.get_predictions(current_user.id)

    data_quality: str = "insufficient"
    model_used: str = "unknown"
    detail: PredictionDetail | None = None
    days_until: int | None = None

    if prediction:
        n = prediction.training_data_points or 0
        if n < 3:
            data_quality = "insufficient"
        elif n < 6:
            data_quality = "minimal"
        elif n < 10:
            data_quality = "good"
        else:
            data_quality = "excellent"

        model_used = prediction.model_type or prediction.model_version or "unknown"
        today = __import__("datetime").date.today()
        days_until = max(0, (prediction.predicted_next_period_start - today).days)

        detail = PredictionDetail(
            id=prediction.id,
            predicted_next_period_start=prediction.predicted_next_period_start,
            predicted_period_end=prediction.predicted_next_period_start
            + __import__("datetime").timedelta(days=5),
            predicted_fertile_window_start=prediction.predicted_fertile_window_start,
            predicted_fertile_window_end=prediction.predicted_fertile_window_end,
            model_type=prediction.model_type or prediction.model_version or "unknown",
            confidence_score=prediction.confidence_score,
            confidence_label=(
                _confidence_label(prediction.confidence_score)
                if prediction.confidence_score is not None
                else None
            ),
            training_data_points=prediction.training_data_points or 0,
            prediction_window_days=prediction.prediction_window_days,
        )

    return NextPredictionResponse(
        prediction=detail,
        days_until=days_until,
        model_used=model_used,
        data_quality=data_quality,
    )


@router.get(
    "/predictions/history",
    response_model=PredictionHistoryResponse,
    summary="Get prediction history — past predicted vs actual dates",
)
async def get_prediction_history(
    current_user: CurrentUser,
    svc: CycleServiceDep,
    limit: int = Query(12, ge=1, le=50),
) -> PredictionHistoryResponse:
    items = await svc.get_prediction_history(current_user.id, limit=limit)
    return PredictionHistoryResponse(items=items)


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
    "/reports",
    response_model=CycleReportResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Enqueue cycle report generation for a closed cycle",
    responses={202: {"description": "Generation enqueued (returns report row)"}},
)
async def create_report(
    payload: ReportGenerateRequest,
    current_user: CurrentUser,
    svc: CycleServiceDep,
    sync: bool = Query(False, description="Generate synchronously (Groq) when no stored report exists"),
) -> CycleReportResponse:
    if sync:
        existing = await svc.get_report_for_entry(current_user.id, payload.cycle_entry_id)
        if existing is not None and existing.status == "ready" and existing.report_data:
            return CycleReportResponse.model_validate(existing)
        # No stored report for this cycle => generate now (Groq, fallback rule-based).
        report = await svc.generate_report(current_user.id, payload.cycle_entry_id)
        return CycleReportResponse.model_validate(report)

    from app.modules.cycle.tasks import generate_cycle_report

    generate_cycle_report.apply_async(
        kwargs={
            "user_id": str(current_user.id),
            "cycle_entry_id": str(payload.cycle_entry_id),
        },
        task_id=f"generate_cycle_report_{payload.cycle_entry_id}",
    )
    report = await svc.get_or_create_pending_report(current_user.id, payload.cycle_entry_id)
    return CycleReportResponse.model_validate(report)


@router.get(
    "/reports/latest",
    response_model=CycleReportResponse | ReportEmptyResponse,
    summary="Get the user's latest stored cycle report",
)
async def get_latest_report(
    current_user: CurrentUser,
    svc: CycleServiceDep,
) -> CycleReportResponse | ReportEmptyResponse:
    report = await svc.get_latest_report(current_user.id)
    if report is None:
        return ReportEmptyResponse()
    return CycleReportResponse.model_validate(report)


@router.get(
    "/reports/{cycle_entry_id}",
    response_model=CycleReportResponse | ReportEmptyResponse,
    summary="Get the stored report for one cycle (DB-only; no LLM invoked)",
)
async def get_report_for_entry(
    cycle_entry_id: uuid.UUID,
    current_user: CurrentUser,
    svc: CycleServiceDep,
) -> CycleReportResponse | ReportEmptyResponse:
    report = await svc.get_report_for_entry(current_user.id, cycle_entry_id)
    if report is None:
        return ReportEmptyResponse()
    return CycleReportResponse.model_validate(report)


@router.post(
    "/corrections",
    response_model=CorrectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a correction (period start) that may link to a prediction",
    responses={
        409: {
            "model": CorrectionResponse,
            "description": "Conflict — data modified since client last synced",
        }
    },
)
async def create_correction(
    payload: CorrectionCreate,
    current_user: CurrentUser,
    svc: CycleServiceDep,
    x_client_updated_at: str | None = Header(None, alias="X-Client-Updated-At"),
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
) -> CorrectionResponse:
    import uuid as _uuid

    corrected_id = (
        _uuid.UUID(payload.corrected_prediction_id) if payload.corrected_prediction_id else None
    )

    # Idempotency check (project invariant §5)
    if idempotency_key:
        existing = await svc.find_by_idempotency_key(current_user.id, idempotency_key)
        if existing:
            avg_period_length = await svc.get_avg_period_length(current_user.id)
            resp = CorrectionResponse.model_validate(existing)
            resp.avg_period_length = avg_period_length
            return resp

    try:
        entry = await svc.log_correction(
            user_id=current_user.id,
            period_start_date=payload.period_start_date,
            period_end_date=payload.period_end_date,
            symptoms=payload.symptoms,
            corrected_prediction_id=corrected_id,
            client_updated_at=x_client_updated_at,
            cycle_type=payload.cycle_type,
            idempotency_key=idempotency_key,
        )
    except CycleConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.details) from e
    avg_period_length = await svc.get_avg_period_length(current_user.id)
    resp = CorrectionResponse.model_validate(entry)
    resp.avg_period_length = avg_period_length
    return resp


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
    today: str | None = Query(
        None,
        description="Client-local date (YYYY-MM-DD) anchoring the today marker and check-in window",
    ),
    if_none_match: str | None = Header(None, alias="If-None-Match"),
) -> Response:
    today_ref: date | None = None
    if today:
        try:
            today_ref = date.fromisoformat(today)
        except ValueError:
            today_ref = None
    data = await svc.get_calendar(
        current_user.id,
        months_back=months_back,
        months_forward=months_forward,
        today=today_ref,
    )
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
    if ".." in filename:
        raise HTTPException(status_code=404, detail="Model file not found")
    filepath = os.path.join(PROD_DIR, filename)
    if os.path.exists(filepath):
        return FileResponse(filepath, media_type="application/json", filename=filename)

    # Config/artifact drift: a client may request a stale version. Fall back to
    # the configured current model path, then to the newest artifact on disk.
    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal
    from app.modules.cycle.models import SystemConfig

    async with AsyncSessionLocal() as session:
        stmt = select(SystemConfig.value).where(SystemConfig.key == "global_model_path")
        resolved = (await session.execute(stmt)).scalar_one_or_none()
    candidates = [resolved] if resolved else []
    try:
        artifacts = sorted(
            (f for f in os.listdir(PROD_DIR) if f.startswith("global_model_") and f.endswith(".json")),
            reverse=True,
        )
        candidates.extend(artifacts)
    except OSError:
        pass
    for candidate in candidates:
        if not candidate or ".." in candidate:
            continue
        fallback = os.path.join(PROD_DIR, candidate)
        if os.path.exists(fallback):
            return FileResponse(fallback, media_type="application/json", filename=candidate)
    raise HTTPException(status_code=404, detail="Model file not found")


# ---- Day observations (cycle_days) ----


@router.put(
    "/days/{log_date}",
    response_model=DayResponse,
    status_code=status.HTTP_200_OK,
    summary="Upsert a day's observations (mood, symptoms, pain, sleep, water, meds)",
)
async def upsert_day(
    log_date: date,
    payload: DayUpsert,
    current_user: CurrentUser,
    svc: CycleServiceDep,
) -> DayResponse:
    day = await svc.upsert_day(
        current_user.id,
        log_date,
        payload,
        current_user.encryption_key_salt,
    )
    return DayResponse.from_day(day, list(day.day_symptoms), list(day.day_medications))


@router.get(
    "/days",
    response_model=list[DayResponse],
    summary="List day observations within a date range",
)
async def list_days(
    current_user: CurrentUser,
    svc: CycleServiceDep,
    start: date = Query(...),
    end: date = Query(...),
) -> list[DayResponse]:
    days = await svc.list_days(current_user.id, start, end, current_user.encryption_key_salt)
    return [
        DayResponse.from_day(day, list(day.day_symptoms), list(day.day_medications)) for day in days
    ]


@router.get(
    "/symptoms",
    response_model=list[SymptomResponse],
    summary="List active symptom master rows",
)
async def list_symptoms(svc: CycleServiceDep) -> list[SymptomResponse]:
    symptoms = await svc.list_symptoms()
    return [SymptomResponse.model_validate(s) for s in symptoms]


@router.get(
    "/medications",
    response_model=list[MedicationResponse],
    summary="List active medication master rows",
)
async def list_medications(svc: CycleServiceDep) -> list[MedicationResponse]:
    medications = await svc.list_medications()
    return [MedicationResponse.model_validate(m) for m in medications]


# ---- Module initialisation ----


def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")

    @app.on_event("startup")
    async def _seed_day_masters_on_startup() -> None:
        import logging

        from app.core.database import AsyncSessionLocal
        from app.modules.cycle.seed import seed_day_masters

        try:
            async with AsyncSessionLocal() as session:
                await seed_day_masters(session)
        except Exception:
            logging.getLogger("app.modules.cycle").warning(
                "cycle.day_masters_seed_failed",
            )

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

    async def _on_cycle_closed(user_id: str, cycle_entry_id: str) -> None:
        """Enqueue report generation when a cycle closes (RaaS plan)."""
        import logging

        from app.modules.cycle.tasks import generate_cycle_report

        logging.getLogger(__name__).info(
            "cycle.report_enqueued",
            extra={"user_id": user_id, "cycle_entry_id": cycle_entry_id},
        )
        generate_cycle_report.apply_async(
            kwargs={"user_id": user_id, "cycle_entry_id": cycle_entry_id},
            task_id=f"generate_cycle_report_{cycle_entry_id}",
        )

    event_bus.subscribe_sync("onboarding_completed", _on_onboarding_completed)
    event_bus.subscribe_sync("cycle_closed", _on_cycle_closed)
