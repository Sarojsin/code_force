"""Auth module exception types. Subclassed from core SheCareError (rule §6.1)."""

from app.core.exceptions import SheCareError


class AuthError(SheCareError):
    """Base for all auth-module errors."""

    code = "AUTH_ERROR"
    http_status = 401


class InvalidCredentialsError(AuthError):
    code = "INVALID_CREDENTIALS"
    http_status = 401


class OTPExpiredError(AuthError):
    code = "OTP_EXPIRED"
    http_status = 400


class OTPInvalidError(AuthError):
    code = "OTP_INVALID"
    http_status = 400


class MFAMissingError(AuthError):
    code = "MFA_REQUIRED"
    http_status = 401


class MFAInvalidError(AuthError):
    code = "MFA_INVALID"
    http_status = 401


class TokenRevokedError(AuthError):
    code = "TOKEN_REVOKED"
    http_status = 401
