"""Onboarding module exception types (backend_rules.md §6.1)."""

from app.core.exceptions import SheCareError


class OnboardingError(SheCareError):
    code = "ONBOARDING_ERROR"
    http_status = 400


class OnboardingNotFoundError(OnboardingError):
    code = "ONBOARDING_NOT_FOUND"
    http_status = 404


class OnboardingAlreadyCompletedError(OnboardingError):
    code = "ONBOARDING_ALREADY_COMPLETED"
    http_status = 409
