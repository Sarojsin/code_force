import pytest


@pytest.mark.asyncio
async def test_security_headers_middleware_sets_headers() -> None:
    from app.core.security_headers import SecurityHeadersMiddleware
    from unittest.mock import MagicMock

    middleware = SecurityHeadersMiddleware(MagicMock())

    request = MagicMock()
    request.state = MagicMock()

    mock_response = MagicMock()
    mock_response.headers = {}

    async def call_next(req):
        return mock_response

    await middleware.dispatch(request, call_next)
    assert mock_response.headers.get("X-Content-Type-Options") == "nosniff"
    assert mock_response.headers.get("X-Frame-Options") == "DENY"
    assert mock_response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "Content-Security-Policy" in mock_response.headers
    assert "Permissions-Policy" in mock_response.headers


@pytest.mark.asyncio
async def test_security_headers_hsts_not_in_test() -> None:
    from app.core.security_headers import SecurityHeadersMiddleware
    from unittest.mock import MagicMock

    middleware = SecurityHeadersMiddleware(MagicMock())

    request = MagicMock()
    request.state = MagicMock()

    mock_response = MagicMock()
    mock_response.headers = {}

    async def call_next(req):
        return mock_response

    await middleware.dispatch(request, call_next)
    assert "Strict-Transport-Security" not in mock_response.headers
