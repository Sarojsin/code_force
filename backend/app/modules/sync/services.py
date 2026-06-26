from __future__ import annotations

import logging
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import Base
from app.modules.sync.schemas import (
    SyncBatchRequest,
    SyncBatchResponse,
    SyncChangeItem,
    SyncChangesResponse,
    SyncOperation,
    SyncResultItem,
)

logger = logging.getLogger("app.modules.sync")

SYNCABLE_TABLES: list[type[Base]] = []
_IDEMPOTENCY_CACHE: dict[str, SyncResultItem] = {}
_IDEMPOTENCY_TTL = timedelta(hours=24)


class SyncService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self._init_handlers()

    def _init_handlers(self) -> None:
        self._handlers: dict[str, Any] = {
            "journal/create": self._journal_create,
            "journal/update": self._journal_update,
            "journal/delete": self._journal_delete,
            "mood/create": self._mood_create,
            "cycle/create": self._cycle_create,
            "cycle/update": self._cycle_update,
            "cycle/delete": self._cycle_delete,
        }

    # ------------------------------------------------------------------
    # Push batch
    # ------------------------------------------------------------------

    async def push_batch(
        self,
        user_id: uuid.UUID,
        request: SyncBatchRequest,
    ) -> SyncBatchResponse:
        results: list[SyncResultItem] = []
        for idx, op in enumerate(request.operations):
            results.append(await self._handle(user_id, op, idx))
        return SyncBatchResponse(
            results=results,
            conflicts=[r for r in results if r.status == "conflict"],
        )

    async def _handle(
        self,
        user_id: uuid.UUID,
        op: SyncOperation,
        index: int,
    ) -> SyncResultItem:
        # Idempotency check
        if op.idempotency_key:
            cached = _IDEMPOTENCY_CACHE.get(op.idempotency_key)
            if cached:
                return cached

        handler = self._handlers.get(op.type)
        if handler is None:
            return SyncResultItem(index=index, status="failed", temp_id=op.temp_id, error=f"Unknown type: {op.type}")
        try:
            result = await handler(user_id, op, index)
            if op.idempotency_key:
                _IDEMPOTENCY_CACHE[op.idempotency_key] = result
            return result
        except Exception as exc:
            logger.exception("sync.handle_failed", extra={"type": op.type})
            return SyncResultItem(index=index, status="failed", temp_id=op.temp_id, error=str(exc))

    def _clamp_client_ts(self, ts: datetime | None) -> datetime | None:
        if ts is None:
            return None
        now = datetime.now(UTC)
        if ts > now + timedelta(minutes=5):
            return now
        return ts

    # ------------------------------------------------------------------
    # Journal handlers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_date(val: Any) -> date | None:
        if isinstance(val, date):
            return val
        if isinstance(val, str):
            try:
                return date.fromisoformat(val)
            except (ValueError, TypeError):
                return None
        return None

    async def _journal_create(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.wellness.models import JournalEntry

        client_ts = self._clamp_client_ts(op.client_updated_at)
        entry_date = self._parse_date(op.data.get("entry_date")) or date.today()
        entry = JournalEntry(
            user_id=user_id,
            content=op.data.get("content", ""),
            entry_date=entry_date,
            sentiment_score=op.data.get("sentiment_score"),
            sentiment_label=op.data.get("sentiment_label"),
            client_updated_at=client_ts,
        )
        self.db.add(entry)
        await self.db.flush()
        return SyncResultItem(index=index, status="created", entity_id=str(entry.id), temp_id=op.temp_id)

    async def _journal_update(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.wellness.models import JournalEntry

        entity_id = uuid.UUID(op.data.get("id", ""))
        result = await self._check_conflict(JournalEntry, user_id, entity_id, op)
        if result:
            return result
        stmt = select(JournalEntry).where(JournalEntry.id == entity_id, JournalEntry.user_id == user_id)
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            return SyncResultItem(index=index, status="failed", entity_id=str(entity_id), temp_id=op.temp_id, error="Not found")
        client_ts = self._clamp_client_ts(op.client_updated_at)
        if "content" in op.data:
            row.content = op.data["content"]
        if "entry_date" in op.data:
            row.entry_date = op.data["entry_date"]
        if client_ts:
            row.client_updated_at = client_ts
        await self.db.flush()
        return SyncResultItem(index=index, status="updated", entity_id=str(entity_id), temp_id=op.temp_id)

    async def _journal_delete(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.wellness.models import JournalEntry

        entity_id = uuid.UUID(op.data.get("id", ""))
        stmt = select(JournalEntry).where(JournalEntry.id == entity_id, JournalEntry.user_id == user_id)
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            return SyncResultItem(index=index, status="deleted", entity_id=str(entity_id), temp_id=op.temp_id)
        row.is_active = False
        await self.db.flush()
        return SyncResultItem(index=index, status="deleted", entity_id=str(entity_id), temp_id=op.temp_id)

    # ------------------------------------------------------------------
    # Mood handlers
    # ------------------------------------------------------------------

    async def _mood_create(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.wellness.models import MoodLog

        client_ts = self._clamp_client_ts(op.client_updated_at)
        mood = MoodLog(
            user_id=user_id,
            mood=op.data.get("mood", ""),
            intensity=op.data.get("intensity", 3),
            logged_at=client_ts or datetime.now(UTC),
            client_updated_at=client_ts,
        )
        self.db.add(mood)
        await self.db.flush()
        return SyncResultItem(index=index, status="created", entity_id=str(mood.id), temp_id=op.temp_id)

    # ------------------------------------------------------------------
    # Cycle handlers
    # ------------------------------------------------------------------

    async def _cycle_create(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.cycle.models import CycleEntry

        client_ts = self._clamp_client_ts(op.client_updated_at)
        period_start = self._parse_date(op.data.get("period_start_date")) or date.today()
        entry = CycleEntry(
            user_id=user_id,
            period_start_date=period_start,
            period_end_date=self._parse_date(op.data.get("period_end_date")),
            flow_intensity=op.data.get("flow_intensity"),
            symptoms=op.data.get("symptoms", []),
            mood_tags=op.data.get("mood_tags", []),
            energy_level=op.data.get("energy_level"),
            notes=op.data.get("notes"),
            client_updated_at=client_ts,
        )
        self.db.add(entry)
        await self.db.flush()
        return SyncResultItem(index=index, status="created", entity_id=str(entry.id), temp_id=op.temp_id)

    async def _cycle_update(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.cycle.models import CycleEntry

        entity_id = uuid.UUID(op.data.get("id", ""))
        result = await self._check_conflict(CycleEntry, user_id, entity_id, op)
        if result:
            return result
        stmt = select(CycleEntry).where(CycleEntry.id == entity_id, CycleEntry.user_id == user_id)
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            return SyncResultItem(index=index, status="failed", entity_id=str(entity_id), temp_id=op.temp_id, error="Not found")
        client_ts = self._clamp_client_ts(op.client_updated_at)
        for field in ("period_end_date", "flow_intensity", "symptoms", "mood_tags", "energy_level", "notes"):
            if field in op.data:
                setattr(row, field, op.data[field])
        if client_ts:
            row.client_updated_at = client_ts
        await self.db.flush()
        return SyncResultItem(index=index, status="updated", entity_id=str(entity_id), temp_id=op.temp_id)

    async def _cycle_delete(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.cycle.models import CycleEntry

        entity_id = uuid.UUID(op.data.get("id", ""))
        stmt = select(CycleEntry).where(CycleEntry.id == entity_id, CycleEntry.user_id == user_id)
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            return SyncResultItem(index=index, status="deleted", entity_id=str(entity_id), temp_id=op.temp_id)
        row.is_active = False
        await self.db.flush()
        return SyncResultItem(index=index, status="deleted", entity_id=str(entity_id), temp_id=op.temp_id)

    # ------------------------------------------------------------------
    # Conflict detection
    # ------------------------------------------------------------------

    async def _check_conflict(
        self,
        model: type[Base],
        user_id: uuid.UUID,
        entity_id: uuid.UUID,
        op: SyncOperation,
    ) -> SyncResultItem | None:
        stmt = select(model).where(model.id == entity_id, model.user_id == user_id)  # type: ignore[attr-defined]
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if row is None:
            return None
        server_ts = getattr(row, "updated_at", None)
        client_ts = self._clamp_client_ts(op.client_updated_at)
        if server_ts and client_ts:
            if server_ts.tzinfo is None and client_ts.tzinfo is not None:
                server_ts = server_ts.replace(tzinfo=UTC)
            if server_ts > client_ts:
                return SyncResultItem(
                    index=0,
                    status="conflict",
                    entity_id=str(entity_id),
                    temp_id=op.temp_id,
                    server_data=self._serialize(row),
                )
        return None

    def _serialize(self, row: Base) -> dict[str, Any]:
        data = {}
        for col in row.__table__.columns:
            val = getattr(row, col.name)
            if isinstance(val, datetime):
                val = val.isoformat()
            elif isinstance(val, uuid.UUID):
                val = str(val)
            data[col.name] = val
        return data

    # ------------------------------------------------------------------
    # Pull changes
    # ------------------------------------------------------------------

    async def pull_changes(
        self,
        user_id: uuid.UUID,
        since: datetime | None = None,
        limit: int = 50,
    ) -> SyncChangesResponse:
        changes: list[SyncChangeItem] = []
        queryables: list[tuple[type[Base], str, str]] = []

        try:
            from app.modules.wellness.models import JournalEntry, MoodLog
            queryables.append((JournalEntry, "journal", "journal_entry"))
            queryables.append((MoodLog, "mood", "mood_log"))
        except ImportError:
            pass

        try:
            from app.modules.cycle.models import CycleEntry
            queryables.append((CycleEntry, "cycle", "cycle_entry"))
        except ImportError:
            pass

        for model, entity_type, _ in queryables:
            stmt = select(model).where(model.user_id == user_id)  # type: ignore[attr-defined]
            if since:
                stmt = stmt.where(model.updated_at > since)  # type: ignore[attr-defined]
            stmt = stmt.order_by(model.updated_at.asc()).limit(limit)  # type: ignore[attr-defined]
            rows = (await self.db.execute(stmt)).scalars().all()
            for row in rows:
                ts = getattr(row, "updated_at", None) or datetime.now(UTC)
                data = self._serialize(row)
                data.pop("content", None)
                is_active = getattr(row, "is_active", True)
                action = "deleted" if not is_active else ("updated" if since else "created")
                changes.append(
                    SyncChangeItem(
                        entity_type=entity_type,
                        entity_id=row.id,
                        action=action,
                        data=data,
                        updated_at=ts,
                    )
                )

        changes.sort(key=lambda c: c.updated_at)
        has_more = len(changes) >= limit
        return SyncChangesResponse(changes=changes[:limit], has_more=has_more)
