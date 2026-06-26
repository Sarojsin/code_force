"""User module exception types (backend_rules.md §6.1)."""

from app.core.exceptions import SheCareError


class UserError(SheCareError):
    """Base for all user-module errors."""
    code = "USER_ERROR"
    http_status = 400


class UserNotFoundError(UserError):
    code = "USER_NOT_FOUND"
    http_status = 404


class AvatarUploadError(UserError):
    code = "AVATAR_UPLOAD_FAILED"
    http_status = 400


class FCMTokenError(UserError):
    code = "FCM_TOKEN_ERROR"
    http_status = 400


class ConsentNotFoundError(UserError):
    code = "CONSENT_NOT_FOUND"
    http_status = 404
