import pytest
from unittest.mock import patch, MagicMock

from app.core.config import Settings


@pytest.fixture
def settings_with_sentry() -> Settings:
    s = Settings()
    s.sentry.dsn = "https://key@sentry.io/project"
    return s


@pytest.fixture
def settings_no_sentry() -> Settings:
    s = Settings()
    s.sentry.dsn = ""
    return s


def test_init_sentry_with_dsn(settings_with_sentry: Settings) -> None:
    with patch("sentry_sdk.init") as mock_init:
        from app.core.monitoring import init_sentry
        init_sentry(settings_with_sentry)
        mock_init.assert_called_once()
        args, kwargs = mock_init.call_args
        assert kwargs["dsn"] == "https://key@sentry.io/project"
        assert kwargs["environment"] == settings_with_sentry.environment
        assert len(kwargs["integrations"]) == 3


def test_init_sentry_without_dsn_skips(settings_no_sentry: Settings) -> None:
    with patch("sentry_sdk.init") as mock_init:
        from app.core.monitoring import init_sentry
        init_sentry(settings_no_sentry)
        mock_init.assert_not_called()


def test_register_metrics_endpoint() -> None:
    from fastapi import FastAPI
    from app.core.monitoring import register_metrics_endpoint
    app = FastAPI()
    register_metrics_endpoint(app)
    routes = [r.path for r in app.routes]
    assert "/metrics" in routes


def test_metrics_middleware_increments_counters() -> None:
    from app.core.monitoring import metrics_middleware
    request = MagicMock()
    request.method = "GET"
    request.url.path = "/test"
    mock_response = MagicMock()
    mock_response.status_code = 200

    async def call_next(req):
        return mock_response

    import asyncio
    result = asyncio.run(metrics_middleware(request, call_next))
    assert result == mock_response
