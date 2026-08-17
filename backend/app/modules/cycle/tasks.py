"""Cycle Celery tasks: prediction computation (plan 07 §7.2, Phase 2).

- update_cycle_predictions: daily at 2AM, recompute for all users
- train_global_model: monthly Celery Beat task

No retrain_dirty_users() — per-user models removed in Phase 2 (Option A).
The is_dirty_for_retraining flag only marks users for next monthly dataset.
"""

from __future__ import annotations

import logging

from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.modules.cycle.tasks.update_cycle_predictions",
    soft_time_limit=300,
    time_limit=600,
)
def update_cycle_predictions() -> int:
    """Recompute predictions for all users with cycle data. Runs daily at 2 AM."""
    import asyncio
    return asyncio.run(_update_all_predictions())


async def _update_all_predictions() -> int:
    from sqlalchemy import func, select

    from app.core.database import AsyncSessionLocal
    from app.modules.cycle.models import CycleEntry
    from app.modules.cycle.services import CycleService

    count = 0
    async with AsyncSessionLocal() as session:
        user_ids = (
            await session.execute(
                select(CycleEntry.user_id)
                .where(CycleEntry.is_active.is_(True))
                .group_by(CycleEntry.user_id)
                .having(func.count(CycleEntry.id) >= 1)
            )
        ).scalars().all()

        svc = CycleService(session)
        for uid in user_ids:
            try:
                await svc.compute_predictions(uid)
                count += 1
            except Exception as exc:
                logger.warning("cycle.prediction_failed", extra={"user_id": str(uid), "error": str(exc)})

    logger.info("cycle.predictions_updated", extra={"count": count})
    return count


@celery_app.task(
    name="app.modules.cycle.tasks.generate_cycle_report",
    soft_time_limit=60,
    time_limit=120,
    bind=True,
)
def generate_cycle_report(self, user_id: str, cycle_entry_id: str) -> None:
    """Generate + store a per-cycle report (Groq, else rule-based fallback).

    Idempotent via business-key task_id ``generate_cycle_report_{entry_id}``
    plus the unique cycle_entry_id DB constraint (AGENTS §1.8).
    """
    import asyncio

    logger.info(
        "cycle.report_started",
        extra={"user_id": user_id, "cycle_entry_id": cycle_entry_id},
    )

    async def _run() -> None:
        from uuid import UUID

        from app.core.database import AsyncSessionLocal
        from app.modules.cycle.services import CycleService

        async with AsyncSessionLocal() as session:
            svc = CycleService(session)
            try:
                await svc.generate_report(UUID(user_id), UUID(cycle_entry_id))
                logger.info(
                    "cycle.report_generated",
                    extra={"user_id": user_id, "cycle_entry_id": cycle_entry_id},
                )
            except Exception as exc:
                logger.error(
                    "cycle.report_failed",
                    extra={"user_id": user_id, "cycle_entry_id": cycle_entry_id, "error": str(exc)},
                )
                raise

    asyncio.run(_run())


@celery_app.task(
    name="app.modules.cycle.tasks.train_global_model",
    soft_time_limit=1800,
    time_limit=3600,
)
def train_global_model() -> bool:
    """Monthly: build anonymized dataset, train XGBoost, evaluate RMSE/MAE,
    detect drift, export versioned JSON with atomic swap."""
    from scripts.train_global_model import train_global_model as _run

    return _run()
