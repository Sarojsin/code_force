"""Chat module exception types."""

from app.core.exceptions import SheCareError


class ChatError(SheCareError):
    code = "CHAT_ERROR"
    http_status = 400


class ChatInviteNotFoundError(ChatError):
    code = "CHAT_INVITE_NOT_FOUND"
    http_status = 404


class ChatInviteExpiredError(ChatError):
    code = "CHAT_INVITE_EXPIRED"
    http_status = 400


class ChatInviteMaxUsesError(ChatError):
    code = "CHAT_INVITE_MAX_USES"
    http_status = 400
