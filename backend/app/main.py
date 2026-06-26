"""App factory + lifespan (rule §15).

Pattern: each module exposes an optional `init_module(app, event_bus)` that
registers routes and event subscribers. Commenting out a module here must not
break the rest of the app.
"""

from __future__ import annotations

import gzip
from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.audit import AuditMiddleware
from app.core.config import get_settings
from app.core.event_bus import event_bus
from app.core.exceptions import (
    RateLimitError,
    SheCareError,
    http_exception_handler,
    shecare_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.core.logging_config import (
    RequestContextMiddleware,
    configure_logging,
    get_module_logger,
)
from app.core.monitoring import init_sentry, metrics_middleware, register_metrics_endpoint
from app.core.redis_client import close_redis, get_redis_client
from app.core.security_headers import SecurityHeadersMiddleware
from app.core.sentry_middleware import SentryTaggingMiddleware

logger = get_module_logger(__name__)

# Pluggable modules: ordered for predictable /docs ordering.
# Each module exposes `init_module(app, event_bus)` if it wants hooks.
# Try/except keeps the rest of the app alive when a module is in development.
MODULE_INITS: list[Callable[[FastAPI, object], Awaitable[None] | None]] = [
    "app.modules.auth.routes:init_module",
    "app.modules.users.routes:init_module",          # plan 05
    "app.modules.cycle.routes:init_module",          # plan 07
    "app.modules.wellness.routes:init_module",       # plan 08
    "app.modules.pregnancy.routes:init_module",      # plan 10
    "app.modules.safety.routes:init_module",         # plan 11
    "app.modules.family.routes:init_module",         # plan 12
    "app.modules.nurse_content.routes:init_module",  # plan 13
    "app.modules.chat.routes:init_module",           # plan 14
    "app.modules.admin.routes:init_module",          # plan 16
    "app.modules.voice.routes:init_module",           # plan 22
    "app.modules.onboarding.routes:init_module",      # phase 1
    "app.modules.sync.routes:init_module",            # phase 5
]


def _import_callable(dotted: str) -> Callable | None:
    module_name, _, attr = dotted.partition(":")
    try:
        import importlib
        return getattr(importlib.import_module(module_name), attr)
    except (ImportError, AttributeError) as exc:
        logger.warning("module.init_skipped", extra={"module": dotted, "reason": str(exc)})
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    settings = get_settings()
    init_sentry(settings)
    logger.info("app.startup", extra={"version": app.version, "environment": settings.environment})
    yield
    logger.info("app.shutdown")
    await close_redis()


def _register_modules(app: FastAPI) -> None:
    """Run each module's `init_module(app, event_bus)` at app-construction time.

    Rule §15: modules are pluggable. Each entry is a "dotted:callable" string
    resolved via importlib. Skipped silently if a module is in development.
    """
    for dotted in MODULE_INITS:
        fn = _import_callable(dotted)
        if fn is None:
            continue
        try:
            result = fn(app, event_bus)
            if hasattr(result, "__await__"):
                # If a module returns a coroutine, schedule it for the lifespan.
                logger.info("module.async_init", extra={"module": dotted})
        except Exception:
            logger.exception("module.init_failed", extra={"module": dotted})


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="SheCare API",
        description="Backend for the SheCare women's wellness mobile app.",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # --- middleware (outermost first in code, inner in execution) ----
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(SentryTaggingMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )
    if settings.environment == "production":
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*.shecare.app"])

    # --- metrics middleware (plan 20) ---------------------------------
    app.middleware("http")(metrics_middleware)
    register_metrics_endpoint(app)

    # --- gzip decompression (phase 5: large sync payloads) -----------
    @app.middleware("http")
    async def gunzip_request(request: Request, call_next):
        if request.headers.get("Content-Encoding") == "gzip":
            body = await request.body()
            request._body = gzip.decompress(body)
        return await call_next(request)

    # --- audit middleware (plan 17 §16.3) -----------------------------
    app.add_middleware(AuditMiddleware)

    # --- exception handlers (rule §6.2) -------------------------------
    app.add_exception_handler(Exception, unhandled_exception_handler)
    app.add_exception_handler(SheCareError, shecare_exception_handler)
    app.add_exception_handler(RateLimitError, shecare_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    # --- pluggable modules (rule §15) --------------------------------
    _register_modules(app)

    # --- health / readiness (plan 20) --------------------------------
    @app.get("/health/live", tags=["meta"])
    async def liveness() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready", tags=["meta"])
    async def readiness() -> dict[str, object]:
        import asyncpg

        health: dict[str, object] = {"status": "ok", "checks": {}}
        settings = get_settings()
        try:
            raw_url = settings.database.url.replace("+asyncpg", "")
            conn = await asyncpg.connect(raw_url)
            await conn.close()
            health["checks"]["database"] = "ok"
        except Exception as e:
            health["status"] = "degraded"
            health["checks"]["database"] = str(e)
        try:
            r = get_redis_client()
            await r.ping()
            await r.aclose()
            health["checks"]["redis"] = "ok"
        except Exception as e:
            health["status"] = "degraded"
            health["checks"]["redis"] = str(e)
        return health

    return app


app = create_app()
