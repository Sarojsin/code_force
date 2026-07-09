"""Celery application singleton.

Backend rule §8: tasks live in their owning module's tasks.py. This file
just configures the app object that those tasks attach to.
"""

from __future__ import annotations

from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings

_settings = get_settings()

celery_app = Celery(
    "shecare",
    broker=_settings.redis.celery_broker_url,
    backend=_settings.redis.celery_result_backend,
    include=[
        # "app.modules.wellness.tasks",
        # "app.modules.cycle.tasks",
        # "app.modules.safety.tasks",
        # "app.modules.users.tasks",
        # "app.tasks.global_cleanup",
        "app.tasks.retention_cleanup",
        "app.tasks.checkin",
    ],
)

celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_default_queue="default",
    task_routes={
        # "app.modules.safety.tasks.*": {"queue": "priority"},
        # "app.modules.wellness.tasks.analyze_journal_sentiment": {"queue": "ai"},
    },
    task_annotations={
        "*": {
            "soft_time_limit": 30,
            "time_limit": 60,
        },
    },
    beat_schedule={
        # Plan 26 wires the real schedule:
        # "update-cycle-predictions-daily": {
        #     "task": "app.modules.cycle.tasks.update_cycle_predictions",
        #     "schedule": crontab(hour=2, minute=0),
        # },
        "checkin-daily": {
            "task": "app.tasks.checkin.daily_checkin",
            "schedule": crontab(hour=8, minute=0),
        },
        "retention-cleanup-daily": {
            "task": "app.tasks.retention_cleanup.cleanup",
            "schedule": crontab(hour=3, minute=0),
        },
    },
)
