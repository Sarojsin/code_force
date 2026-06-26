"""Admin module exception types."""

from app.core.exceptions import SheCareError


class AdminError(SheCareError):
    code = "ADMIN_ERROR"
    http_status = 403


class AdminOnlyError(AdminError):
    code = "ADMIN_REQUIRED"
    http_status = 403
