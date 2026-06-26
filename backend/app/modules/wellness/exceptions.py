"""Wellness module exception types (backend_rules.md §6.1)."""

from app.core.exceptions import SheCareError


class WellnessError(SheCareError):
    """Base for all wellness-module errors."""
    code = "WELLNESS_ERROR"
    http_status = 400


class JournalEntryNotFoundError(WellnessError):
    code = "JOURNAL_ENTRY_NOT_FOUND"
    http_status = 404


class MoodLogNotFoundError(WellnessError):
    code = "MOOD_LOG_NOT_FOUND"
    http_status = 404


class ExerciseNotFoundError(WellnessError):
    code = "EXERCISE_NOT_FOUND"
    http_status = 404
