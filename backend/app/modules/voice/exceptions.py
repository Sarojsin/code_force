"""Voice journal exception types."""

from app.core.exceptions import SheCareError


class VoiceJournalError(SheCareError):
    code = "VOICE_JOURNAL_ERROR"


class FeatureNotAvailableError(VoiceJournalError):
    code = "FEATURE_NOT_AVAILABLE"
    http_status = 501
