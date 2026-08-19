"""Cycle tracking service: CRUD, predictions, calendar, analytics (plan 07, Phase 2)."""

from __future__ import annotations

import json
import logging
import os
import uuid
from contextlib import suppress
from datetime import UTC, date, datetime, timedelta
from itertools import pairwise
from statistics import median, pstdev
from typing import Any

from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.encryption import EncryptionError, EncryptionService, get_encryption_service
from app.core.event_bus import event_bus
from app.integrations.groq_client import GroqClient, GroqError
from app.integrations.prediction_engine import (
    PROD_DIR,
    PredictionResult,
    apply_global_model,
    confidence_label,
    fallback_prediction,
)
from app.modules.cycle.exceptions import (
    CycleConflictError,
    CycleEntryNotFoundError,
    InsufficientDataError,
    PeriodEndDateRequiredError,
    PredictionNotFoundError,
)
from app.modules.cycle.models import (
    CycleDay,
    CycleEntry,
    CycleReport,
    DayMedication,
    DaySymptom,
    Medication,
    PredictedCycle,
    SnoozeEvent,
    Symptom,
    SystemConfig,
)
from app.modules.cycle.phase_utils import calculate_cycle_phases, compute_period_length
from app.modules.cycle.schemas import (
    CycleEntryCreate,
    CycleEntryUpdate,
    DayUpsert,
    ReportData,
)

logger = logging.getLogger("app.modules.cycle")


class CycleService:
    def __init__(
        self,
        db: AsyncSession,
        encryption: EncryptionService | None = None,
    ) -> None:
        self.db = db
        self.encryption = encryption or get_encryption_service()

    # ---- 3-state buffer logic ----

    async def _determine_period_state(self, user_id: uuid.UUID, start_date: date) -> str:
        """Return 'A' (future), 'B' (active/within avg), or 'C' (past avg).

        State C is only enforced when the user has an active prediction that
        covers *start_date* — without a prediction the system does not know
        whether this period has exceeded the expected window.
        """
        today = date.today()
        if today < start_date:
            return "A"
        # Check for an active prediction covering this start_date
        stmt = (
            select(PredictedCycle)
            .where(PredictedCycle.user_id == user_id)
            .where(PredictedCycle.is_active.is_(True))
            .where(PredictedCycle.actual_cycle_entry_id.is_(None))
            .order_by(PredictedCycle.predicted_next_period_start.asc())
        )
        predictions = (await self.db.execute(stmt)).scalars().all()
        entries = await self._get_recent_entries(user_id, limit=12)
        avg_length = (
            self._compute_average_period_length(entries)
            if entries
            else get_settings().cycle.period_default_length
        )
        for pred in predictions:
            pred_end = pred.predicted_next_period_start + timedelta(days=avg_length - 1)
            if pred.predicted_next_period_start <= start_date <= pred_end:
                if today > pred_end:
                    return "C"
                break
        return "B"

    # ---- CRUD ----

    async def create_entry(self, user_id: uuid.UUID, data: CycleEntryCreate) -> CycleEntry:
        state = await self._determine_period_state(user_id, data.period_start_date)
        period_end_date = data.period_end_date
        if state in ("A", "B") and period_end_date is None:
            avg_length = await self.get_avg_period_length(user_id)
            period_end_date = data.period_start_date + timedelta(days=avg_length - 1)
        elif state == "C" and period_end_date is None:
            raise PeriodEndDateRequiredError(
                "Your period appears to have ended already. Please provide the end date."
            )
        entry = CycleEntry(
            user_id=user_id,
            period_start_date=data.period_start_date,
            period_end_date=period_end_date,
            flow_intensity=data.flow_intensity,
            symptoms=data.symptoms,
            mood_tags=data.mood_tags,
            energy_level=data.energy_level,
            notes=data.notes,
            cycle_type=data.cycle_type,
        )
        self.db.add(entry)
        try:
            await self.db.commit()
        except IntegrityError:
            await self.db.rollback()
            logger.info(
                "cycle.entry_already_exists",
                extra={"user_id": str(user_id), "period_start": str(data.period_start_date)},
            )
            existing = await self._get_entry_by_user_and_date(user_id, data.period_start_date)
            # Apply caller-provided fields first
            update_data = data.model_dump(exclude_unset=True, exclude={"period_start_date"})
            for key, value in update_data.items():
                setattr(existing, key, value)
            # Auto-fill end_date for State A/B if still missing
            if state in ("A", "B") and existing.period_end_date is None:
                avg_length = await self.get_avg_period_length(user_id)
                existing.period_end_date = data.period_start_date + timedelta(days=avg_length - 1)
            await self.db.commit()
            await self.db.refresh(existing)
            await self._auto_close_open_entry(user_id, data.period_start_date)

            with suppress(InsufficientDataError):
                await self.compute_predictions(user_id)

            await self._emit_cycle_closed(existing)
            return existing
        await self.db.refresh(entry)
        await self._try_auto_link_prediction(user_id, entry)
        if entry.cycle_type == "anovulatory":
            await self._suspend_predictions(user_id)
        await self._auto_close_open_entry(user_id, data.period_start_date)
        await self.db.commit()

        with suppress(InsufficientDataError):
            await self.compute_predictions(user_id)

        await self._emit_cycle_closed(entry)
        return entry

    async def _emit_cycle_closed(self, entry: CycleEntry) -> None:
        """Emit ``cycle_closed`` AFTER the DB commit so the subscriber reads
        committed state (RaaS plan: Celery task aggregates + stores report)."""
        if entry.period_end_date is None:
            return
        await event_bus.emit(
            "cycle_closed",
            user_id=str(entry.user_id),
            cycle_entry_id=str(entry.id),
        )

    async def apply_correction_if_needed(
        self, entry: CycleEntry, prediction: PredictedCycle
    ) -> None:
        """Link a prediction to an entry and store correction data.

        Called from:
        1. log_correction() — Sticky Card "Yes" + Calendar "Start Period"
        2. _try_auto_link_prediction() — LogPeriodScreen auto-link

        Ensures correction_delta is ALWAYS stored when a prediction is matched.
        """
        error = (entry.period_start_date - prediction.predicted_next_period_start).days
        prediction.actual_cycle_entry_id = entry.id
        prediction.prediction_error_days = error
        entry.is_correction = True
        entry.corrected_prediction_id = prediction.id
        entry.correction_delta = error  # positive = late, negative = early
        await self._update_user_ml_metrics(entry.user_id, error)

    async def _try_auto_link_prediction(self, user_id: uuid.UUID, entry: CycleEntry) -> None:
        base_window = get_settings().cycle.auto_link_window_days
        stmt = (
            select(PredictedCycle)
            .where(PredictedCycle.user_id == user_id)
            .where(PredictedCycle.is_active.is_(True))
            .where(PredictedCycle.actual_cycle_entry_id.is_(None))
            .order_by(PredictedCycle.predicted_next_period_start.asc())
        )
        predictions = (await self.db.execute(stmt)).scalars().all()
        for pred in predictions:
            link_window = max(base_window, pred.prediction_window_days or 0)
            diff = (entry.period_start_date - pred.predicted_next_period_start).days
            if -link_window <= diff <= link_window:
                await self.apply_correction_if_needed(entry, pred)
                await self.db.flush()
                break

    async def _suspend_predictions(self, user_id: uuid.UUID) -> None:
        """Deactivate all active predictions — used when the last entry is anovulatory."""
        stmt = (
            select(PredictedCycle)
            .where(PredictedCycle.user_id == user_id)
            .where(PredictedCycle.is_active.is_(True))
        )
        preds = (await self.db.execute(stmt)).scalars().all()
        for p in preds:
            p.is_active = False
        await self.db.flush()

    async def _get_entry_by_user_and_date(
        self, user_id: uuid.UUID, period_start: date
    ) -> CycleEntry:
        stmt = (
            select(CycleEntry)
            .where(CycleEntry.user_id == user_id)
            .where(CycleEntry.period_start_date == period_start)
            .where(CycleEntry.is_active.is_(True))
        )
        entry = (await self.db.execute(stmt)).scalar_one_or_none()
        if entry is None:
            raise CycleEntryNotFoundError("Cycle entry not found")
        return entry

    async def find_by_idempotency_key(self, user_id: uuid.UUID, key: str) -> CycleEntry | None:
        stmt = (
            select(CycleEntry)
            .where(CycleEntry.user_id == user_id)
            .where(CycleEntry.idempotency_key == key)
            .where(CycleEntry.is_active.is_(True))
            .limit(1)
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def get_entry(self, entry_id: uuid.UUID, user_id: uuid.UUID) -> CycleEntry:
        stmt = (
            select(CycleEntry)
            .where(CycleEntry.id == entry_id)
            .where(CycleEntry.user_id == user_id)
            .where(CycleEntry.is_active.is_(True))
        )
        entry = (await self.db.execute(stmt)).scalar_one_or_none()
        if entry is None:
            raise CycleEntryNotFoundError("Cycle entry not found")
        return entry

    async def list_entries(
        self,
        user_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
        months_back: int = 6,
    ) -> list[CycleEntry]:
        cutoff = date.today() - timedelta(days=months_back * 30)
        stmt = (
            select(CycleEntry)
            .where(CycleEntry.user_id == user_id)
            .where(CycleEntry.period_start_date >= cutoff)
            .where(CycleEntry.is_active.is_(True))
            .order_by(CycleEntry.period_start_date.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_entry(
        self,
        entry_id: uuid.UUID,
        user_id: uuid.UUID,
        data: CycleEntryUpdate,
    ) -> CycleEntry:
        entry = await self.get_entry(entry_id, user_id)
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(entry, key, value)
        await self.db.commit()
        await self.db.refresh(entry)
        await self._emit_cycle_closed(entry)
        return entry

    async def delete_entry(self, entry_id: uuid.UUID, user_id: uuid.UUID) -> None:
        entry = await self.get_entry(entry_id, user_id)
        entry.is_active = False
        await self.db.commit()

    # ---- Predictions (Phase 2: global model alignment) ----

    async def compute_predictions(self, user_id: uuid.UUID) -> PredictedCycle:
        entries = await self._get_recent_entries(user_id, limit=12)

        if len(entries) < 1:
            raise InsufficientDataError("Need at least 1 cycle entry")

        # If the most recent entry is anovulatory (postpartum/medical),
        # suspend predictions until a real period is logged.
        if entries[0].cycle_type == "anovulatory":
            raise InsufficientDataError(
                "Last logged period is anovulatory — predictions suspended until a menstrual entry is logged."
            )

        from app.modules.auth.models import User

        user_obj = (
            await self.db.execute(
                select(User).where(User.id == user_id).where(User.is_active.is_(True))
            )
        ).scalar_one_or_none()

        model = await self._load_active_model()
        if model is not None and len(entries) >= 3:
            result = await self._predict_with_global_model(user_obj, entries, model)
        else:
            result = self._predict_with_fallback(entries, user_obj)

        return await self._upsert_prediction(user_id, result)

    async def _predict_with_global_model(
        self,
        user: object,
        entries: list[CycleEntry],
        model: dict | None = None,
    ) -> PredictionResult:
        from app.integrations.prediction_engine import build_rolling_features
        from app.modules.auth.models import User
        from app.modules.onboarding.models import UserOnboarding

        u = user if isinstance(user, User) else None
        start_dates = [e.period_start_date for e in entries]
        cycle_lengths = self._compute_cycle_lengths(entries)
        period_lengths = [
            compute_period_length(e.period_start_date, e.period_end_date, 5) for e in entries[:4]
        ]

        features = build_rolling_features(cycle_lengths, period_lengths)

        onboarding = None
        if u:
            ob_stmt = select(UserOnboarding).where(UserOnboarding.user_id == u.id)
            onboarding = (await self.db.execute(ob_stmt)).scalar_one_or_none()

        user_age = onboarding.age if onboarding else None
        if user_age is not None:
            if user_age < 20:
                age_bucket_ordinal = 0
            elif user_age < 25:
                age_bucket_ordinal = 1
            elif user_age < 30:
                age_bucket_ordinal = 2
            elif user_age < 35:
                age_bucket_ordinal = 3
            elif user_age < 40:
                age_bucket_ordinal = 4
            else:
                age_bucket_ordinal = 5
        else:
            age_bucket_ordinal = 2

        user_bmi_bucket_ordinal = 0
        if onboarding and onboarding.weight_kg and onboarding.height_cm:
            bmi = onboarding.weight_kg / ((onboarding.height_cm / 100) ** 2)
            if bmi < 18.5:
                user_bmi_bucket_ordinal = 0
            elif bmi < 25:
                user_bmi_bucket_ordinal = 1
            elif bmi < 30:
                user_bmi_bucket_ordinal = 2
            else:
                user_bmi_bucket_ordinal = 3

        user_stress_level = onboarding.stress_level if onboarding else None
        user_sleep_hours = onboarding.sleep_hours if onboarding else None
        user_exercise_frequency = onboarding.exercise_frequency if onboarding else None
        user_diet = onboarding.diet if onboarding else None

        if model is None:
            return self._predict_with_fallback(entries, u)

        predicted_length, confidence = apply_global_model(
            model,
            user_avg_cycle=features.avg_cycle_length,
            user_std_cycle=u.cycle_length_std_dev if u else None,
            user_trend_slope=features.trend_slope,
            user_avg_error=u.avg_prediction_error_days if u else None,
            user_age_bucket_ordinal=age_bucket_ordinal,
            user_bmi_bucket_ordinal=user_bmi_bucket_ordinal,
            user_stress_level=user_stress_level,
            user_avg_period_length=features.avg_period_length,
            user_sleep_hours=user_sleep_hours,
            user_exercise_frequency=user_exercise_frequency,
            user_diet=user_diet,
        )

        latest_start = max(start_dates)
        next_start = latest_start + timedelta(days=predicted_length)
        next_end = next_start + timedelta(days=round(features.avg_period_length))
        fertile_start = next_start - timedelta(days=14)
        fertile_end = fertile_start + timedelta(days=5)

        window = None
        if u and u.cycle_length_std_dev and u.cycle_length_std_dev > 3.5:
            window = int(u.cycle_length_std_dev)

        return PredictionResult(
            next_period_start=next_start,
            next_period_end=next_end,
            fertile_window_start=fertile_start,
            fertile_window_end=fertile_end,
            confidence=confidence,
            model_used="global_model",
            data_points=u.total_cycles_logged if u else len(entries),
            prediction_window_days=window,
        )

    def _predict_with_fallback(
        self,
        entries: list[CycleEntry],
        user: object | None,
    ) -> PredictionResult:
        start_dates = [e.period_start_date for e in entries]
        cycle_lengths = self._compute_cycle_lengths(entries)
        period_lengths = [
            compute_period_length(e.period_start_date, e.period_end_date, 5) for e in entries
        ]

        from app.modules.auth.models import User

        u = user if isinstance(user, User) else None
        avg_error = u.avg_prediction_error_days if u else None

        pred_std = u.cycle_length_std_dev if (u and u.cycle_length_std_dev is not None) else None
        predicted_length, confidence, window = fallback_prediction(
            cycle_lengths, avg_error, pred_std
        )

        latest_start = max(start_dates)
        next_start = latest_start + timedelta(days=predicted_length)
        next_end = next_start + timedelta(days=int(median(period_lengths)) if period_lengths else 5)
        fertile_start = next_start - timedelta(days=14)
        fertile_end = fertile_start + timedelta(days=5)

        return PredictionResult(
            next_period_start=next_start,
            next_period_end=next_end,
            fertile_window_start=fertile_start,
            fertile_window_end=fertile_end,
            confidence=confidence,
            model_used="fallback",
            data_points=len(cycle_lengths),
            prediction_window_days=window,
        )

    async def _load_active_model(self) -> dict | None:
        try:
            stmt = select(SystemConfig.value).where(SystemConfig.key == "global_model_path")
            config = (await self.db.execute(stmt)).scalar_one_or_none()
            if not config:
                return None
            path = os.path.join(PROD_DIR, config)
            if not os.path.exists(path):
                return None
            with open(path) as f:
                return dict(__import__("json").load(f))
        except Exception:
            return None

    async def _get_recent_entries(self, user_id: uuid.UUID, limit: int = 12) -> list[CycleEntry]:
        stmt = (
            select(CycleEntry)
            .where(CycleEntry.user_id == user_id)
            .where(CycleEntry.is_active.is_(True))
            .where(CycleEntry.period_end_date.isnot(None))
            .order_by(CycleEntry.period_start_date.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    def _compute_cycle_lengths(entries: list[CycleEntry]) -> list[int]:
        lengths = []
        for i in range(len(entries) - 1):
            diff = (entries[i].period_start_date - entries[i + 1].period_start_date).days
            if 20 <= diff <= 45:
                lengths.append(diff)
        return lengths

    async def _upsert_prediction(
        self,
        user_id: uuid.UUID,
        result: PredictionResult,
    ) -> PredictedCycle:
        # Deactivate any existing active prediction so history is preserved
        old_stmt = (
            select(PredictedCycle)
            .where(PredictedCycle.user_id == user_id)
            .where(PredictedCycle.is_active.is_(True))
        )
        old = (await self.db.execute(old_stmt)).scalar_one_or_none()
        if old:
            old.is_active = False
            await self.db.flush()

        prediction = PredictedCycle(
            user_id=user_id,
            is_active=True,
            predicted_next_period_start=result.next_period_start,
            predicted_fertile_window_start=result.fertile_window_start,
            predicted_fertile_window_end=result.fertile_window_end,
            model_type=result.model_used,
            model_version=result.model_used,
            confidence_score=result.confidence,
            training_data_points=result.data_points,
            prediction_window_days=result.prediction_window_days,
        )
        self.db.add(prediction)
        await self.db.commit()
        await self.db.refresh(prediction)
        return prediction

    # ---- Get predictions ----

    async def get_predictions(self, user_id: uuid.UUID) -> PredictedCycle | None:
        # If the most recent entry is anovulatory, suspend predictions
        entries = await self._get_recent_entries(user_id, limit=1)
        if entries and entries[0].cycle_type == "anovulatory":
            return None

        stmt = (
            select(PredictedCycle)
            .where(PredictedCycle.user_id == user_id)
            .where(PredictedCycle.is_active.is_(True))
            .order_by(PredictedCycle.predicted_next_period_start.asc())
        )
        latest = (await self.db.execute(stmt)).scalar_one_or_none()
        if latest is None and entries:
            try:
                await self.compute_predictions(user_id)
                latest = (await self.db.execute(stmt)).scalar_one_or_none()
            except InsufficientDataError:
                pass
        return latest

    async def get_prediction_history(
        self,
        user_id: uuid.UUID,
        limit: int = 12,
    ) -> list[dict]:
        """Return past predictions with actual dates and error deltas."""
        stmt = (
            select(PredictedCycle)
            .where(PredictedCycle.user_id == user_id)
            .where(PredictedCycle.actual_cycle_entry_id.isnot(None))
            .order_by(PredictedCycle.predicted_next_period_start.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        predictions = result.scalars().all()

        history = []
        for p in predictions:
            actual_date: date | None = None
            if p.actual_cycle_entry_id:
                entry_stmt = (
                    select(CycleEntry)
                    .where(CycleEntry.id == p.actual_cycle_entry_id)
                    .where(CycleEntry.is_active.is_(True))
                )
                entry_result = await self.db.execute(entry_stmt)
                entry = entry_result.scalar_one_or_none()
                if entry:
                    actual_date = entry.period_start_date

            pred_month = p.predicted_next_period_start.strftime("%b")
            history.append(
                {
                    "id": str(p.id),
                    "month": pred_month,
                    "predicted_date": p.predicted_next_period_start.isoformat(),
                    "actual_date": actual_date.isoformat() if actual_date else None,
                    "delta_days": p.prediction_error_days,
                    "on_time": p.prediction_error_days is not None
                    and abs(p.prediction_error_days) <= 1,
                }
            )

        return history

    # ---- Calendar (Phase 2: dictionary-encoded) ----

    async def get_calendar(
        self,
        user_id: uuid.UUID,
        months_back: int = 3,
        months_forward: int = 3,
        today: date | None = None,
    ) -> dict:
        end = date.today() + timedelta(days=months_forward * 30)
        today_ref = today or date.today()
        today_str = today_ref.isoformat()

        # Hard lower bound so the payload cannot grow with account age (Phase D.4).
        # Slightly over months_back (31d) to never drop the month where an
        # on-going period starts.
        start = today_ref - timedelta(days=months_back * 31)

        entries_stmt = (
            select(CycleEntry)
            .where(CycleEntry.user_id == user_id)
            .where(CycleEntry.period_start_date <= end)
            .where(CycleEntry.period_start_date >= start)
            .where(CycleEntry.is_active.is_(True))
            .order_by(CycleEntry.period_start_date.asc())
        )
        entries = (await self.db.execute(entries_stmt)).scalars().all()

        # Prediction features need more history than the client window; fetch a
        # wider set (24 months) just for cycle/period-length statistics without
        # growing the response payload.
        wide_start = today_ref - timedelta(days=24 * 31)
        if wide_start < start:
            wide_entries = entries
        else:
            wide_entries_stmt = (
                select(CycleEntry)
                .where(CycleEntry.user_id == user_id)
                .where(CycleEntry.period_start_date <= end)
                .where(CycleEntry.period_start_date >= wide_start)
                .where(CycleEntry.is_active.is_(True))
                .order_by(CycleEntry.period_start_date.asc())
            )
            wide_entries = (await self.db.execute(wide_entries_stmt)).scalars().all()

        preds_stmt = (
            select(PredictedCycle)
            .where(PredictedCycle.user_id == user_id)
            .where(PredictedCycle.is_active.is_(True))
            .order_by(PredictedCycle.predicted_next_period_start.asc())
            .limit(3)
        )
        predictions = (await self.db.execute(preds_stmt)).scalars().all()

        if not predictions:
            initial = await self.compute_initial_prediction(user_id)
            if initial:
                predictions = [initial]

        days: dict[str, str] = {}

        from app.integrations.prediction_engine import build_rolling_features

        cycle_lengths = self._compute_cycle_lengths(wide_entries)
        period_lengths = [
            compute_period_length(e.period_start_date, e.period_end_date, 5)
            for e in wide_entries[:4]
        ]
        features = build_rolling_features(cycle_lengths, period_lengths)
        avg_period_length = round(features.avg_period_length)
        avg_cycle_length = round(features.avg_cycle_length)

        cancelled_preds = [p for p in predictions if p.actual_cycle_entry_id is not None]
        active_preds = [p for p in predictions if p.actual_cycle_entry_id is None]

        for i, entry in enumerate(entries):
            cycle_len = self._entry_cycle_length(list(entries), i, avg_cycle_length)
            per_len = self._entry_period_length(entry, avg_period_length)
            phases = calculate_cycle_phases(entry.period_start_date, cycle_len, per_len)
            if entry.period_end_date is None:
                self._apply_pending_phases(days, phases, entry.period_start_date)
            else:
                self._apply_confirmed_phases(days, phases)

        for i, pred in enumerate(cancelled_preds):
            cycle_len = self._pred_cycle_length(cancelled_preds, i, avg_cycle_length)
            phases = calculate_cycle_phases(
                pred.predicted_next_period_start, cycle_len, avg_period_length
            )
            for d in self._iter_date_range(phases["period_start"], phases["period_end"]):
                key = d.isoformat()
                if key not in days:
                    days[key] = "c"

        for i, pred in enumerate(active_preds):
            cycle_len = self._pred_cycle_length(active_preds, i, avg_cycle_length)
            phases = calculate_cycle_phases(
                pred.predicted_next_period_start, cycle_len, avg_period_length
            )
            self._apply_predicted_phases(days, phases, pred.prediction_window_days)

        days[today_str] = "T"

        prediction_detail = None
        next_period_in_days = None
        if predictions:
            first = predictions[0]
            prediction_detail = {
                "id": first.id,
                "predicted_next_period_start": first.predicted_next_period_start,
                "predicted_period_end": first.predicted_next_period_start + timedelta(days=5),
                "predicted_fertile_window_start": first.predicted_fertile_window_start,
                "predicted_fertile_window_end": first.predicted_fertile_window_end,
                "model_type": first.model_type or first.model_version or "unknown",
                "confidence_score": first.confidence_score,
                "confidence_label": (
                    confidence_label(first.confidence_score) if first.confidence_score else None
                ),
                "training_data_points": first.training_data_points or 0,
                "prediction_window_days": first.prediction_window_days,
                "predicted_cycle_length": avg_cycle_length,
            }
            next_period_in_days = (first.predicted_next_period_start - today_ref).days

        needs_checkin = False
        if predictions:
            active_pred = predictions[0]
            if active_pred.actual_cycle_entry_id is None:
                pred_date = active_pred.predicted_next_period_start
                pwd = active_pred.prediction_window_days
                if pwd:
                    window_start = pred_date - timedelta(days=max(3, pwd))
                    window_end = pred_date + timedelta(days=max(6, pwd + 1))
                else:
                    window_start = pred_date - timedelta(days=3)
                    window_end = pred_date + timedelta(days=6)
                if window_start <= today_ref <= window_end:
                    has_recent_period = any(
                        e.period_start_date >= today_ref - timedelta(days=14)
                        and e.period_end_date is not None
                        and e.period_end_date >= today_ref - timedelta(days=7)
                        for e in entries
                    )
                    needs_checkin = not has_recent_period

                # If user has snoozed this prediction today, suppress checkin
                if needs_checkin:
                    snooze_stmt = (
                        select(SnoozeEvent)
                        .where(SnoozeEvent.user_id == user_id)
                        .where(SnoozeEvent.predicted_cycle_id == active_pred.id)
                        .order_by(SnoozeEvent.snoozed_at.desc())
                        .limit(1)
                    )
                    last_snooze = (await self.db.execute(snooze_stmt)).scalar_one_or_none()
                    if last_snooze and last_snooze.snoozed_at:
                        snooze_until = last_snooze.snoozed_at + timedelta(
                            days=last_snooze.day_offset
                        )
                        if today_ref <= snooze_until.date():
                            needs_checkin = False

        return {
            "days": days,
            "predictions": prediction_detail,
            "next_period_in_days": (
                max(0, next_period_in_days) if next_period_in_days is not None else None
            ),
            "needs_checkin": needs_checkin,
        }

    @staticmethod
    def _iter_date_range(s: date, e: date):
        current = s
        while current <= e:
            yield current
            current += timedelta(days=1)

    @staticmethod
    def _apply_confirmed_phases(days: dict[str, str], phases: dict[str, date]) -> None:
        for d in CycleService._iter_date_range(phases["period_start"], phases["period_end"]):
            days[d.isoformat()] = "P"
        fs, fe = phases["follicular_start"], phases["follicular_end"]
        if fe >= fs:
            for d in CycleService._iter_date_range(fs, fe):
                key = d.isoformat()
                if key not in days:
                    days[key] = "Fl"
        for d in CycleService._iter_date_range(phases["fertile_start"], phases["fertile_end"]):
            key = d.isoformat()
            if key not in days:
                days[key] = "F"
        # D1: the ovulation day must render as O, not F (fertile_end == ovulation).
        # Only override the fertile code — never clobber a higher-priority code.
        ov_key = phases["ovulation_date"].isoformat()
        if days.get(ov_key) == "F":
            days[ov_key] = "O"
        for d in CycleService._iter_date_range(phases["luteal_start"], phases["luteal_end"]):
            key = d.isoformat()
            if key not in days:
                days[key] = "L"

    @staticmethod
    def _apply_pending_phases(
        days: dict[str, str], phases: dict[str, date], confirmed_start: date
    ) -> None:
        for d in CycleService._iter_date_range(phases["period_start"], phases["period_end"]):
            key = d.isoformat()
            if d == confirmed_start:
                days[key] = "P"
            elif key not in days:
                days[key] = "u"

    @staticmethod
    def _apply_predicted_phases(
        days: dict[str, str], phases: dict[str, date], window: int | None = None
    ) -> None:
        # B: prediction-window band FIRST so fertile/luteal (only-if-absent) still win.
        if window and window > 0:
            lead = CycleService._iter_date_range(
                phases["period_start"] - timedelta(days=window),
                phases["period_start"] - timedelta(days=1),
            )
            trail = CycleService._iter_date_range(
                phases["period_end"] + timedelta(days=1),
                phases["period_end"] + timedelta(days=window),
            )
            for d in list(lead) + list(trail):
                key = d.isoformat()
                if key not in days:
                    days[key] = "pw"
        for d in CycleService._iter_date_range(phases["period_start"], phases["period_end"]):
            key = d.isoformat()
            if key not in days:
                days[key] = "p"
        fs, fe = phases["follicular_start"], phases["follicular_end"]
        if fe >= fs:
            for d in CycleService._iter_date_range(fs, fe):
                key = d.isoformat()
                if key not in days:
                    days[key] = "fl"
        for d in CycleService._iter_date_range(phases["fertile_start"], phases["fertile_end"]):
            key = d.isoformat()
            if key not in days:
                days[key] = "f"
        ov_key = phases["ovulation_date"].isoformat()
        if days.get(ov_key) == "f":
            days[ov_key] = "o"
        for d in CycleService._iter_date_range(phases["luteal_start"], phases["luteal_end"]):
            key = d.isoformat()
            if key not in days:
                days[key] = "l"

    def _compute_average_period_length(self, entries: list[CycleEntry]) -> int:
        lengths = []
        for e in entries:
            if e.period_end_date:
                lengths.append(compute_period_length(e.period_start_date, e.period_end_date, 5))
        if lengths:
            return round(sum(lengths) / len(lengths))
        return get_settings().cycle.period_default_length

    @staticmethod
    def _entry_cycle_length(entries: list[CycleEntry], index: int, fallback: int) -> int:
        if index < len(entries) - 1:
            gap = (entries[index + 1].period_start_date - entries[index].period_start_date).days
            if 20 <= gap <= 45:
                return gap
        return fallback

    @staticmethod
    def _pred_cycle_length(predictions: list[PredictedCycle], index: int, fallback: int) -> int:
        if index < len(predictions) - 1:
            gap = (
                predictions[index + 1].predicted_next_period_start
                - predictions[index].predicted_next_period_start
            ).days
            if 20 <= gap <= 45:
                return gap
        return fallback

    @staticmethod
    def _entry_period_length(entry: CycleEntry, fallback: int) -> int:
        return compute_period_length(entry.period_start_date, entry.period_end_date, fallback)

    # ---- Analytics ----

    async def compute_initial_prediction(self, user_id: uuid.UUID) -> PredictedCycle | None:
        # Check anovulatory state before any fallback — use a broader query
        # that catches entries without period_end_date (e.g. corrections).
        broader = (
            select(CycleEntry)
            .where(CycleEntry.user_id == user_id)
            .where(CycleEntry.is_active.is_(True))
            .order_by(CycleEntry.period_start_date.desc())
            .limit(1)
        )
        latest = (await self.db.execute(broader)).scalar_one_or_none()
        if latest and latest.cycle_type == "anovulatory":
            return None
        recent = await self._get_recent_entries(user_id, limit=1)
        if recent and recent[0].cycle_type == "anovulatory":
            return None
        try:
            return await self.compute_predictions(user_id)
        except InsufficientDataError:
            logger.warning("cycle.initial_prediction_fallback", extra={"user_id": str(user_id)})
            from app.modules.onboarding.models import UserOnboarding

            stmt = select(UserOnboarding).where(UserOnboarding.user_id == user_id)
            onboarding = (await self.db.execute(stmt)).scalar_one_or_none()
            if onboarding and onboarding.current_cycle_start:
                latest = onboarding.current_cycle_start
                # Derive avg cycle length from gaps between the onboarding start dates.
                raw_starts = [latest] + [
                    p.get("cycle_start") for p in (onboarding.past_cycles or [])
                ]
                starts: list[date] = []
                for s in raw_starts:
                    if isinstance(s, str):
                        s = date.fromisoformat(s)
                    if s is not None:
                        starts.append(s)
                starts = sorted(starts)
                gaps = []
                for a, b in pairwise(starts):
                    gap = (b - a).days
                    if 20 <= gap <= 45:
                        gaps.append(gap)
                avg_cycle = round(median(gaps)) if gaps else 28
            else:
                latest = date.today()
                avg_cycle = 28
            predicted_next = latest + timedelta(days=int(avg_cycle))
            fertile_start = predicted_next - timedelta(days=14)
            fertile_end = fertile_start + timedelta(days=5)
            stmt = select(PredictedCycle).where(PredictedCycle.user_id == user_id)
            existing = (await self.db.execute(stmt)).scalar_one_or_none()
            if existing:
                existing.predicted_next_period_start = predicted_next
                existing.predicted_fertile_window_start = fertile_start
                existing.predicted_fertile_window_end = fertile_end
                existing.model_type = "fallback"
                existing.model_version = "fallback"
                await self.db.commit()
                await self.db.refresh(existing)
                return existing
            prediction = PredictedCycle(
                user_id=user_id,
                predicted_next_period_start=predicted_next,
                predicted_fertile_window_start=fertile_start,
                predicted_fertile_window_end=fertile_end,
                model_type="fallback",
                model_version="fallback",
            )
            self.db.add(prediction)
            await self.db.commit()
            await self.db.refresh(prediction)
            return prediction

    # ---- Correction feedback loop ----

    async def log_correction(
        self,
        user_id: uuid.UUID,
        period_start_date: date,
        period_end_date: date | None = None,
        symptoms: list[str] | None = None,
        corrected_prediction_id: uuid.UUID | None = None,
        client_updated_at: str | None = None,
        cycle_type: str = "menstrual",
        idempotency_key: str | None = None,
    ) -> CycleEntry:
        if client_updated_at:
            latest_stmt = (
                select(CycleEntry)
                .where(CycleEntry.user_id == user_id)
                .where(CycleEntry.is_active.is_(True))
                .order_by(CycleEntry.period_start_date.desc())
                .limit(1)
            )
            latest = (await self.db.execute(latest_stmt)).scalar_one_or_none()
            if latest and hasattr(latest, "created_at") and latest.created_at:
                try:
                    from datetime import datetime as dt

                    client_ts = dt.fromisoformat(client_updated_at.replace("Z", "+00:00"))
                    # Strip tzinfo if server's stored datetime is naive (SQLite)
                    server_ts = latest.created_at
                    if server_ts.tzinfo is None and client_ts.tzinfo is not None:
                        client_ts = client_ts.replace(tzinfo=None)
                    elif server_ts.tzinfo is not None and client_ts.tzinfo is None:
                        client_ts = client_ts.replace(tzinfo=server_ts.tzinfo)
                    if server_ts > client_ts:
                        raise CycleConflictError(
                            "Data has been modified since you last synced. The server has newer data."
                        )
                except (ValueError, TypeError):
                    pass

        existing_stmt = (
            select(CycleEntry)
            .where(CycleEntry.user_id == user_id)
            .where(CycleEntry.period_start_date == period_start_date)
            .where(CycleEntry.is_active.is_(True))
        )
        existing = (await self.db.execute(existing_stmt)).scalar_one_or_none()

        def _apply_to(existing_entry: CycleEntry) -> None:
            if period_end_date is not None:
                existing_entry.period_end_date = period_end_date
            existing_entry.symptoms = symptoms or []
            existing_entry.cycle_type = cycle_type
            if corrected_prediction_id is not None:
                existing_entry.is_correction = True
                existing_entry.corrected_prediction_id = corrected_prediction_id
            if idempotency_key:
                existing_entry.idempotency_key = idempotency_key

        entry: CycleEntry
        if existing is not None:
            entry = existing
            _apply_to(entry)
            try:
                await self.db.flush()
            except IntegrityError:
                await self.db.rollback()
                entry = (await self.db.execute(existing_stmt)).scalar_one()
                _apply_to(entry)
                await self.db.flush()
        else:
            entry = CycleEntry(
                user_id=user_id,
                period_start_date=period_start_date,
                period_end_date=period_end_date,
                symptoms=symptoms or [],
                is_correction=corrected_prediction_id is not None,
                corrected_prediction_id=corrected_prediction_id,
                cycle_type=cycle_type,
                idempotency_key=idempotency_key,
            )
            self.db.add(entry)
            try:
                await self.db.flush()
            except IntegrityError:
                await self.db.rollback()
                existing = (await self.db.execute(existing_stmt)).scalar_one()
                entry = existing
                _apply_to(entry)
                await self.db.flush()

        await self._auto_close_open_entry(user_id, period_start_date)

        if corrected_prediction_id is not None:
            prediction = await self.get_prediction_by_id(corrected_prediction_id, user_id)
            await self.apply_correction_if_needed(entry, prediction)
            cutoff = prediction.predicted_next_period_start - timedelta(days=3)
            if period_start_date < cutoff:
                prediction.checkin_sent = True
            await self.db.flush()

        if entry.cycle_type == "anovulatory":
            await self._suspend_predictions(user_id)

        await self.db.commit()
        await self.db.refresh(entry)

        with suppress(InsufficientDataError):
            await self.compute_predictions(user_id)

        await self._emit_cycle_closed(entry)
        return entry

    async def _auto_close_open_entry(self, user_id: uuid.UUID, period_start: date) -> None:
        """Auto-close any open (NULL end_date) entry that ended before this period started."""
        stmt = (
            select(CycleEntry)
            .where(CycleEntry.user_id == user_id)
            .where(CycleEntry.period_end_date.is_(None))
            .where(CycleEntry.period_start_date < period_start)
            .order_by(CycleEntry.period_start_date.desc())
            .limit(1)
        )
        open_entry = (await self.db.execute(stmt)).scalar_one_or_none()
        if open_entry is not None:
            avg_length = self._compute_average_period_length(
                await self._get_recent_entries(user_id, limit=12)
            )
            open_entry.period_end_date = open_entry.period_start_date + timedelta(
                days=max(avg_length, 1) - 1
            )
            await self.db.flush()

    async def get_prediction_by_id(
        self, prediction_id: uuid.UUID, user_id: uuid.UUID
    ) -> PredictedCycle:
        stmt = (
            select(PredictedCycle)
            .where(PredictedCycle.id == prediction_id)
            .where(PredictedCycle.user_id == user_id)
        )
        prediction = (await self.db.execute(stmt)).scalar_one_or_none()
        if prediction is None:
            raise PredictionNotFoundError("Prediction not found")
        return prediction

    async def get_avg_period_length(self, user_id: uuid.UUID) -> int:
        entries = await self._get_recent_entries(user_id, limit=12)
        return self._compute_average_period_length(entries)

    async def mark_checkin_sent(self, prediction_id: uuid.UUID, user_id: uuid.UUID) -> None:
        prediction = await self.get_prediction_by_id(prediction_id, user_id)
        prediction.checkin_sent = True
        await self.db.commit()

    async def log_snooze(
        self,
        user_id: uuid.UUID,
        predicted_cycle_id: uuid.UUID,
        day_offset: int,
    ) -> SnoozeEvent:
        await self.get_prediction_by_id(predicted_cycle_id, user_id)
        snooze = SnoozeEvent(
            user_id=user_id,
            predicted_cycle_id=predicted_cycle_id,
            day_offset=day_offset,
        )
        self.db.add(snooze)
        await self.db.commit()
        await self.db.refresh(snooze)
        return snooze

    async def _update_user_ml_metrics(self, user_id: uuid.UUID, prediction_error_days: int) -> None:
        from sqlalchemy import select as sa_select

        from app.modules.auth.models import User

        user = (
            await self.db.execute(
                sa_select(User).where(User.id == user_id).where(User.is_active.is_(True))
            )
        ).scalar_one_or_none()
        if user is None:
            return

        old_total = user.total_cycles_logged
        old_avg = user.avg_prediction_error_days or 0.0

        new_total = old_total + 1
        new_avg = (old_avg * old_total + prediction_error_days) / max(new_total, 1)

        user.avg_prediction_error_days = round(new_avg, 2)
        user.total_cycles_logged = new_total
        user.is_dirty_for_retraining = True

        from statistics import stdev

        stmt = (
            sa_select(CycleEntry.period_start_date)
            .where(
                CycleEntry.user_id == user_id,
                CycleEntry.is_active.is_(True),
            )
            .order_by(CycleEntry.period_start_date.asc())
        )
        rows = (await self.db.execute(stmt)).scalars().all()

        if len(rows) >= 2:
            diffs = []
            for i in range(1, len(rows)):
                diffs.append((rows[i] - rows[i - 1]).days)
            avg_intervals = [d for d in diffs if 20 <= d <= 45]
            std_intervals = [d for d in diffs if 15 <= d <= 60]
            if avg_intervals:
                user.avg_cycle_length = round(sum(avg_intervals) / len(avg_intervals), 1)
            if len(std_intervals) >= 2:
                user.cycle_length_std_dev = round(stdev(std_intervals), 1)
            else:
                user.cycle_length_std_dev = None

        await self.db.flush()

    async def get_analytics(self, user_id: uuid.UUID) -> dict:
        stmt = (
            select(CycleEntry)
            .where(CycleEntry.user_id == user_id)
            .where(CycleEntry.is_active.is_(True))
            .where(CycleEntry.period_end_date.isnot(None))
            .order_by(CycleEntry.period_start_date.asc())
        )
        result = await self.db.execute(stmt)
        entries = list(result.scalars().all())

        if not entries:
            return {
                "average_cycle_length_days": None,
                "shortest_cycle_days": None,
                "longest_cycle_days": None,
                "common_symptoms": [],
                "common_moods": [],
                "total_entries": 0,
                "avg_period_length_days": None,
                "cycle_length_std_dev_days": None,
                "avg_ovulation_day": None,
                "avg_sleep_hours": None,
                "avg_pain_level": None,
                "avg_energy_level": None,
            }

        cycle_lengths = []
        period_lengths = []
        for i in range(1, len(entries)):
            diff = (entries[i].period_start_date - entries[i - 1].period_start_date).days
            if 20 <= diff <= 45:
                cycle_lengths.append(diff)
        for e in entries:
            if e.period_end_date:
                period_lengths.append(
                    compute_period_length(e.period_start_date, e.period_end_date, 5)
                )

        symptom_counts: dict[str, int] = {}
        mood_counts: dict[str, int] = {}
        for e in entries:
            for s in e.symptoms or []:
                symptom_counts[str(s)] = symptom_counts.get(str(s), 0) + 1
            for m in e.mood_tags or []:
                mood_counts[str(m)] = mood_counts.get(str(m), 0) + 1

        sorted_symptoms = sorted(symptom_counts.items(), key=lambda x: -x[1])[:10]
        sorted_moods = sorted(mood_counts.items(), key=lambda x: -x[1])[:10]

        # Day-observation aggregations over the same closed-cycle window.
        start = min(e.period_start_date for e in entries)
        day_stmt = (
            select(CycleDay)
            .where(
                CycleDay.user_id == user_id,
                CycleDay.log_date >= start,
            )
        )
        days = list((await self.db.execute(day_stmt)).scalars().all())
        sleep_minutes = [d.sleep_minutes for d in days if d.sleep_minutes is not None]
        pain_levels = [d.pain_level for d in days if d.pain_level is not None]
        energy_levels = [d.energy_level for d in days if d.energy_level is not None]

        if cycle_lengths:
            std_dev = pstdev(cycle_lengths)
            ovulation_day = median(
                max(1, cl - 14) for cl in cycle_lengths
            )
        else:
            std_dev = None
            ovulation_day = None

        return {
            "average_cycle_length_days": median(cycle_lengths) if cycle_lengths else None,
            "shortest_cycle_days": min(cycle_lengths) if cycle_lengths else None,
            "longest_cycle_days": max(cycle_lengths) if cycle_lengths else None,
            "common_symptoms": [{"symptom": k, "count": v} for k, v in sorted_symptoms],
            "common_moods": [{"mood": k, "count": v} for k, v in sorted_moods],
            "total_entries": len(entries),
            "avg_period_length_days": (
                round(sum(period_lengths) / len(period_lengths), 1) if period_lengths else None
            ),
            "cycle_length_std_dev_days": round(std_dev, 1) if std_dev is not None else None,
            "avg_ovulation_day": round(ovulation_day, 1) if ovulation_day is not None else None,
            "avg_sleep_hours": (
                round(sum(sleep_minutes) / len(sleep_minutes) / 60, 1) if sleep_minutes else None
            ),
            "avg_pain_level": (
                round(sum(pain_levels) / len(pain_levels), 1) if pain_levels else None
            ),
            "avg_energy_level": (
                round(sum(energy_levels) / len(energy_levels), 1) if energy_levels else None
            ),
        }

    # ------------------------------------------------------------------
    # Cycle reports (Cycle_Report-as-a-Service plan: generate once, store
    # forever, read many times). Report data is stored per closed cycle.
    # ------------------------------------------------------------------

    MAX_REPORT_CYCLES = 6
    REPORT_LLM_TOP_SYMPTOMS = 5
    REPORT_TOP_OVERALL_SYMPTOMS = 3

    async def get_aggregated_stats(
        self,
        user_id: uuid.UUID,
        entry: CycleEntry,
    ) -> dict[str, Any]:
        """Build a privacy-safe aggregate blob for the report prompt.

        Aggregates the latest up-to-``MAX_REPORT_CYCLES`` closed cycles
        (``period_end_date`` set) PLUS their overlapping day observations.
        NEVER emits dates, notes, latitudes, or PII — only counts/means/freqs.
        ``cycle_days.notes`` stays encrypted and is never read here.
        """
        closed = (
            await self.db.execute(
                select(CycleEntry)
                .where(CycleEntry.user_id == user_id)
                .where(CycleEntry.is_active.is_(True))
                .where(CycleEntry.period_end_date.isnot(None))
                .order_by(CycleEntry.period_start_date.desc())
                .limit(self.MAX_REPORT_CYCLES)
            )
        ).scalars().all()
        if not closed:
            closed = [entry]
        closed_sorted = sorted(closed, key=lambda e: e.period_start_date)

        cycle_lengths: list[float] = []
        for prev, curr in pairwise(closed_sorted):
            diff = (curr.period_start_date - prev.period_start_date).days
            if 20 <= diff <= 45:
                cycle_lengths.append(float(diff))

        period_lengths = [
            float(compute_period_length(e.period_start_date, e.period_end_date))
            for e in closed_sorted
        ]

        start = min(e.period_start_date for e in closed_sorted)
        end = max(e.period_end_date or e.period_start_date for e in closed_sorted)

        day_stmt = (
            select(CycleDay)
            .where(
                CycleDay.user_id == user_id,
                CycleDay.log_date >= start,
                CycleDay.log_date <= end,
            )
            .options(
                selectinload(CycleDay.day_symptoms).selectinload(DaySymptom.symptom),
                selectinload(CycleDay.day_medications),
            )
            .order_by(CycleDay.log_date)
        )
        days = list((await self.db.execute(day_stmt)).scalars().all())

        sleep_minutes: list[int] = []
        pain_levels: list[int] = []
        energy_levels: list[int] = []
        moods: dict[str, int] = {}
        symptoms_by_phase: dict[str, dict[str, int]] = {
            "menstrual": {},
            "follicular": {},
            "ovulation": {},
            "luteal": {},
        }

        for day in days:
            if day.sleep_minutes is not None:
                sleep_minutes.append(day.sleep_minutes)
            if day.pain_level is not None:
                pain_levels.append(day.pain_level)
            if day.energy_level is not None:
                energy_levels.append(day.energy_level)
            if day.mood:
                moods[day.mood] = moods.get(day.mood, 0) + 1

            anchor = self._entry_anchoring(day.log_date, closed_sorted)
            if anchor is None:
                continue
            start_date, _cycle_len = anchor
            cycle_day = (day.log_date - start_date).days + 1
            phase = self._phase_key_for_cycle_day(cycle_day)
            for ds in day.day_symptoms:
                name = ds.symptom.name if ds.symptom else None
                if not name:
                    continue
                bucket = symptoms_by_phase[phase]
                bucket[name] = bucket.get(name, 0) + 1

        def _top_n(counter: dict[str, int], n: int, key: str = "symptom") -> list[dict[str, Any]]:
            top = sorted(counter.items(), key=lambda kv: -kv[1])[:n]
            return [{key: k, "count": v} for k, v in top]

        return {
            "cycles_count": len(closed_sorted),
            "avg_cycle_length_days": (
                round(sum(cycle_lengths) / len(cycle_lengths), 1) if cycle_lengths else None
            ),
            "avg_period_length_days": (
                round(sum(period_lengths) / len(period_lengths), 1) if period_lengths else None
            ),
            "avg_sleep_hours": (
                round(sum(sleep_minutes) / len(sleep_minutes) / 60, 1) if sleep_minutes else None
            ),
            "avg_pain_level": (
                round(sum(pain_levels) / len(pain_levels), 1) if pain_levels else None
            ),
            "avg_energy_level": (
                round(sum(energy_levels) / len(energy_levels), 1) if energy_levels else None
            ),
            "common_moods": _top_n(moods, 5, key="mood"),
            "symptoms_by_phase": {
                phase: _top_n(bucket, self.REPORT_LLM_TOP_SYMPTOMS)
                for phase, bucket in symptoms_by_phase.items()
            },
            "cycle_length_std_dev_days": (
                round(pstdev(cycle_lengths), 1) if len(cycle_lengths) >= 2 else None
            ),
        }

    async def get_cycle_scoped_stats(
        self,
        user_id: uuid.UUID,
        entry: CycleEntry,
    ) -> dict[str, Any]:
        """Privacy-safe aggregate blob scoped to ONE cycle.

        Day observations (sleep/pain/energy/mood/symptoms) are aggregated only
        from THIS cycle's window ``[period_start_date, next_period_start)`` so
        each cycle report is individual. Period length is this entry's own.
        Regularity uses the last up-to-``MAX_REPORT_CYCLES`` intervals ending at
        this cycle (neighborhood), giving a meaningful score vs. std-dev.
        Never emits dates, notes, latitudes, or PII (rules §1.11-1.12).
        """
        closed = (
            (await self.db.execute(
                select(CycleEntry)
                .where(CycleEntry.user_id == user_id)
                .where(CycleEntry.is_active.is_(True))
                .where(CycleEntry.period_end_date.isnot(None))
                .order_by(CycleEntry.period_start_date.asc())
            ))
            .scalars()
            .all()
        )

        before_entry = [e for e in closed if e.period_start_date <= entry.period_start_date]
        neighbors = before_entry[-self.MAX_REPORT_CYCLES :]
        if not neighbors:
            neighbors = [entry]

        prev = before_entry[-2] if len(before_entry) >= 2 else None
        cycle_len: float | None = None
        if prev is not None:
            diff = (entry.period_start_date - prev.period_start_date).days
            if 20 <= diff <= 45:
                cycle_len = float(diff)

        next_start = next(
            (e.period_start_date for e in closed if e.period_start_date > entry.period_start_date),
            None,
        )
        window_start = entry.period_start_date
        window_end = next_start or (entry.period_end_date or entry.period_start_date) + timedelta(days=1)

        day_stmt = (
            select(CycleDay)
            .where(
                CycleDay.user_id == user_id,
                CycleDay.log_date >= window_start,
                CycleDay.log_date < window_end,
            )
            .options(
                selectinload(CycleDay.day_symptoms).selectinload(DaySymptom.symptom),
                selectinload(CycleDay.day_medications),
            )
            .order_by(CycleDay.log_date)
        )
        days = list((await self.db.execute(day_stmt)).scalars().all())

        sleep_minutes: list[int] = []
        pain_levels: list[int] = []
        energy_levels: list[int] = []
        moods: dict[str, int] = {}
        symptoms_by_phase: dict[str, dict[str, int]] = {
            "menstrual": {},
            "follicular": {},
            "ovulation": {},
            "luteal": {},
        }

        for day in days:
            if day.sleep_minutes is not None:
                sleep_minutes.append(day.sleep_minutes)
            if day.pain_level is not None:
                pain_levels.append(day.pain_level)
            if day.energy_level is not None:
                energy_levels.append(day.energy_level)
            if day.mood:
                moods[day.mood] = moods.get(day.mood, 0) + 1

            cycle_day = (day.log_date - window_start).days + 1
            phase = self._phase_key_for_cycle_day(cycle_day)
            for ds in day.day_symptoms:
                name = ds.symptom.name if ds.symptom else None
                if not name:
                    continue
                bucket = symptoms_by_phase[phase]
                bucket[name] = bucket.get(name, 0) + 1

        neighborhood_lengths: list[float] = []
        for prev_e, curr_e in pairwise(neighbors):
            diff = (curr_e.period_start_date - prev_e.period_start_date).days
            if 20 <= diff <= 45:
                neighborhood_lengths.append(float(diff))

        this_period_length = compute_period_length(
            entry.period_start_date,
            entry.period_end_date,
        )

        def _top_n(counter: dict[str, int], n: int, key: str = "symptom") -> list[dict[str, Any]]:
            top = sorted(counter.items(), key=lambda kv: -kv[1])[:n]
            return [{key: k, "count": v} for k, v in top]

        return {
            "cycles_count": len(neighbors),
            "avg_cycle_length_days": (
                round(sum(neighborhood_lengths) / len(neighborhood_lengths), 1)
                if neighborhood_lengths
                else cycle_len
            ),
            "avg_period_length_days": (
                round(this_period_length, 1) if this_period_length else None
            ),
            "avg_sleep_hours": (
                round(sum(sleep_minutes) / len(sleep_minutes) / 60, 1) if sleep_minutes else None
            ),
            "avg_pain_level": (
                round(sum(pain_levels) / len(pain_levels), 1) if pain_levels else None
            ),
            "avg_energy_level": (
                round(sum(energy_levels) / len(energy_levels), 1) if energy_levels else None
            ),
            "common_moods": _top_n(moods, 5, key="mood"),
            "symptoms_by_phase": {
                phase: _top_n(bucket, self.REPORT_LLM_TOP_SYMPTOMS)
                for phase, bucket in symptoms_by_phase.items()
            },
            "cycle_length_std_dev_days": (
                round(pstdev(neighborhood_lengths), 1)
                if len(neighborhood_lengths) >= 2
                else None
            ),
        }

    @staticmethod
    def _entry_anchoring(
        log_date: date,
        closed_sorted: list[CycleEntry],
    ) -> tuple[date, int] | None:
        """Return (period_start, cycle_length) anchoring the day to its cycle.

        Finds the closed cycle whose [start, next_start) window contains
        ``log_date`` and uses that pair's inter-start interval as its length.
        """
        if not closed_sorted:
            return None
        cycle_len = 28
        found: CycleEntry | None = None
        for i, entry in enumerate(closed_sorted):
            next_start = (
                closed_sorted[i + 1].period_start_date
                if i + 1 < len(closed_sorted)
                else None
            )
            window_end = next_start or (entry.period_end_date or entry.period_start_date)
            if entry.period_start_date <= log_date < window_end + timedelta(days=1):
                found = entry
                if next_start is not None:
                    diff = (next_start - entry.period_start_date).days
                    if 20 <= diff <= 45:
                        cycle_len = diff
                break
        if found is None:
            return None
        return found.period_start_date, cycle_len

    @staticmethod
    def _phase_key_for_cycle_day(cycle_day: int) -> str:
        """Match mobile cyclePhases.ts canonical keys (menstrual 1-5, follicular
        6-13, ovulation 14-15, luteal 16-28)."""
        if cycle_day <= 5:
            return "menstrual"
        if cycle_day <= 13:
            return "follicular"
        if cycle_day <= 15:
            return "ovulation"
        return "luteal"

    async def build_rule_based_report(self, stats: dict[str, Any]) -> ReportData:
        """Deterministic fallback — usable with zero API keys/cost."""
        n = int(stats.get("cycles_count") or 0)
        avg = stats.get("avg_cycle_length_days")
        std = stats.get("cycle_length_std_dev_days")

        if std is not None:
            regularity_score = max(0, min(100, round(100 - std * 5)))
        elif avg is not None and n >= 2:
            regularity_score = 70
        else:
            regularity_score = min(100, n * 20)

        merged_symptoms: dict[str, int] = {}
        for bucket in (stats.get("symptoms_by_phase") or {}).values():
            for item in bucket:
                name = item.get("symptom")
                if name:
                    merged_symptoms[name] = merged_symptoms.get(name, 0) + int(item.get("count", 0))
        top_symptoms = [
            k for k, _ in sorted(merged_symptoms.items(), key=lambda kv: -kv[1])
        ][: self.REPORT_TOP_OVERALL_SYMPTOMS]

        if n == 0:
            summary = "Not enough cycle data yet to identify patterns."
        elif avg is None:
            summary = f"Over your last {n} cycle(s), no consistent length has emerged yet."
        else:
            summary = (
                f"Your last {n} cycle(s) average {avg} days "
                + ("with a regular rhythm." if (std is not None and std <= 2) else "with some variability.")
            )
        if top_symptoms:
            summary += f" Frequent symptoms include {', '.join(top_symptoms)}."

        avg_sleep = stats.get("avg_sleep_hours")
        avg_pain = stats.get("avg_pain_level")
        if avg_sleep is not None and avg_pain is not None and avg_pain >= 4 and avg_sleep < 6.5:
            correlation = "Higher pain days tended to pair with less sleep."
        elif avg_sleep is not None and avg_sleep < 6.5:
            correlation = "Average sleep was under 6.5h; consider earlier wind-down."
        elif avg_pain is not None and avg_pain >= 4:
            correlation = "Average pain was elevated; gentle movement may help."
        else:
            correlation = "No strong sleep-energy correlation found yet."

        return ReportData(
            summary=summary,
            regularity_score=regularity_score,
            top_symptoms=top_symptoms,
            correlation_found=correlation,
            doctor_note=(
                "These are informational observations, not medical advice. "
                "Consult a healthcare provider for any persistent symptoms."
            ),
            avg_cycle_length_days=stats.get("avg_cycle_length_days"),
            avg_period_length_days=stats.get("avg_period_length_days"),
            avg_sleep_hours=avg_sleep,
            avg_pain_level=avg_pain,
            common_moods=stats.get("common_moods") or [],
        )

    @staticmethod
    def _build_llm_prompt(stats: dict[str, Any]) -> str:
        return (
            "Here is the user's aggregated cycle data (no dates, notes, or PII):\n"
            + json.dumps(stats)
            + "\nReturn ONLY valid JSON matching keys: summary, regularity_score "
            "(integer 0-100), top_symptoms (array), correlation_found, doctor_note, "
            "and optionally avg_cycle_length_days, avg_period_length_days, "
            "avg_sleep_hours, avg_pain_level, common_moods (array of "
            '{"mood": "<name>", "count": <int>}).'
        )

    async def generate_report(self, user_id: uuid.UUID, cycle_entry_id: uuid.UUID) -> CycleReport:
        """Orchestrate aggregation -> LLM (or rule-based fallback) -> store.

        Idempotent on unique ``cycle_entry_id``: a second run upserts the same
        row. LLM/validation failures never store partial/garbage — they fall
        back to the rule-based generator (rule §1.6).
        """
        entry = await self.get_entry(cycle_entry_id, user_id)
        stats = await self.get_cycle_scoped_stats(user_id, entry)

        report_data: ReportData
        try:
            text = await GroqClient(get_settings().groq).generate_report(
                self._build_llm_prompt(stats)
            )
            if text:
                report_data = ReportData.model_validate_json(text)
            else:
                report_data = await self.build_rule_based_report(stats)
        except (GroqError, PydanticValidationError, ValueError, TypeError) as exc:
            logger.warning(
                "cycle.report_llm_fallback",
                extra={"user_id": str(user_id), "cycle_entry_id": str(cycle_entry_id), "error": str(exc)},
            )
            report_data = await self.build_rule_based_report(stats)

        existing = await self._get_report_for_entry(user_id, cycle_entry_id)
        if existing is None:
            existing = CycleReport(
                user_id=user_id,
                cycle_entry_id=cycle_entry_id,
                status="ready",
                report_data=report_data.model_dump(mode="json"),
                generated_at=datetime.now(UTC),
            )
            self.db.add(existing)
        else:
            existing.status = "ready"
            existing.report_data = report_data.model_dump(mode="json")
            existing.generated_at = datetime.now(UTC)
            existing.is_active = True
        await self.db.commit()
        await self.db.refresh(existing)
        return existing

    async def get_report_for_entry(
        self,
        user_id: uuid.UUID,
        cycle_entry_id: uuid.UUID,
    ) -> CycleReport | None:
        """Return the stored report for one cycle — pure DB read, no LLM."""
        return await self._get_report_for_entry(user_id, cycle_entry_id)

    async def _get_report_for_entry(
        self,
        user_id: uuid.UUID,
        cycle_entry_id: uuid.UUID,
    ) -> CycleReport | None:
        stmt = (
            select(CycleReport)
            .where(CycleReport.user_id == user_id)
            .where(CycleReport.cycle_entry_id == cycle_entry_id)
            .order_by(CycleReport.generated_at.desc())
            .limit(1)
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def get_latest_report(self, user_id: uuid.UUID) -> CycleReport | None:
        stmt = (
            select(CycleReport)
            .where(CycleReport.user_id == user_id)
            .where(CycleReport.is_active.is_(True))
            .where(CycleReport.status == "ready")
            .order_by(CycleReport.generated_at.desc())
            .limit(1)
        )
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def get_or_create_pending_report(
        self,
        user_id: uuid.UUID,
        cycle_entry_id: uuid.UUID,
    ) -> CycleReport:
        """Return an existing report row, else create a ``pending`` stub.

        Used by POST /reports so the route never touches the DB directly.
        """
        existing = await self._get_report_for_entry(user_id, cycle_entry_id)
        if existing is not None:
            return existing
        report = CycleReport(
            user_id=user_id,
            cycle_entry_id=cycle_entry_id,
            status="pending",
        )
        self.db.add(report)
        await self.db.commit()
        await self.db.refresh(report)
        return report

    # ---- Day observations (cycle_days) ----

    async def _get_day(self, user_id: uuid.UUID, log_date: date) -> CycleDay | None:
        stmt = select(CycleDay).where(CycleDay.user_id == user_id, CycleDay.log_date == log_date)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def _get_symptom_by_name(self, name: str) -> Symptom | None:
        stmt = select(Symptom).where(Symptom.name == name)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def _get_medication_by_name(self, name: str) -> Medication | None:
        stmt = select(Medication).where(Medication.name == name)
        return (await self.db.execute(stmt)).scalar_one_or_none()

    async def upsert_day(
        self,
        user_id: uuid.UUID,
        log_date: date,
        data: DayUpsert,
        user_salt: str | None = None,
    ) -> CycleDay:
        """Upsert a day's observations (replace semantics for symptoms/medications).

        Row-scoped to ``user_id`` (rule §1.12). ``notes`` is encrypted in the
        service layer and never sent to Celery for sentiment analysis. On any
        join replacement the parent row's ``updated_at`` AND ``client_updated_at``
        are bumped so the sync engine detects the change (§13.3).
        """
        dump = data.model_dump(exclude_unset=True)

        day = await self._get_day(user_id, log_date)
        if day is None:
            day = CycleDay(user_id=user_id, log_date=log_date)
            self.db.add(day)

        for field in (
            "mood",
            "mood_intensity",
            "pain_level",
            "energy_level",
            "sleep_minutes",
            "water_glasses",
            "flow_level",
            "recommendations_completed",
        ):
            if field in dump:
                setattr(day, field, dump[field])

        if "notes" in dump:
            raw_notes = dump["notes"] or ""
            day.notes = self.encryption.encrypt_for_user(raw_notes, user_salt or "")

        if "symptoms" in dump:
            await self._merge_day_symptoms(day, dump["symptoms"])

        if "medications" in dump:
            await self._merge_day_medications(day, dump["medications"])

        # Gotcha §13.3: parent timestamps drive offline sync detection.
        day.updated_at = datetime.now(tz=UTC)
        day.client_updated_at = datetime.now(tz=UTC)

        try:
            await self.db.commit()
        except IntegrityError as exc:
            await self.db.rollback()
            raise CycleConflictError("Could not save this day's log") from exc

        # Reload with relationships so the response carries symptom/medication
        # details (bare refresh() does not reload selectin relationships).
        stmt = (
            select(CycleDay)
            .where(CycleDay.id == day.id)
            .options(
                selectinload(CycleDay.day_symptoms).selectinload(DaySymptom.symptom),
                selectinload(CycleDay.day_medications).selectinload(DayMedication.medication),
            )
        )
        day = (await self.db.execute(stmt)).scalar_one()

        # Return plaintext notes in the response; ciphertext stays at rest.
        if user_salt and day.notes:
            try:
                day.notes = self.encryption.decrypt_for_user(day.notes, user_salt)
            except EncryptionError:
                day.notes = None

        # Bridge to wellness: the Wellness tab reads mood_logs (NOT cycle_days).
        # Emitted on the event bus so subscriber module (wellness) owns that table.
        if day.mood is not None:
            await event_bus.emit(
                "day_logged",
                user_id=str(user_id),
                log_date=log_date.isoformat(),
                mood=day.mood,
                mood_intensity=day.mood_intensity,
                notes=dump.get("notes") or "",
            )

        return day

    async def _merge_day_symptoms(self, day: CycleDay, items: list) -> None:
        """Merge incoming symptoms into an existing day's collection.

        Updates severity for already-present symptoms, adds new ones, and
        removes any not in the incoming list.  The unique_day_symptom DB
        constraint stays as the final safety net.
        """
        await self._load_day_joins(day)

        # symptom_id → existing DaySymptom object
        existing: dict[uuid.UUID, DaySymptom] = {
            ds.symptom_id: ds for ds in day.day_symptoms
        }

        incoming_ids: set[uuid.UUID] = set()

        for item in items:
            if isinstance(item, dict):
                symptom_name = item.get("symptom")
                severity = item.get("severity", 3)
            else:
                symptom_name = getattr(item, "symptom", None)
                severity = getattr(item, "severity", 3)
            if not symptom_name:
                continue
            sym = await self._get_symptom_by_name(symptom_name)
            if sym is None:
                logger.info(
                    "cycle.day_unknown_symptom",
                    extra={"symptom": symptom_name},
                )
                continue

            incoming_ids.add(sym.id)
            if sym.id in existing:
                # Update severity in-place — no new row, no unique conflict.
                existing[sym.id].severity = severity
            else:
                day.day_symptoms.append(
                    DaySymptom(symptom_id=sym.id, severity=severity)
                )

        # Remove symptoms the user no longer has (delete-orphan cascade handles DB).
        for sym_id, ds in list(existing.items()):
            if sym_id not in incoming_ids:
                day.day_symptoms.remove(ds)

    async def _merge_day_medications(self, day: CycleDay, items: list) -> None:
        """Merge incoming medications into an existing day's collection.

        Same logic as _merge_day_symptoms but for the medications join.
        """
        await self._load_day_joins(day)

        existing: dict[uuid.UUID, DayMedication] = {
            dm.medication_id: dm for dm in day.day_medications
        }

        incoming_ids: set[uuid.UUID] = set()

        for item in items:
            if isinstance(item, dict):
                name = item.get("name")
                dose = item.get("dose")
                taken_at = item.get("taken_at")
            else:
                name = getattr(item, "name", None)
                dose = getattr(item, "dose", None)
                taken_at = getattr(item, "taken_at", None)
            if not name:
                continue
            med = await self._get_medication_by_name(name)
            if med is None:
                logger.info(
                    "cycle.day_unknown_medication",
                    extra={"medication": name},
                )
                continue

            incoming_ids.add(med.id)
            if med.id in existing:
                existing[med.id].dose = dose
                existing[med.id].taken_at = taken_at
            else:
                day.day_medications.append(
                    DayMedication(
                        medication_id=med.id,
                        dose=dose,
                        taken_at=taken_at,
                    )
                )

        for med_id, dm in list(existing.items()):
            if med_id not in incoming_ids:
                day.day_medications.remove(dm)

    async def _load_day_joins(self, day: CycleDay) -> None:
        """Materialize a day's selectin collections in async context.

        After the day is flushed (autoflush from the master lookups) its selectin
        collections are unloaded; assigning to them would trigger a sync
        lazy-load (MissingGreenlet). A selectinload query here populates them
        greenlet-safe so the later relationship assignment is pure in-memory and
        the delete-orphan cascade does the replace.
        """
        if day.id is None:
            await self.db.flush()
        await self.db.execute(
            select(CycleDay)
            .where(CycleDay.id == day.id)
            .options(
                selectinload(CycleDay.day_symptoms),
                selectinload(CycleDay.day_medications),
            )
        )

    async def list_days(
        self,
        user_id: uuid.UUID,
        start: date,
        end: date,
        user_salt: str | None = None,
    ) -> list[CycleDay]:
        """List a user's day observations within [start, end], notes decrypted."""
        stmt = (
            select(CycleDay)
            .where(
                CycleDay.user_id == user_id,
                CycleDay.log_date >= start,
                CycleDay.log_date <= end,
            )
            .options(
                selectinload(CycleDay.day_symptoms).selectinload(DaySymptom.symptom),
                selectinload(CycleDay.day_medications).selectinload(DayMedication.medication),
            )
            .order_by(CycleDay.log_date)
        )
        days = list((await self.db.execute(stmt)).scalars().all())
        if user_salt:
            for day in days:
                if day.notes:
                    try:
                        day.notes = self.encryption.decrypt_for_user(day.notes, user_salt)
                    except EncryptionError:
                        day.notes = None
        return days

    async def list_symptoms(self) -> list[Symptom]:
        stmt = (
            select(Symptom)
            .where(Symptom.is_active.is_(True))
            .order_by(Symptom.display_order, Symptom.name)
        )
        return list((await self.db.execute(stmt)).scalars().all())

    async def list_medications(self) -> list[Medication]:
        stmt = (
            select(Medication)
            .where(Medication.is_active.is_(True))
            .order_by(Medication.display_order, Medication.name)
        )
        return list((await self.db.execute(stmt)).scalars().all())
