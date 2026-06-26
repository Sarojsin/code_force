from unittest.mock import MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_sentry_middleware_tags_request_id() -> None:
    from app.core.sentry_middleware import SentryTaggingMiddleware

    middleware = SentryTaggingMiddleware(MagicMock())

    request = MagicMock()
    request.state.request_id = "test-rid"
    request.scope = {}

    mock_response = MagicMock()

    async def call_next(req):
        return mock_response

    with patch("app.core.sentry_middleware.sentry_sdk.set_tag") as mock_set_tag:
        await middleware.dispatch(request, call_next)
        mock_set_tag.assert_any_call("request_id", "test-rid")


@pytest.mark.asyncio
async def test_sentry_middleware_tags_user_id() -> None:
    from app.core.sentry_middleware import SentryTaggingMiddleware

    middleware = SentryTaggingMiddleware(MagicMock())

    mock_user = MagicMock()
    mock_user.id = "user-123"

    request = MagicMock()
    request.state.request_id = "test-rid"
    request.scope = {"user": mock_user}

    mock_response = MagicMock()

    async def call_next(req):
        return mock_response

    with patch("app.core.sentry_middleware.sentry_sdk.set_tag") as mock_set_tag:
        await middleware.dispatch(request, call_next)
        mock_set_tag.assert_any_call("user_id", "user-123")


@pytest.mark.asyncio
async def test_sentry_middleware_no_request_id() -> None:
    from app.core.sentry_middleware import SentryTaggingMiddleware

    middleware = SentryTaggingMiddleware(MagicMock())

    request = MagicMock()
    request.state.request_id = None
    request.scope = {}

    mock_response = MagicMock()

    async def call_next(req):
        return mock_response

    with patch("app.core.sentry_middleware.sentry_sdk.set_tag") as mock_set_tag:
        await middleware.dispatch(request, call_next)
        assert not any(c[0][0] == "request_id" for c in mock_set_tag.call_args_list)
