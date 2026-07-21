"""Cycle tracking service: CRUD, predictions, calendar, analytics (plan 07, Phase 2)."""

from __future__ import annotations

import logging
import os
import uuid
from datetime import date, timedelta
from statistics import median

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
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
from app.modules.cycle.models import CycleEntry, PredictedCycle, SnoozeEvent, SystemConfig
from app.modules.cycle.phase_utils import calculate_cycle_phases, compute_period_length
from app.modules.cycle.schemas import CycleEntryCreate, CycleEntryUpdate

logger = logging.getLogger("app.modules.cycle")


class CycleService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

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
        avg_length = self._compute_average_period_length(entries) if entries else get_settings().cycle.period_default_length
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
            return existing
        await self.db.refresh(entry)
        await self._try_auto_link_prediction(user_id, entry)
        await self._auto_close_open_entry(user_id, data.period_start_date)
        return entry

    async def _try_auto_link_prediction(self, user_id: uuid.UUID, entry: CycleEntry) -> None:
        window = get_settings().cycle.auto_link_window_days
        stmt = (
            select(PredictedCycle)
            .where(PredictedCycle.user_id == user_id)
            .where(PredictedCycle.is_active.is_(True))
            .where(PredictedCycle.actual_cycle_entry_id.is_(None))
            .order_by(PredictedCycle.predicted_next_period_start.asc())
        )
        predictions = (await self.db.execute(stmt)).scalars().all()
        for pred in predictions:
            diff = (entry.period_start_date - pred.predicted_next_period_start).days
            if -window <= diff <= window:
                pred.actual_cycle_entry_id = entry.id
                pred.prediction_error_days = diff
                entry.is_correction = True
                entry.corrected_prediction_id = pred.id
                await self.db.flush()
                await self._update_user_ml_metrics(user_id, diff)
                break

    async def _get_entry_by_user_and_date(self, user_id: uuid.UUID, period_start: date) -> CycleEntry:
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
        self, user_id: uuid.UUID, limit: int = 50, offset: int = 0, months_back: int = 6,
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
        self, entry_id: uuid.UUID, user_id: uuid.UUID, data: CycleEntryUpdate,
    ) -> CycleEntry:
        entry = await self.get_entry(entry_id, user_id)
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(entry, key, value)
        await self.db.commit()
        await self.db.refresh(entry)
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
        self, user: object, entries: list[CycleEntry], model: dict | None = None,
    ) -> PredictionResult:
        from app.modules.auth.models import User
        from app.modules.onboarding.models import UserOnboarding
        u = user if isinstance(user, User) else None
        start_dates = [e.period_start_date for e in entries]
        cycle_lengths = self._compute_cycle_lengths(entries)
        period_lengths = [compute_period_length(e.period_start_date, e.period_end_date, 5) for e in entries]

        avg_cycle = (u.avg_cycle_length or median(cycle_lengths)) if cycle_lengths else 28

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
        user_trend_slope = u.trend_slope if u and hasattr(u, 'trend_slope') else None

        if model is None:
            return self._predict_with_fallback(entries, u)

        predicted_length, confidence = apply_global_model(
            model,
            user_avg_cycle=avg_cycle,
            user_std_cycle=u.cycle_length_std_dev if u else None,
            user_trend_slope=user_trend_slope,
            user_avg_error=u.avg_prediction_error_days if u else None,
            user_age_bucket_ordinal=age_bucket_ordinal,
            user_bmi_bucket_ordinal=user_bmi_bucket_ordinal,
            user_stress_level=user_stress_level,
            user_avg_period_length=float(median(period_lengths)) if period_lengths else 5,
        )

        latest_start = max(start_dates)
        next_start = latest_start + timedelta(days=predicted_length)
        next_end = next_start + timedelta(
            days=int(median(period_lengths)) if period_lengths else 5
        )
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
        self, entries: list[CycleEntry], user: object | None,
    ) -> PredictionResult:
        start_dates = [e.period_start_date for e in entries]
        cycle_lengths = self._compute_cycle_lengths(entries)
        period_lengths = [compute_period_length(e.period_start_date, e.period_end_date, 5) for e in entries]

        from app.modules.auth.models import User
        u = user if isinstance(user, User) else None
        avg_error = u.avg_prediction_error_days if u else None

        predicted_length, confidence, window = fallback_prediction(cycle_lengths, avg_error)

        latest_start = max(start_dates)
        next_start = latest_start + timedelta(days=predicted_length)
        next_end = next_start + timedelta(
            days=int(median(period_lengths)) if period_lengths else 5
        )
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
        self, user_id: uuid.UUID, result: PredictionResult,
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
        stmt = (
            select(PredictedCycle)
            .where(PredictedCycle.user_id == user_id)
            .where(PredictedCycle.is_active.is_(True))
            .order_by(PredictedCycle.predicted_next_period_start.asc())
        )
        latest = (await self.db.execute(stmt)).scalar_one_or_none()
        if latest is None:
            entries = await self._get_recent_entries(user_id, limit=1)
            if entries:
                try:
                    await self.compute_predictions(user_id)
                    latest = (await self.db.execute(stmt)).scalar_one_or_none()
                except InsufficientDataError:
                    pass
        return latest

    async def get_prediction_history(
        self, user_id: uuid.UUID, limit: int = 12,
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
            history.append({
                "id": str(p.id),
                "month": pred_month,
                "predicted_date": p.predicted_next_period_start.isoformat(),
                "actual_date": actual_date.isoformat() if actual_date else None,
                "delta_days": p.prediction_error_days,
                "on_time": p.prediction_error_days is not None and abs(p.prediction_error_days) <= 1,
            })

        return history

    # ---- Calendar (Phase 2: dictionary-encoded) ----

    async def get_calendar(
        self, user_id: uuid.UUID, months_back: int = 3, months_forward: int = 3,
    ) -> dict:
        start = date.today() - timedelta(days=months_back * 30)
        end = date.today() + timedelta(days=months_forward * 30)
        today_ref = date.today()
        today_str = today_ref.isoformat()

        entries_stmt = (
            select(CycleEntry)
            .where(CycleEntry.user_id == user_id)
            .where(CycleEntry.period_start_date >= start)
            .where(CycleEntry.period_start_date <= end)
            .where(CycleEntry.is_active.is_(True))
            .order_by(CycleEntry.period_start_date.asc())
        )
        entries = (await self.db.execute(entries_stmt)).scalars().all()

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

        avg_period_length = self._compute_average_period_length(entries)
        cycle_lengths = [
            (entries[i + 1].period_start_date - entries[i].period_start_date).days
            for i in range(len(entries) - 1)
            if 20 <= (entries[i + 1].period_start_date - entries[i].period_start_date).days <= 45
        ]
        avg_cycle_length = round(median(cycle_lengths)) if cycle_lengths else 28

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
            phases = calculate_cycle_phases(pred.predicted_next_period_start, cycle_len, avg_period_length)
            for d in self._iter_date_range(phases["period_start"], phases["period_end"]):
                key = d.isoformat()
                if key not in days:
                    days[key] = "c"

        for i, pred in enumerate(active_preds):
            cycle_len = self._pred_cycle_length(active_preds, i, avg_cycle_length)
            phases = calculate_cycle_phases(pred.predicted_next_period_start, cycle_len, avg_period_length)
            self._apply_predicted_phases(days, phases)

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
                "confidence_label": confidence_label(first.confidence_score) if first.confidence_score else None,
                "training_data_points": first.training_data_points or 0,
                "prediction_window_days": first.prediction_window_days,
            }
            next_period_in_days = (first.predicted_next_period_start - today_ref).days

        needs_checkin = False
        if predictions:
            active_pred = predictions[0]
            if active_pred.actual_cycle_entry_id is None:
                pred_date = active_pred.predicted_next_period_start
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

        return {
            "days": days,
            "predictions": prediction_detail,
            "next_period_in_days": max(0, next_period_in_days) if next_period_in_days is not None else None,
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
        for d in CycleService._iter_date_range(phases["fertile_start"], phases["fertile_end"]):
            key = d.isoformat()
            if key not in days:
                days[key] = "F"
        ov_key = phases["ovulation_date"].isoformat()
        if ov_key not in days:
            days[ov_key] = "O"
        for d in CycleService._iter_date_range(phases["luteal_start"], phases["luteal_end"]):
            key = d.isoformat()
            if key not in days:
                days[key] = "L"

    @staticmethod
    def _apply_pending_phases(days: dict[str, str], phases: dict[str, date], confirmed_start: date) -> None:
        for d in CycleService._iter_date_range(phases["period_start"], phases["period_end"]):
            key = d.isoformat()
            if d == confirmed_start:
                days[key] = "P"
            elif key not in days:
                days[key] = "u"

    @staticmethod
    def _apply_predicted_phases(days: dict[str, str], phases: dict[str, date]) -> None:
        for d in CycleService._iter_date_range(phases["period_start"], phases["period_end"]):
            key = d.isoformat()
            if key not in days:
                days[key] = "p"
        for d in CycleService._iter_date_range(phases["fertile_start"], phases["fertile_end"]):
            key = d.isoformat()
            if key not in days:
                days[key] = "f"
        ov_key = phases["ovulation_date"].isoformat()
        if ov_key not in days:
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
            gap = (predictions[index + 1].predicted_next_period_start - predictions[index].predicted_next_period_start).days
            if 20 <= gap <= 45:
                return gap
        return fallback

    @staticmethod
    def _entry_period_length(entry: CycleEntry, fallback: int) -> int:
        return compute_period_length(entry.period_start_date, entry.period_end_date, fallback)

    # ---- Analytics ----

    async def compute_initial_prediction(self, user_id: uuid.UUID) -> PredictedCycle | None:
        try:
            return await self.compute_predictions(user_id)
        except InsufficientDataError:
            logger.warning("cycle.initial_prediction_fallback", extra={"user_id": str(user_id)})
            from app.modules.onboarding.models import UserOnboarding
            stmt = select(UserOnboarding).where(UserOnboarding.user_id == user_id)
            onboarding = (await self.db.execute(stmt)).scalar_one_or_none()
            if onboarding and onboarding.current_cycle_start:
                latest = onboarding.current_cycle_start
                avg_cycle = onboarding.current_cycle_length or 28
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
            if latest and hasattr(latest, 'created_at') and latest.created_at:
                try:
                    from datetime import datetime as dt
                    client_ts = dt.fromisoformat(client_updated_at.replace("Z", "+00:00"))
                    if latest.created_at > client_ts:
                        raise CycleConflictError(
                            "Data has been modified since you last synced. The server has newer data."
                        )
                except (ValueError, TypeError):
                    pass

        entry = CycleEntry(
            user_id=user_id,
            period_start_date=period_start_date,
            period_end_date=period_end_date,
            symptoms=symptoms or [],
            is_correction=corrected_prediction_id is not None,
            corrected_prediction_id=corrected_prediction_id,
        )
        self.db.add(entry)
        await self.db.flush()

        await self._auto_close_open_entry(user_id, period_start_date)

        if corrected_prediction_id is not None:
            prediction = await self.get_prediction_by_id(corrected_prediction_id, user_id)
            error = (period_start_date - prediction.predicted_next_period_start).days
            prediction.actual_cycle_entry_id = entry.id
            prediction.prediction_error_days = error
            cutoff = prediction.predicted_next_period_start - timedelta(days=3)
            if period_start_date < cutoff:
                prediction.checkin_sent = True
            await self.db.flush()
            await self._update_user_ml_metrics(user_id, error)

        await self.db.commit()
        await self.db.refresh(entry)

        try:
            await self.compute_predictions(user_id)
        except InsufficientDataError:
            pass

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

    async def get_prediction_by_id(self, prediction_id: uuid.UUID, user_id: uuid.UUID) -> PredictedCycle:
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

        stmt = sa_select(CycleEntry.period_start_date).where(
            CycleEntry.user_id == user_id,
            CycleEntry.is_active.is_(True),
        ).order_by(CycleEntry.period_start_date.asc())
        rows = (await self.db.execute(stmt)).scalars().all()

        if len(rows) >= 2:
            intervals = []
            for i in range(1, len(rows)):
                diff = (rows[i] - rows[i - 1]).days
                if 20 <= diff <= 45:
                    intervals.append(diff)
            if intervals:
                user.avg_cycle_length = round(sum(intervals) / len(intervals), 1)
                if len(intervals) >= 2:
                    user.cycle_length_std_dev = round(stdev(intervals), 1)
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
            }

        cycle_lengths = []
        for i in range(1, len(entries)):
            diff = (entries[i].period_start_date - entries[i - 1].period_start_date).days
            if 20 <= diff <= 45:
                cycle_lengths.append(diff)

        symptom_counts: dict[str, int] = {}
        mood_counts: dict[str, int] = {}
        for e in entries:
            for s in (e.symptoms or []):
                symptom_counts[str(s)] = symptom_counts.get(str(s), 0) + 1
            for m in (e.mood_tags or []):
                mood_counts[str(m)] = mood_counts.get(str(m), 0) + 1

        sorted_symptoms = sorted(symptom_counts.items(), key=lambda x: -x[1])[:10]
        sorted_moods = sorted(mood_counts.items(), key=lambda x: -x[1])[:10]

        return {
            "average_cycle_length_days": median(cycle_lengths) if cycle_lengths else None,
            "shortest_cycle_days": min(cycle_lengths) if cycle_lengths else None,
            "longest_cycle_days": max(cycle_lengths) if cycle_lengths else None,
            "common_symptoms": [{"symptom": k, "count": v} for k, v in sorted_symptoms],
            "common_moods": [{"mood": k, "count": v} for k, v in sorted_moods],
            "total_entries": len(entries),
        }
