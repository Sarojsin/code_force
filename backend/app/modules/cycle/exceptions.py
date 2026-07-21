"""Cycle module exception types (backend_rules.md §6.1)."""

from app.core.exceptions import SheCareError


class CycleError(SheCareError):
    """Base for all cycle-module errors."""
    code = "CYCLE_ERROR"
    http_status = 400


class CycleEntryNotFoundError(CycleError):
    code = "CYCLE_ENTRY_NOT_FOUND"
    http_status = 404


class InsufficientDataError(CycleError):
    code = "INSUFFICIENT_CYCLE_DATA"
    http_status = 400


class PredictionNotFoundError(CycleError):
    code = "PREDICTION_NOT_FOUND"
    http_status = 404


class CycleConflictError(CycleError):
    code = "CYCLE_CONFLICT"
    http_status = 409


class PeriodEndDateRequiredError(CycleError):
    """State C: today is past the predicted period end, so end_date is required."""
    code = "PERIOD_END_DATE_REQUIRED"
    http_status = 422
