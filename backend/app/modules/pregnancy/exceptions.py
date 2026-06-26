"""Pregnancy module exception types (backend_rules.md §6.1)."""

from app.core.exceptions import SheCareError


class PregnancyError(SheCareError):
    """Base for all pregnancy-module errors."""
    code = "PREGNANCY_ERROR"
    http_status = 400


class PregnancyProfileNotFoundError(PregnancyError):
    code = "PREGNANCY_PROFILE_NOT_FOUND"
    http_status = 404


class ActivePregnancyExistsError(PregnancyError):
    code = "ACTIVE_PREGNANCY_EXISTS"
    http_status = 409


class DailyLogNotFoundError(PregnancyError):
    code = "DAILY_LOG_NOT_FOUND"
    http_status = 404


class MilestoneNotFoundError(PregnancyError):
    code = "MILESTONE_NOT_FOUND"
    http_status = 404
