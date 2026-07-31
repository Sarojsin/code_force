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
_IDEMPOTENCY_CACHE: dict[str, tuple[SyncResultItem, datetime]] = {}
_IDEMPOTENCY_TTL = timedelta(hours=24)


def _purge_expired_idempotency_cache() -> None:
    now = datetime.now(UTC)
    expired = [k for k, (_, ts) in list(_IDEMPOTENCY_CACHE.items()) if now - ts > _IDEMPOTENCY_TTL]
    for k in expired:
        del _IDEMPOTENCY_CACHE[k]
    if expired:
        logger.info("sync.idempotency_cache.purged", extra={"count": len(expired)})


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
            "cycle/correction": self._cycle_correction,
            "cycle/snooze": self._cycle_snooze,
            "safety/contact/create": self._safety_contact_create,
            "safety/contact/update": self._safety_contact_update,
            "safety/contact/delete": self._safety_contact_delete,
            "safety/sos/trigger": self._safety_sos_trigger,
            "safety/sos/cancel": self._safety_sos_cancel,
            "safety/sos/resolve": self._safety_sos_resolve,
            "sos/trigger": self._safety_sos_trigger,
            "breathing/complete": self._breathing_complete,
            "family/create": self._family_create,
            "family/update": self._family_update,
            "family/delete": self._family_delete,
        }

    # ------------------------------------------------------------------
    # Push batch
    # ------------------------------------------------------------------

    async def push_batch(
        self,
        user_id: uuid.UUID,
        request: SyncBatchRequest,
    ) -> SyncBatchResponse:
        _purge_expired_idempotency_cache()
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
                return cached[0]

        handler = self._handlers.get(op.type)
        if handler is None:
            return SyncResultItem(index=index, status="failed", temp_id=op.temp_id, error=f"Unknown type: {op.type}")
        try:
            result = await handler(user_id, op, index)
            if op.idempotency_key:
                _IDEMPOTENCY_CACHE[op.idempotency_key] = (result, datetime.now(UTC))
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
        await self.db.refresh(entry)
        return SyncResultItem(index=index, status="created", entity_id=str(entry.id), temp_id=op.temp_id, server_data=self._serialize(entry))

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
        await self.db.refresh(row)
        return SyncResultItem(index=index, status="updated", entity_id=str(entity_id), temp_id=op.temp_id, server_data=self._serialize(row))

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
        await self.db.refresh(mood)
        return SyncResultItem(index=index, status="created", entity_id=str(mood.id), temp_id=op.temp_id, server_data=self._serialize(mood))

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
        await self.db.refresh(entry)
        return SyncResultItem(index=index, status="created", entity_id=str(entry.id), temp_id=op.temp_id, server_data=self._serialize(entry))

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
        if "period_start_date" in op.data:
            parsed = self._parse_date(op.data["period_start_date"])
            if parsed:
                row.period_start_date = parsed
        for field in ("period_end_date", "flow_intensity", "symptoms", "mood_tags", "energy_level", "notes"):
            if field in op.data:
                setattr(row, field, op.data[field])
        if client_ts:
            row.client_updated_at = client_ts
        await self.db.flush()
        await self.db.refresh(row)
        return SyncResultItem(index=index, status="updated", entity_id=str(entity_id), temp_id=op.temp_id, server_data=self._serialize(row))

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

    async def _cycle_correction(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.cycle.services import CycleService

        period_start = self._parse_date(op.data.get("period_start_date"))
        if not period_start:
            return SyncResultItem(
                index=index, status="failed", temp_id=op.temp_id,
                error="Missing or invalid period_start_date",
            )

        corrected_id = op.data.get("corrected_prediction_id")
        parsed_id = uuid.UUID(corrected_id) if corrected_id else None

        client_ts_str = op.client_updated_at.isoformat() if op.client_updated_at else None
        svc = CycleService(self.db)
        entry = await svc.log_correction(
            user_id=user_id,
            period_start_date=period_start,
            period_end_date=self._parse_date(op.data.get("period_end_date")),
            symptoms=op.data.get("symptoms"),
            corrected_prediction_id=parsed_id,
            client_updated_at=client_ts_str,
        )
        return SyncResultItem(
            index=index, status="created", entity_id=str(entry.id), temp_id=op.temp_id,
            server_data=self._serialize(entry),
        )

    async def _cycle_snooze(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.cycle.services import CycleService

        predicted_cycle_id = op.data.get("predictedCycleId")
        day_offset = op.data.get("dayOffset")

        if not predicted_cycle_id or day_offset is None:
            return SyncResultItem(
                index=index, status="failed", temp_id=op.temp_id,
                error="Missing predictedCycleId or dayOffset",
            )

        svc = CycleService(self.db)
        snooze = await svc.log_snooze(
            user_id=user_id,
            predicted_cycle_id=uuid.UUID(predicted_cycle_id),
            day_offset=int(day_offset),
        )
        return SyncResultItem(
            index=index, status="created", entity_id=str(snooze.id), temp_id=op.temp_id,
            server_data=self._serialize(snooze),
        )

    # ------------------------------------------------------------------
    # Safety — emergency contact handlers
    # ------------------------------------------------------------------

    async def _safety_contact_create(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.users.models import EmergencyContact

        contact = EmergencyContact(
            user_id=user_id,
            name=op.data.get("name", ""),
            phone_number=op.data.get("phone_number", ""),
            relationship=op.data.get("relationship"),
            is_primary=op.data.get("is_primary", False),
            contact_user_id=uuid.UUID(op.data["contact_user_id"]) if op.data.get("contact_user_id") else None,
        )
        self.db.add(contact)
        await self.db.flush()
        await self.db.refresh(contact)
        return SyncResultItem(index=index, status="created", entity_id=str(contact.id), temp_id=op.temp_id, server_data=self._serialize(contact))

    async def _safety_contact_update(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.users.models import EmergencyContact

        entity_id = uuid.UUID(op.data.get("id", ""))
        stmt = select(EmergencyContact).where(EmergencyContact.id == entity_id, EmergencyContact.user_id == user_id)
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            return SyncResultItem(index=index, status="failed", entity_id=str(entity_id), temp_id=op.temp_id, error="Not found")
        if "name" in op.data:
            row.name = op.data["name"]
        if "phone_number" in op.data:
            row.phone_number = op.data["phone_number"]
        if "relationship" in op.data:
            row.relationship = op.data["relationship"]
        if "is_primary" in op.data:
            row.is_primary = op.data["is_primary"]
        if "contact_user_id" in op.data:
            row.contact_user_id = uuid.UUID(op.data["contact_user_id"]) if op.data["contact_user_id"] else None
        await self.db.flush()
        await self.db.refresh(row)
        return SyncResultItem(index=index, status="updated", entity_id=str(entity_id), temp_id=op.temp_id, server_data=self._serialize(row))

    async def _safety_contact_delete(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.users.models import EmergencyContact

        entity_id = uuid.UUID(op.data.get("id", ""))
        stmt = select(EmergencyContact).where(EmergencyContact.id == entity_id, EmergencyContact.user_id == user_id)
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            return SyncResultItem(index=index, status="deleted", entity_id=str(entity_id), temp_id=op.temp_id)
        row.is_active = False
        await self.db.flush()
        return SyncResultItem(index=index, status="deleted", entity_id=str(entity_id), temp_id=op.temp_id)

    # ------------------------------------------------------------------
    # Safety — SOS handlers
    # ------------------------------------------------------------------

    async def _safety_sos_trigger(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.safety.models import SOSAlert

        alert = SOSAlert(
            user_id=user_id,
            triggered_at=datetime.now(UTC),
            latitude=op.data.get("latitude", 0),
            longitude=op.data.get("longitude", 0),
            location_accuracy_m=op.data.get("location_accuracy_m"),
            idempotency_key=op.idempotency_key,
            trigger_source=op.data.get("trigger_source"),
        )
        self.db.add(alert)
        await self.db.flush()
        await self.db.refresh(alert)
        return SyncResultItem(index=index, status="created", entity_id=str(alert.id), temp_id=op.temp_id, server_data=self._serialize(alert))

    async def _safety_sos_cancel(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.safety.models import SOSAlert

        entity_id = uuid.UUID(op.data.get("id", ""))
        stmt = select(SOSAlert).where(SOSAlert.id == entity_id, SOSAlert.user_id == user_id)
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            return SyncResultItem(index=index, status="failed", entity_id=str(entity_id), temp_id=op.temp_id, error="Not found")
        row.cancelled_at = datetime.now(UTC)
        row.resolved_at = datetime.now(UTC)
        row.false_alarm = True
        await self.db.flush()
        await self.db.refresh(row)
        return SyncResultItem(index=index, status="updated", entity_id=str(entity_id), temp_id=op.temp_id, server_data=self._serialize(row))

    async def _safety_sos_resolve(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.safety.models import SOSAlert

        entity_id = uuid.UUID(op.data.get("id", ""))
        stmt = select(SOSAlert).where(SOSAlert.id == entity_id, SOSAlert.user_id == user_id)
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            return SyncResultItem(index=index, status="failed", entity_id=str(entity_id), temp_id=op.temp_id, error="Not found")
        row.resolved_at = datetime.now(UTC)
        await self.db.flush()
        await self.db.refresh(row)
        return SyncResultItem(index=index, status="updated", entity_id=str(entity_id), temp_id=op.temp_id, server_data=self._serialize(row))

    # ------------------------------------------------------------------
    # Breathing handlers
    # ------------------------------------------------------------------

    async def _breathing_complete(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.wellness.models import UserExerciseSession

        exercise_id = op.data.get("exerciseId")
        if not exercise_id:
            return SyncResultItem(index=index, status="failed", temp_id=op.temp_id, error="Missing exerciseId")
        session = UserExerciseSession(
            user_id=user_id,
            exercise_id=uuid.UUID(exercise_id),
            completed_at=datetime.now(UTC),
        )
        self.db.add(session)
        await self.db.flush()
        await self.db.refresh(session)
        return SyncResultItem(index=index, status="created", entity_id=str(session.id), temp_id=op.temp_id, server_data=self._serialize(session))

    # ------------------------------------------------------------------
    # Family link handlers
    # ------------------------------------------------------------------

    async def _family_create(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.family.models import FamilyLink

        linked_user_id = op.data.get("linked_user_id")
        link = FamilyLink(
            user_id=user_id,
            linked_user_id=uuid.UUID(linked_user_id) if linked_user_id else None,
            permission_level=op.data.get("permission_level", 0),
            invite_token=op.data.get("invite_token", ""),
            token_expires_at=datetime.fromisoformat(op.data["token_expires_at"]) if op.data.get("token_expires_at") else datetime.now(UTC),
            status=op.data.get("status", "pending"),
        )
        self.db.add(link)
        await self.db.flush()
        await self.db.refresh(link)
        return SyncResultItem(index=index, status="created", entity_id=str(link.id), temp_id=op.temp_id, server_data=self._serialize(link))

    async def _family_update(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.family.models import FamilyLink

        entity_id = uuid.UUID(op.data.get("id", ""))
        stmt = select(FamilyLink).where(FamilyLink.id == entity_id, FamilyLink.user_id == user_id)
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            return SyncResultItem(index=index, status="failed", entity_id=str(entity_id), temp_id=op.temp_id, error="Not found")
        if "permission_level" in op.data:
            row.permission_level = op.data["permission_level"]
        if "status" in op.data:
            row.status = op.data["status"]
        if "linked_user_id" in op.data:
            row.linked_user_id = uuid.UUID(op.data["linked_user_id"]) if op.data["linked_user_id"] else None
        await self.db.flush()
        await self.db.refresh(row)
        return SyncResultItem(index=index, status="updated", entity_id=str(entity_id), temp_id=op.temp_id, server_data=self._serialize(row))

    async def _family_delete(self, user_id: uuid.UUID, op: SyncOperation, index: int) -> SyncResultItem:
        from app.modules.family.models import FamilyLink

        entity_id = uuid.UUID(op.data.get("id", ""))
        stmt = select(FamilyLink).where(FamilyLink.id == entity_id, FamilyLink.user_id == user_id)
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            return SyncResultItem(index=index, status="deleted", entity_id=str(entity_id), temp_id=op.temp_id)
        row.is_active = False
        row.status = "revoked"
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
            elif isinstance(val, date):
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
            from app.modules.wellness.models import JournalEntry, MoodLog, UserExerciseSession
            queryables.append((JournalEntry, "journal", "journal_entry"))
            queryables.append((MoodLog, "mood", "mood_log"))
            queryables.append((UserExerciseSession, "exercise_session", "user_exercise_sessions"))
        except ImportError:
            pass

        try:
            from app.modules.cycle.models import CycleEntry
            queryables.append((CycleEntry, "cycle", "cycle_entry"))
        except ImportError:
            pass

        try:
            from app.modules.users.models import EmergencyContact
            queryables.append((EmergencyContact, "emergency_contact", "emergency_contacts"))
        except ImportError:
            pass

        try:
            from app.modules.safety.models import SOSAlert
            queryables.append((SOSAlert, "sos_alert", "sos_alerts"))
        except ImportError:
            pass

        try:
            from app.modules.family.models import FamilyLink
            queryables.append((FamilyLink, "family_link", "family_links"))
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
