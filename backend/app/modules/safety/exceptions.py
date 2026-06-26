"""Safety module exception types (backend_rules.md §6.1)."""

from app.core.exceptions import SheCareError


class SafetyError(SheCareError):
    """Base for all safety-module errors."""
    code = "SAFETY_ERROR"
    http_status = 400


class SOSAlertNotFoundError(SafetyError):
    code = "SOS_ALERT_NOT_FOUND"
    http_status = 404


class ActiveSOSExistsError(SafetyError):
    code = "ACTIVE_SOS_EXISTS"
    http_status = 409


class ContactNotFoundError(SafetyError):
    code = "CONTACT_NOT_FOUND"
    http_status = 404


class SOSAlreadyCancelledError(SafetyError):
    code = "SOS_ALREADY_CANCELLED"
    http_status = 400


class ContactLimitExceededError(SafetyError):
    code = "CONTACT_LIMIT_EXCEEDED"
    http_status = 400


class DuplicateIdempotencyError(SafetyError):
    code = "DUPLICATE_IDEMPOTENCY_KEY"
    http_status = 409


class SMSRateLimitExceededError(SafetyError):
    code = "SMS_RATE_LIMIT_EXCEEDED"
    http_status = 429
