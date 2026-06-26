from unittest.mock import patch

import pytest


def test_configure_logging_sets_up_structlog() -> None:
    from app.core.logging_config import configure_logging

    with patch("app.core.logging_config.structlog.configure") as mock_configure:
        configure_logging()
        mock_configure.assert_called_once()
        args, kwargs = mock_configure.call_args
        assert kwargs["cache_logger_on_first_use"] is True


def test_get_module_logger_returns_logger() -> None:
    from app.core.logging_config import get_module_logger

    logger = get_module_logger("app.modules.test")
    assert logger is not None


@pytest.mark.asyncio
async def test_request_context_middleware_sets_request_id() -> None:
    from app.core.logging_config import RequestContextMiddleware
    from unittest.mock import MagicMock

    middleware = RequestContextMiddleware(MagicMock())

    request = MagicMock()
    request.headers = {"X-Request-ID": "test-rid-123"}
    request.state = MagicMock()
    request.url.path = "/test"

    mock_response = MagicMock()
    mock_response.headers = {}

    async def call_next(req):
        return mock_response

    await middleware.dispatch(request, call_next)
    assert request.state.request_id == "test-rid-123"


@pytest.mark.asyncio
async def test_request_context_middleware_generates_request_id() -> None:
    from app.core.logging_config import RequestContextMiddleware
    from unittest.mock import MagicMock

    middleware = RequestContextMiddleware(MagicMock())

    request = MagicMock()
    request.headers = {}
    request.state = MagicMock()
    request.url.path = "/test"

    mock_response = MagicMock()
    mock_response.headers = {}

    async def call_next(req):
        return mock_response

    await middleware.dispatch(request, call_next)
    assert request.state.request_id is not None
    assert request.state.request_id != ""
