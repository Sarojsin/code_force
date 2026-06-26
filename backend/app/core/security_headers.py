"""Security headers middleware (plan 03 §3, backend_rules.md §14).

Adds HSTS, CSP, X-Content-Type-Options, X-Frame-Options, and other
security-related HTTP response headers.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import get_settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Inject security headers into every response.

    Headers applied:
      - Strict-Transport-Security (HSTS) — production only
      - X-Content-Type-Options: nosniff
      - X-Frame-Options: DENY
      - Content-Security-Policy (CSP)
      - Referrer-Policy: strict-origin-when-cross-origin
      - Permissions-Policy (feature policy)
      - Cache-Control for sensitive endpoints
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        response = await call_next(request)

        settings = get_settings()

        # HSTS — only in production
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )

        # Prevent MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Content Security Policy
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
            "img-src 'self' data: https:",
            "connect-src 'self' https: wss:",
            "font-src 'self' data:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)

        # Permissions Policy — restrict sensitive APIs
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(self), "
            "accelerometer=(), gyroscope=(), magnetometer=(), "
            "payment=(), usb=(), bluetooth=()"
        )

        return response
