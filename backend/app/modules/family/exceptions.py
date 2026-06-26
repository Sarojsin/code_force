"""Family module exception types."""

from app.core.exceptions import SheCareError


class FamilyError(SheCareError):
    code = "FAMILY_ERROR"
    http_status = 400


class LinkNotFoundError(FamilyError):
    code = "FAMILY_LINK_NOT_FOUND"
    http_status = 404


class InviteTokenExpiredError(FamilyError):
    code = "INVITE_TOKEN_EXPIRED"
    http_status = 400


class InviteTokenUsedError(FamilyError):
    code = "INVITE_TOKEN_ALREADY_USED"
    http_status = 409


class SelfLinkError(FamilyError):
    code = "CANNOT_LINK_SELF"
    http_status = 400
