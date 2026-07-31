"""Diary module exception types."""

from app.core.exceptions import SheCareError


class DiaryError(SheCareError):
    code = "DIARY_ERROR"
    http_status = 400


class DiaryNotFoundError(DiaryError):
    code = "DIARY_NOT_FOUND"
    http_status = 404


class DiaryPageNotFoundError(DiaryError):
    code = "DIARY_PAGE_NOT_FOUND"
    http_status = 404


class DiaryPageObjectNotFoundError(DiaryError):
    code = "DIARY_PAGE_OBJECT_NOT_FOUND"
    http_status = 404


class DiaryMediaNotFoundError(DiaryError):
    code = "DIARY_MEDIA_NOT_FOUND"
    http_status = 404


class DiaryVersionConflictError(DiaryError):
    code = "DIARY_VERSION_CONFLICT"
    http_status = 409
