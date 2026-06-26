"""Nurse content module exception types."""

from app.core.exceptions import SheCareError


class NurseContentError(SheCareError):
    code = "NURSE_CONTENT_ERROR"
    http_status = 400


class ContentNotFoundError(NurseContentError):
    code = "CONTENT_NOT_FOUND"
    http_status = 404


class UnauthorizedContentError(NurseContentError):
    code = "CONTENT_NOT_OWNED"
    http_status = 403


class NurseProfileNotFoundError(NurseContentError):
    code = "NURSE_PROFILE_NOT_FOUND"
    http_status = 404
