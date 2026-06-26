from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SyncOperation(BaseModel):
    type: str = Field(
        ...,
        pattern=r"^(journal|mood|cycle|pregnancy_daily_log|emergency_contact)\/(create|update|delete)$",
    )
    data: dict[str, Any] = Field(default_factory=dict)
    temp_id: str | None = None
    idempotency_key: str | None = None
    client_updated_at: datetime | None = None


class SyncBatchRequest(BaseModel):
    operations: list[SyncOperation] = Field(..., max_length=100)


class SyncResultItem(BaseModel):
    index: int
    status: str = Field(..., pattern=r"^(created|updated|deleted|conflict|failed)$")
    entity_id: str | None = None
    temp_id: str | None = None
    server_data: dict[str, Any] | None = None
    error: str | None = None


class SyncBatchResponse(BaseModel):
    results: list[SyncResultItem]
    conflicts: list[SyncResultItem] = []


class SyncChangeItem(BaseModel):
    entity_type: str
    entity_id: uuid.UUID
    action: str
    data: dict[str, Any]
    updated_at: datetime


class SyncChangesResponse(BaseModel):
    changes: list[SyncChangeItem]
    has_more: bool = False
    next_token: str | None = None
