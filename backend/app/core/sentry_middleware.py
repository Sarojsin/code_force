from collections.abc import Awaitable, Callable

import sentry_sdk
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SentryTaggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = getattr(request.state, "request_id", None)
        if request_id:
            sentry_sdk.set_tag("request_id", request_id)
        user = request.scope.get("user", None)
        user_id = getattr(user, "id", None) if user else None
        if user_id:
            sentry_sdk.set_tag("user_id", str(user_id))
        return await call_next(request)
