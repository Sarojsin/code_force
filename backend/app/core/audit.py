"""Shared audit logging utility (plan 17 §16.3).

Logs sensitive actions with user_id, action, resource, timestamp.
Can be called from service layer or wired as a middleware.
"""

from __future__ import annotations

import hashlib
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.core.database import get_db_session_factory
from app.core.logging_config import get_module_logger
from app.modules.users.models import AuditLog

logger = get_module_logger(__name__)

# HTTP methods that should be audited on authenticated resources
_AUDIT_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

# Resource action mapping for auto-auditing
_RESOURCE_ACTIONS: dict[str, str] = {
    "create": ".created",
    "update": ".updated",
    "delete": ".deleted",
}


def _hash_ip(ip: str | None) -> str | None:
    if not ip:
        return None
    return hashlib.sha256(ip.encode()).hexdigest()[:16]


def _infer_action(method: str) -> str:
    if method == "POST":
        return "create"
    if method in ("PUT", "PATCH"):
        return "update"
    if method == "DELETE":
        return "delete"
    return method.lower()


def _resource_name(path: str) -> str:
    """Derive a resource name from the URL path.

    e.g. /api/v1/users/me -> users
    """
    parts = [p for p in path.split("/") if p and p not in ("api", "v1", "v2")]
    return parts[0] if parts else path


async def log_audit(
    user_id: uuid.UUID | None,
    action: str,
    resource: str,
    resource_id: str | None = None,
    ip: str | None = None,
    payload: dict | None = None,
    db: AsyncSession | None = None,
) -> None:
    """Insert an audit log row.

    When called outside a request context (Celery task) pass a session explicitly.
    Otherwise leave ``db`` as None and a fresh session will be created.
    """
    if db is None:
        session_factory = get_db_session_factory()
        async with session_factory() as session:
            session.add(
                AuditLog(
                    user_id=user_id,
                    action=action,
                    resource=resource,
                    resource_id=resource_id,
                    ip_hash=_hash_ip(ip),
                    payload=payload or {},
                )
            )
            await session.commit()
    else:
        db.add(
            AuditLog(
                user_id=user_id,
                action=action,
                resource=resource,
                resource_id=resource_id,
                ip_hash=_hash_ip(ip),
                payload=payload or {},
            )
        )
        await db.flush()


class AuditMiddleware:
    """After-request middleware that auto-logs write operations on authenticated routes.

    Only logs requests where:
      - method is POST/PUT/PATCH/DELETE
      - request.state.user exists (authenticated)
    """

    def __init__(
        self,
        app,
        exclude_paths: frozenset[str] | None = None,
    ) -> None:
        self.app = app
        self.exclude_paths = exclude_paths or frozenset({
            "/health/live", "/health/ready", "/docs", "/redoc", "/openapi.json",
        })

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        path = request.url.path
        if path in self.exclude_paths:
            await self.app(scope, receive, send)
            return

        if request.method not in _AUDIT_METHODS:
            await self.app(scope, receive, send)
            return

        async def _send_with_audit(message):
            if message["type"] == "http.response.start":
                status = message["status"]
                if status < 500:
                    user = getattr(request.state, "user", None)
                    if user is not None:
                        action = _infer_action(request.method)
                        resource = _resource_name(path)
                        await log_audit(
                            user_id=user.id,
                            action=f"{resource}{action}",
                            resource=resource,
                            ip=request.client.host if request.client else None,
                        )
            await send(message)

        try:
            await self.app(scope, receive, _send_with_audit)
        except Exception:
            await self.app(scope, receive, send)
            raise
