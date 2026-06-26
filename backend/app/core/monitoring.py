"""Sentry + Prometheus integration (plan 20)."""

from __future__ import annotations

import time

import prometheus_client
from fastapi import FastAPI, Request, Response
from prometheus_client import Counter, Gauge, Histogram
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from app.core.config import Settings

_request_count = Counter(
    "shecare_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)

_request_duration = Histogram(
    "shecare_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

_queue_gauge = Gauge("shecare_celery_queue_size", "Celery queue length", ["queue"])

_active_users = Gauge("shecare_active_users", "Daily active users (updated by Celery)")


def init_sentry(settings: Settings) -> None:
    if not settings.sentry.dsn:
        return
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.sentry.dsn,
        environment=settings.environment,
        traces_sample_rate=settings.sentry.traces_sample_rate,
        profiles_sample_rate=settings.sentry.profiles_sample_rate,
        integrations=[FastApiIntegration(), SqlalchemyIntegration(), CeleryIntegration()],
        send_default_pii=False,
    )


def register_metrics_endpoint(app: FastAPI) -> None:
    @app.get("/metrics", tags=["meta"], include_in_schema=False)
    async def metrics() -> Response:
        return Response(
            content=prometheus_client.generate_latest(),
            media_type="text/plain; version=0.0.4",
        )


async def metrics_middleware(request: Request, call_next):
    start = time.monotonic()
    response = await call_next(request)
    duration = time.monotonic() - start
    endpoint = request.url.path
    _request_count.labels(method=request.method, endpoint=endpoint, status=response.status_code).inc()
    _request_duration.labels(method=request.method, endpoint=endpoint).observe(duration)
    return response
