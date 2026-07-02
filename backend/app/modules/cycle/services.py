"""Cycle tracking service: CRUD, predictions, calendar, analytics (plan 07, Phase 2)."""

from __future__ import annotations

import copy
import logging
import os
import uuid
from datetime import date, timedelta
from statistics import median

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.integrations.prediction_engine import (
    PROD_DIR,
    CyclePredictor,
    PredictionResult,
    apply_global_model,
    confidence_label,
)
from app.modules.cycle.exceptions import (
    CycleEntryNotFoundError,
    InsufficientDataError,
    PredictionNotFoundError,
)
from app.modules.cycle.models import CycleEntry, PredictedCycle, SnoozeEvent, SystemConfig
from app.modules.cycle.schemas import CycleEntryCreate, CycleEntryUpdate

logger = logging.getLogger("app.modules.cycle")


class CycleService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ---- CRUD ----

    async def create_entry(self, user_id: uuid.UUID, data: CycleEntryCreate) -> CycleEntry:
        entry = CycleEntry(
            user_id=user_id,
            period_start_date=data.period_start_date,
            period_end_date=data.period_end_date,
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
            update_data = data.model_dump(exclude_unset=True, exclude={"period_start_date"})
            for key, value in update_data.items():
                setattr(existing, key, value)
            await self.db.commit()
            await self.db.refresh(existing)
            return existing
        await self.db.refresh(entry)
        return entry

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

        if user_obj and user_obj.total_cycles_logged >= 10 and await self._global_model_exists():
            result = await self._predict_with_global_model(user_obj, entries)
        else:
            result = self._predict_with_fallback(entries, user_obj)

        return await self._upsert_prediction(user_id, result)

    async def _global_model_exists(self) -> bool:
        try:
            stmt = select(SystemConfig.value).where(SystemConfig.key == "global_model_path")
            config = (await self.db.execute(stmt)).scalar_one_or_none()
            if not config:
                return False
            path = os.path.join(PROD_DIR, config)
            return os.path.exists(path)
        except Exception:
            return False

    async def _predict_with_global_model(
        self, user: object, entries: list[CycleEntry],
    ) -> PredictionResult:
        from app.modules.auth.models import User
        from app.modules.onboarding.models import UserOnboarding
        u = user if isinstance(user, User) else None
        start_dates = [e.period_start_date for e in entries]
        cycle_lengths = self._compute_cycle_lengths(entries)
        period_lengths = [e.period_length or 5 for e in entries]

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

        model = await self._load_active_model()
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
        period_lengths = [
            (e.period_end_date - e.period_start_date).days
            if e.period_end_date else 5
            for e in entries
        ]

        from app.modules.auth.models import User
        u = user if isinstance(user, User) else None

        predictor = CyclePredictor()
        return predictor.predict(
            start_dates, cycle_lengths, period_lengths,
            std_dev=u.cycle_length_std_dev if u else None,
            avg_error=u.avg_prediction_error_days if u else None,
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
        stmt = select(PredictedCycle).where(PredictedCycle.user_id == user_id)
        existing = (await self.db.execute(stmt)).scalar_one_or_none()

        model_type = result.model_used
        data_points = result.data_points

        if existing:
            existing.predicted_next_period_start = result.next_period_start
            existing.predicted_fertile_window_start = result.fertile_window_start
            existing.predicted_fertile_window_end = result.fertile_window_end
            existing.model_type = model_type
            existing.model_version = model_type
            existing.confidence_score = result.confidence
            existing.training_data_points = data_points
            existing.prediction_window_days = result.prediction_window_days
            await self.db.commit()
            await self.db.refresh(existing)
            return existing
        else:
            prediction = PredictedCycle(
                user_id=user_id,
                predicted_next_period_start=result.next_period_start,
                predicted_fertile_window_start=result.fertile_window_start,
                predicted_fertile_window_end=result.fertile_window_end,
                model_type=model_type,
                model_version=model_type,
                confidence_score=result.confidence,
                training_data_points=data_points,
                prediction_window_days=result.prediction_window_days,
            )
            self.db.add(prediction)
            await self.db.commit()
            await self.db.refresh(prediction)
            return prediction

    # ---- Get predictions ----

    async def get_predictions(self, user_id: uuid.UUID) -> list[PredictedCycle]:
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
            if latest is None:
                return []

        avg_cycle = 28
        entries = await self._get_recent_entries(user_id, limit=12)
        cycle_lengths = self._compute_cycle_lengths(entries) if len(entries) > 1 else []
        if cycle_lengths:
            avg_cycle = int(median(cycle_lengths))
        elif latest.training_data_points and latest.training_data_points > 0 and latest.prediction_window_days:
            avg_cycle = (latest.predicted_next_period_start - (latest.predicted_next_period_start - timedelta(days=latest.prediction_window_days or 28))).days

        predictions = [latest]
        for _ in range(1, 3):
            prev = predictions[-1]
            next_start = prev.predicted_next_period_start + timedelta(days=avg_cycle)
            next_pred = copy.copy(latest)
            next_pred.id = uuid.uuid4()
            next_pred.predicted_next_period_start = next_start
            predictions.append(next_pred)

        return predictions

    # ---- Calendar (Phase 2: dictionary-encoded) ----

    async def get_calendar(
        self, user_id: uuid.UUID, months_back: int = 3, months_forward: int = 3,
    ) -> dict:
        start = date.today() - timedelta(days=months_back * 30)
        end = date.today() + timedelta(days=months_forward * 30)

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

        today_str = date.today().isoformat()
        days: dict[str, str] = {}
        current = start

        entry_ranges = [
            (e.period_start_date, e.period_end_date or e.period_start_date)
            for e in entries
        ]
        pred_ranges = [
            (p.predicted_next_period_start, p.predicted_next_period_start + timedelta(days=5))
            for p in predictions
        ]
        fertile_windows = []
        for p in predictions:
            if p.predicted_fertile_window_start and p.predicted_fertile_window_end:
                fertile_windows.append(
                    (p.predicted_fertile_window_start, p.predicted_fertile_window_end)
                )
        today_ref = date.today()
        while current <= end:
            key = current.isoformat()
            if key == today_str:
                days[key] = "T"
            elif any(s <= current <= e for s, e in entry_ranges):
                days[key] = "P"
            elif any(s <= current <= e for s, e in pred_ranges):
                days[key] = "p"
            elif any(s <= current <= e for s, e in fertile_windows):
                # Only show fertile if it's a future window
                is_predicted = all(s > today_ref or e > today_ref for s, e in fertile_windows)
                days[key] = "f" if is_predicted else "F"
            current += timedelta(days=1)

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

        return {
            "days": days,
            "predictions": prediction_detail,
            "next_period_in_days": max(0, next_period_in_days) if next_period_in_days is not None else None,
        }

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
                existing.model_type = "fallback_median"
                existing.model_version = "fallback_median"
                await self.db.commit()
                await self.db.refresh(existing)
                return existing
            prediction = PredictedCycle(
                user_id=user_id,
                predicted_next_period_start=predicted_next,
                predicted_fertile_window_start=fertile_start,
                predicted_fertile_window_end=fertile_end,
                model_type="fallback_median",
                model_version="fallback_median",
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
    ) -> CycleEntry:
        entry = CycleEntry(
            user_id=user_id,
            period_start_date=period_start_date,
            period_end_date=period_end_date or (period_start_date + timedelta(days=5)),
            symptoms=symptoms or [],
            is_correction=corrected_prediction_id is not None,
            corrected_prediction_id=corrected_prediction_id,
        )
        self.db.add(entry)
        await self.db.flush()

        if corrected_prediction_id is not None:
            prediction = await self.get_prediction_by_id(corrected_prediction_id, user_id)
            error = (period_start_date - prediction.predicted_next_period_start).days
            prediction.actual_cycle_entry_id = entry.id
            prediction.prediction_error_days = error
            await self.db.flush()
            await self._update_user_ml_metrics(user_id, error)

        await self.db.commit()
        await self.db.refresh(entry)
        return entry

    async def get_prediction_by_id(self, prediction_id: uuid.UUID, user_id: uuid.UUID) -> PredictedCycle:
        stmt = (
            select(PredictedCycle)
            .where(PredictedCycle.id == prediction_id)
            .where(PredictedCycle.user_id == user_id)
            .where(PredictedCycle.is_active.is_(True))
        )
        prediction = (await self.db.execute(stmt)).scalar_one_or_none()
        if prediction is None:
            raise PredictionNotFoundError("Prediction not found")
        return prediction

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
