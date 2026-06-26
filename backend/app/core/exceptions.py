"""Common exception classes and HTTP error helpers.

Backend rule §6.1: each module defines its own error subclasses. This file
holds the shared base + the global exception handler (rule §6.2).
"""

from __future__ import annotations

import logging
import uuid

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class SheCareError(Exception):
    """Base class for all SheCare application errors."""

    code: str = "INTERNAL_ERROR"
    http_status: int = status.HTTP_500_INTERNAL_SERVER_ERROR

    def __init__(self, details: str | None = None) -> None:
        super().__init__(details or self.code)
        self.details = details


class NotFoundError(SheCareError):
    code = "RESOURCE_NOT_FOUND"
    http_status = status.HTTP_404_NOT_FOUND


class ValidationError(SheCareError):
    code = "VALIDATION_FAILED"
    http_status = status.HTTP_422_UNPROCESSABLE_ENTITY


class ConflictError(SheCareError):
    code = "CONFLICT"
    http_status = status.HTTP_409_CONFLICT


class UnauthorizedError(SheCareError):
    code = "UNAUTHORIZED"
    http_status = status.HTTP_401_UNAUTHORIZED


class ForbiddenError(SheCareError):
    code = "FORBIDDEN"
    http_status = status.HTTP_403_FORBIDDEN


class RateLimitError(SheCareError):
    code = "RATE_LIMIT_EXCEEDED"
    http_status = status.HTTP_429_TOO_MANY_REQUESTS


def _envelope(error_code: str, details: str | None, request_id: str) -> dict[str, object]:
    return {
        "error": {
            "code": error_code,
            "details": details or "",
            "request_id": request_id,
        }
    }


async def shecare_exception_handler(request: Request, exc: SheCareError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.warning(
        "api.shecare_error",
        extra={"code": exc.code, "details": exc.details, "path": request.url.path},
    )
    return JSONResponse(
        status_code=exc.http_status,
        content=_envelope(exc.code, exc.details, request_id),
    )


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    code_map = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "RESOURCE_NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        422: "VALIDATION_FAILED",
        429: "RATE_LIMIT_EXCEEDED",
    }
    code = code_map.get(exc.status_code, "HTTP_ERROR")
    # FastAPI's HTTPException sometimes puts a dict in `detail`; normalize.
    if isinstance(exc.detail, dict):
        details = str(exc.detail.get("details", exc.detail.get("code", "")))
        code = str(exc.detail.get("code", code))
    else:
        details = str(exc.detail) if exc.detail is not None else ""
    return JSONResponse(
        status_code=exc.status_code,
        content=_envelope(code, details, request_id),
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=_envelope("VALIDATION_FAILED", str(exc.errors()), request_id),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.exception("api.unhandled_exception", extra={"path": request.url.path})
    # Sentry hook can be added here in plan 19.
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=_envelope("INTERNAL_ERROR", "An unexpected error occurred", request_id),
    )
