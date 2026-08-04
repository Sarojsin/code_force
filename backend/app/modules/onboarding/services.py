"""Onboarding service: create/update profile, backfill past cycles, emit event.

Phase 1 business logic:
- Upsert user_onboarding record (idempotent)
- Backfill current + past cycles into cycle_entries
- Emit onboarding_completed event when transitioning to completed
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, date, datetime, timedelta
from statistics import median, stdev

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.event_bus import EventBus
from app.modules.cycle.models import CycleEntry
from app.modules.onboarding.exceptions import OnboardingNotFoundError
from app.modules.onboarding.models import UserOnboarding
from app.modules.onboarding.schemas import LifestyleUpdate, OnboardingCreate

logger = logging.getLogger("app.modules.onboarding")


class OnboardingService:
    def __init__(self, db: AsyncSession, event_bus: EventBus | None = None) -> None:
        self.db = db
        self.event_bus = event_bus

    async def create_or_update(
        self, user_id: uuid.UUID, data: OnboardingCreate,
    ) -> UserOnboarding:
        """Upsert onboarding data. On first completion triggers backfill + event."""

        stmt = select(UserOnboarding).where(UserOnboarding.user_id == user_id)
        onboarding = (await self.db.execute(stmt)).scalar_one_or_none()

        was_already_completed = onboarding is not None and onboarding.onboarding_completed

        if onboarding is None:
            onboarding = UserOnboarding(user_id=user_id)
            self.db.add(onboarding)

        onboarding.age = data.age
        onboarding.height_cm = data.height_cm
        onboarding.weight_kg = data.weight_kg
        onboarding.stress_level = data.stress_level
        onboarding.exercise_frequency = data.exercise_frequency
        onboarding.sleep_hours = data.sleep_hours
        onboarding.diet = data.diet
        onboarding.current_cycle_start = data.current_cycle_start
        onboarding.current_period_length = data.current_period_length
        onboarding.current_symptoms = data.current_symptoms
        onboarding.past_cycles = [p.model_dump(mode="json") for p in data.past_cycles]

        if not was_already_completed:
            onboarding.onboarding_completed = True
            onboarding.completed_at = datetime.now(tz=UTC)

        await self.db.flush()

        if not was_already_completed:
            await self._backfill_cycles(user_id, data)
            await self._initialize_user_ml_metrics(user_id, data)

        await self.db.commit()
        await self.db.refresh(onboarding)

        if not was_already_completed and self.event_bus:
            await self.event_bus.emit("onboarding_completed", user_id=str(user_id))

        return onboarding

    async def _backfill_cycles(self, user_id: uuid.UUID, data: OnboardingCreate) -> None:
        """Insert current and past cycles into cycle_entries.

        Idempotent: skips existing (user_id, period_start_date) pairs.
        """
        all_cycles = []

        current_end = data.current_cycle_start + timedelta(days=data.current_period_length - 1)
        all_cycles.append({
            "period_start_date": data.current_cycle_start,
            "period_end_date": current_end,
            "symptoms": data.current_symptoms,
            "flow_intensity": None,
            "mood_tags": [],
            "energy_level": None,
            "notes": None,
        })

        sorted_past = sorted(data.past_cycles, key=lambda p: p.cycle_start, reverse=True)
        for _, past in enumerate(sorted_past):
            past_end = past.cycle_start + timedelta(days=past.period_length - 1)
            all_cycles.append({
                "period_start_date": past.cycle_start,
                "period_end_date": past_end,
                "symptoms": past.symptoms,
                "flow_intensity": None,
                "mood_tags": [],
                "energy_level": None,
                "notes": None,
            })

        for cycle in all_cycles:
            exists = await self._cycle_exists(user_id, cycle["period_start_date"])
            if exists:
                logger.info(
                    "onboarding.backfill_skip_duplicate",
                    extra={"user_id": str(user_id), "period_start": str(cycle["period_start_date"])},
                )
                continue
            self.db.add(CycleEntry(
                user_id=user_id,
                period_start_date=cycle["period_start_date"],
                period_end_date=cycle["period_end_date"],
                symptoms=cycle["symptoms"],
                flow_intensity=cycle.get("flow_intensity"),
                mood_tags=cycle.get("mood_tags", []),
                energy_level=cycle.get("energy_level"),
                notes=cycle.get("notes"),
            ))

    async def _cycle_exists(self, user_id: uuid.UUID, period_start: date) -> bool:
        stmt = (
            select(CycleEntry)
            .where(CycleEntry.user_id == user_id)
            .where(CycleEntry.period_start_date == period_start)
            .where(CycleEntry.is_active.is_(True))
        )
        return (await self.db.execute(stmt)).scalar_one_or_none() is not None

    async def _initialize_user_ml_metrics(self, user_id: uuid.UUID, data: OnboardingCreate) -> None:
        """Initialize User ML metrics from onboarding data so first prediction doesn't fall back to 28.

        Cycle lengths are DERIVED from the gaps between consecutive period start dates,
        never from user-provided inputs (a user cannot know a cycle length in advance).
        """
        from app.modules.auth.models import User

        user = (
            await self.db.execute(
                select(User).where(User.id == user_id).where(User.is_active.is_(True))
            )
        ).scalar_one_or_none()
        if user is None:
            return

        # Completed cycle lengths = gaps between consecutive period start dates.
        # current_cycle_start + past_cycles give up to 4 starts -> up to 3 gaps.
        starts = [data.current_cycle_start] + [p.cycle_start for p in data.past_cycles]
        starts = sorted(starts)
        cycle_lengths = []
        for i in range(len(starts) - 1):
            gap = (starts[i + 1] - starts[i]).days
            if 20 <= gap <= 45:
                cycle_lengths.append(gap)

        user.total_cycles_logged = len(cycle_lengths)

        if cycle_lengths:
            user.avg_cycle_length = round(float(median(cycle_lengths)), 1)
            if len(cycle_lengths) >= 2:
                user.cycle_length_std_dev = round(stdev(cycle_lengths), 1)
            else:
                user.cycle_length_std_dev = None
        else:
            user.avg_cycle_length = None
            user.cycle_length_std_dev = None

        user.avg_prediction_error_days = 0.0
        user.is_dirty_for_retraining = False

        await self.db.flush()

    async def update_lifestyle(self, user_id: uuid.UUID, data: LifestyleUpdate) -> UserOnboarding:
        """Partial update of health/lifestyle fields on UserOnboarding."""
        stmt = select(UserOnboarding).where(UserOnboarding.user_id == user_id)
        onboarding = (await self.db.execute(stmt)).scalar_one_or_none()
        if onboarding is None:
            raise OnboardingNotFoundError("Complete onboarding first.")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(onboarding, field, value)

        await self.db.commit()
        await self.db.refresh(onboarding)
        return onboarding

    async def get_onboarding(self, user_id: uuid.UUID) -> UserOnboarding:
        stmt = select(UserOnboarding).where(UserOnboarding.user_id == user_id)
        onboarding = (await self.db.execute(stmt)).scalar_one_or_none()
        if onboarding is None:
            raise OnboardingNotFoundError("Onboarding not found. Complete onboarding first.")
        return onboarding

    async def get_status(self, user_id: uuid.UUID) -> bool:
        stmt = select(UserOnboarding).where(UserOnboarding.user_id == user_id)
        onboarding = (await self.db.execute(stmt)).scalar_one_or_none()
        if onboarding is None:
            return False
        return onboarding.onboarding_completed
