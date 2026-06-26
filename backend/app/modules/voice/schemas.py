"""Voice journal Pydantic schemas (plan 22 stubs)."""

from __future__ import annotations

import uuid

from pydantic import BaseModel


class VoiceJournalAccept(BaseModel):
    id: uuid.UUID
    status: str = "queued"
    message: str = "Voice journal accepted for processing"


class VoiceAnalysisResponse(BaseModel):
    id: uuid.UUID
    status: str = "unavailable"
    feature_coming: bool = True
    message: str = "Voice journal analysis is not yet available"
