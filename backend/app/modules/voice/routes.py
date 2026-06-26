"""Voice journal placeholder endpoints (plan 22).

All return 202 or 501 as specified. No impact on existing modules.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.modules.voice.schemas import VoiceAnalysisResponse, VoiceJournalAccept

router = APIRouter(prefix="/voice", tags=["voice"])


@router.post(
    "/daily",
    status_code=202,
    summary="Accept audio recording for future processing",
    description="Placeholder — accepts audio data and returns 202. Processing not yet implemented.",
)
async def accept_audio(request: Request) -> VoiceJournalAccept:
    return VoiceJournalAccept(id=uuid.uuid4(), status="queued")


@router.get(
    "/analysis/{entry_id}",
    summary="Get voice journal analysis results",
    description="Returns 501 — feature not yet available.",
)
async def get_analysis(entry_id: uuid.UUID) -> VoiceAnalysisResponse:
    return VoiceAnalysisResponse(id=entry_id)


@router.post(
    "/emotion/realtime",
    status_code=501,
    summary="Real-time emotion detection from voice",
    description="Returns 501 — feature not yet available.",
)
async def realtime_emotion() -> JSONResponse:
    return JSONResponse(
        status_code=501,
        content={
            "error": {
                "code": "FEATURE_NOT_AVAILABLE",
                "details": "Real-time emotion detection is not yet implemented",
            }
        },
    )


def init_module(app, event_bus) -> None:
    app.include_router(router, prefix="/api/v1")
