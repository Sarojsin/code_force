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
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status

from app.core.database import get_db
from app.modules.auth.dependencies import CurrentUser
from app.modules.wellness.dependencies import WellnessServiceDep
from app.modules.wellness.schemas import (
    BreathingExerciseResponse,
    ExerciseSessionResponse,
    HealthTipListResponse,
    HealthTipResponse,
    InsightResponse,
    JournalAnalysisCreate,
    JournalAnalysisResponse,
    JournalEntryCreate,
    JournalEntryMetadata,
    JournalEntryResponse,
    MoodLogCreate,
    MoodLogResponse,
)
from app.modules.wellness.services import JournalAnalysisService

router = APIRouter(prefix="/wellness", tags=["wellness"])


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
    entry = await svc.get_journal_entry(entry_id, current_user.id, current_user.encryption_key_salt)
    return JournalEntryResponse.model_validate(entry)


@router.delete(
    "/journal/{entry_id}",
    response_model=None,
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


@router.get(
    "/health-tips",
    response_model=HealthTipListResponse,
    summary="Get health tips (static, no AI). Supports metric_type filter and limit.",
)
async def get_health_tips(
    svc: WellnessServiceDep,
    metric_type: str | None = Query(
        None, description="Filter by metric type (sleep, water, food, exercise, medication)"
    ),
    limit: int = Query(3, ge=1, le=10),
) -> HealthTipListResponse:
    tips = await svc.get_health_tips(metric_type=metric_type, limit=limit)
    return HealthTipListResponse(
        data=[HealthTipResponse.model_validate(t) for t in tips],
        total=len(tips),
    )


def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")
    from app.modules.wellness.seed import seed_health_tips

    @app.on_event("startup")
    async def seed_tips_on_startup():
        from app.core.database import async_session_maker

        async with async_session_maker() as session:
            await seed_health_tips(session)

    # ---- Bridge: cycle module emits `day_logged` on DayDetailSheet save ----
    # The Wellness tab reads mood_logs (NOT cycle_days). Subscriber lives in the
    # wellness module (owner of mood_logs) and idempotently upserts one mood log
    # per user/date (one per day, matching the source day's mood).
    async def _on_day_logged(
        user_id: str,
        log_date: str,
        mood: str,
        mood_intensity: int | None,
        notes: str | None,
    ) -> None:
        import logging
        from datetime import date
        from uuid import UUID

        from app.core.database import async_session_maker
        from app.modules.wellness.services import upsert_mood_for_date

        try:
            async with async_session_maker() as session:
                parsed_date = date.fromisoformat(log_date)
                await upsert_mood_for_date(
                    session,
                    user_id=UUID(user_id),
                    mood=mood,
                    intensity=mood_intensity,
                    notes=notes,
                    log_date=parsed_date,
                )
        except Exception:
            logging.getLogger("app.modules.wellness").exception(
                "wellness.day_logged_subscriber",
            )

    if event_bus is not None:
        event_bus.subscribe_sync("day_logged", _on_day_logged)
