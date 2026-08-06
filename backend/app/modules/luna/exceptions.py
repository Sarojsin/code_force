"""Luna module error hierarchy (AGENTS.md §1.6)."""

from __future__ import annotations

from app.core.exceptions import SheCareError


class LunaError(SheCareError):
    code = "LUNA_ERROR"
    http_status = 400


class LunaNotFoundError(LunaError):
    code = "LUNA_NOT_FOUND"
    http_status = 404


class LunaConflictError(LunaError):
    code = "LUNA_CONFLICT"
    http_status = 409


class LunaValidationError(LunaError):
    code = "LUNA_VALIDATION_ERROR"
    http_status = 422
