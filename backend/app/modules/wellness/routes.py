"""Wellness HTTP routes (backend_rules.md §2.2: thin routes).

Endpoints:
  POST   /api/v1/wellness/journal
  GET    /api/v1/wellness/journal
  GET    /api/v1/wellness/journal/{entry_id}
  DELETE /api/v1/wellness/journal/{entry_id}
  POST   /api/v1/wellness/mood
  GET    /api/v1/wellness/mood/history
  GET    /api/v1/wellness/breathing-exercises
  POST   /api/v1/wellness/breathing-sessions/{exercise_id}/complete
  GET    /api/v1/wellness/insights
  POST   /api/v1/wellness/journal/analysis
  GET    /api/v1/wellness/journal/{entry_id}/analysis
  GET    /api/v1/models/wellness-classifier/version
  GET    /api/v1/models/wellness-classifier/{version}.onnx
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse, Response

from app.core.config import get_settings
from app.core.database import get_db
from app.modules.auth.dependencies import CurrentUser
from app.modules.wellness.dependencies import WellnessServiceDep
from app.modules.wellness.schemas import (
    BreathingExerciseResponse,
    ExerciseSessionResponse,
    InsightResponse,
    JournalAnalysisCreate,
    JournalAnalysisResponse,
    JournalEntryCreate,
    JournalEntryMetadata,
    JournalEntryResponse,
    ModelVersionResponse,
    MoodLogCreate,
    MoodLogResponse,
)
from app.modules.wellness.services import JournalAnalysisService

router = APIRouter(prefix="/wellness", tags=["wellness"])
model_router = APIRouter(prefix="/models", tags=["models"])


@router.post(
    "/journal",
    response_model=JournalEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a journal entry (triggers async sentiment analysis)",
)
async def create_journal_entry(
    payload: JournalEntryCreate,
    current_user: CurrentUser,
    svc: WellnessServiceDep,
) -> JournalEntryResponse:
    user_salt = current_user.encryption_key_salt
    entry = await svc.create_journal_entry(current_user.id, payload, user_salt)
    return JournalEntryResponse.model_validate(entry)


@router.get(
    "/journal",
    response_model=list[JournalEntryMetadata],
    summary="List journal entries (metadata only)",
)
async def list_journal_entries(
    current_user: CurrentUser,
    svc: WellnessServiceDep,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[JournalEntryMetadata]:
    entries = await svc.list_journal_entries(current_user.id, limit=limit, offset=offset)
    return [JournalEntryMetadata.model_validate(e) for e in entries]


@router.get(
    "/journal/{entry_id}",
    response_model=JournalEntryResponse,
    summary="Get a single journal entry",
)
async def get_journal_entry(
    entry_id: uuid.UUID,
    current_user: CurrentUser,
    svc: WellnessServiceDep,
) -> JournalEntryResponse:
    entry = await svc.get_journal_entry(entry_id, current_user.id)
    return JournalEntryResponse.model_validate(entry)


@router.delete(
    "/journal/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a journal entry",
)
async def delete_journal_entry(
    entry_id: uuid.UUID,
    current_user: CurrentUser,
    svc: WellnessServiceDep,
) -> None:
    await svc.delete_journal_entry(entry_id, current_user.id)
    return None


@router.post(
    "/mood",
    response_model=MoodLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a mood entry",
)
async def log_mood(
    payload: MoodLogCreate,
    current_user: CurrentUser,
    svc: WellnessServiceDep,
) -> MoodLogResponse:
    mood = await svc.log_mood(current_user.id, payload)
    return MoodLogResponse.model_validate(mood)


@router.get(
    "/mood/history",
    response_model=list[MoodLogResponse],
    summary="Mood history with optional date range",
)
async def mood_history(
    current_user: CurrentUser,
    svc: WellnessServiceDep,
    days_back: int = Query(30, ge=1, le=365),
) -> list[MoodLogResponse]:
    logs = await svc.list_mood_history(current_user.id, days_back=days_back)
    return [MoodLogResponse.model_validate(log) for log in logs]


@router.get(
    "/breathing-exercises",
    response_model=list[BreathingExerciseResponse],
    summary="List all breathing exercises",
)
async def list_exercises(
    svc: WellnessServiceDep,
) -> list[BreathingExerciseResponse]:
    exercises = await svc.list_exercises()
    return [BreathingExerciseResponse.model_validate(e) for e in exercises]


@router.post(
    "/breathing-sessions/{exercise_id}/complete",
    response_model=ExerciseSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a completed breathing exercise session",
)
async def complete_exercise(
    exercise_id: uuid.UUID,
    current_user: CurrentUser,
    svc: WellnessServiceDep,
) -> ExerciseSessionResponse:
    session = await svc.log_exercise_completion(current_user.id, exercise_id)
    return ExerciseSessionResponse.model_validate(session)


@router.get(
    "/insights",
    response_model=InsightResponse,
    summary="Weekly wellness insights and recommendations",
)
async def get_insights(
    current_user: CurrentUser,
    svc: WellnessServiceDep,
) -> InsightResponse:
    data = await svc.get_insights(current_user.id)
    return InsightResponse(**data)


@router.post(
    "/journal/analysis",
    response_model=JournalAnalysisResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Sync on-device analysis result for a journal entry",
)
async def sync_journal_analysis(
    payload: JournalAnalysisCreate,
    current_user: CurrentUser,
    db=Depends(get_db),
) -> JournalAnalysisResponse:
    svc = JournalAnalysisService(db=db)
    analysis = await svc.create_analysis(current_user.id, payload)
    return JournalAnalysisResponse.model_validate(analysis)


@router.get(
    "/journal/{entry_id}/analysis",
    response_model=JournalAnalysisResponse | None,
    summary="Get analysis for a journal entry",
)
async def get_journal_analysis(
    entry_id: uuid.UUID,
    current_user: CurrentUser,
    db=Depends(get_db),
) -> JournalAnalysisResponse | None:
    svc = JournalAnalysisService(db=db)
    analysis = await svc.get_analysis(entry_id, current_user.id)
    if analysis is None:
        return None
    return JournalAnalysisResponse.model_validate(analysis)


@model_router.get(
    "/wellness-classifier/version",
    response_model=ModelVersionResponse,
    summary="Get current model version metadata",
)
async def get_model_version() -> ModelVersionResponse:
    settings = get_settings()
    return ModelVersionResponse(
        version=settings.wellness_model.version,
        size_mb=0,
        checksum_sha256=settings.wellness_model.checksum_sha256,
    )


@model_router.get(
    "/wellness-classifier/{version}.onnx",
    summary="Download model binary by version (supports Range requests for resumable download)",
)
async def download_model(
    version: str,
    request: Request,
    current_user: CurrentUser,
) -> Response:
    settings = get_settings()
    if version != settings.wellness_model.version:
        raise HTTPException(status_code=404, detail="Model version not found")
    model_path = Path(settings.wellness_model.model_dir) / settings.wellness_model.onnx_filename
    if not model_path.exists():
        raise HTTPException(status_code=404, detail="Model file not found")

    file_size = os.path.getsize(model_path)
    range_header = request.headers.get("range")

    if range_header:
        start_str = range_header.strip().lower().replace("bytes=", "")
        start = int(start_str.split("-")[0]) if start_str else 0
        end = int(start_str.split("-")[1]) if "-" in start_str and start_str.split("-")[1] else file_size - 1
        if start >= file_size:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})
        content_length = end - start + 1
        with open(model_path, "rb") as f:
            f.seek(start)
            body = f.read(content_length)
        return Response(
            content=body,
            status_code=206,
            media_type="application/octet-stream",
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Content-Length": str(content_length),
                "Accept-Ranges": "bytes",
                "Content-Disposition": f'attachment; filename="{model_path.name}"',
            },
        )

    return FileResponse(
        path=model_path,
        media_type="application/octet-stream",
        filename=model_path.name,
        headers={"Accept-Ranges": "bytes"},
    )


def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")
    app.include_router(model_router, prefix="/api/v1")
