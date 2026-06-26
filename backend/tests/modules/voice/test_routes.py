from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from starlette.exceptions import HTTPException as StarletteHTTPException

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from app.core.exceptions import (
    RateLimitError,
    SheCareError,
    http_exception_handler,
    shecare_exception_handler,
    validation_exception_handler,
)


@pytest_asyncio.fixture
async def voice_app() -> FastAPI:
    app = FastAPI(title="Voice (test)")

    from app.modules.voice.routes import init_module as voice_init
    voice_init(app, None)

    app.add_exception_handler(SheCareError, shecare_exception_handler)
    app.add_exception_handler(RateLimitError, shecare_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)

    return app


@pytest.mark.asyncio
async def test_accept_audio_returns_202(voice_app: FastAPI) -> None:
    transport = ASGITransport(app=voice_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/v1/voice/daily")
    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "queued"
    assert "id" in body


@pytest.mark.asyncio
async def test_get_analysis_returns_200(voice_app: FastAPI) -> None:
    entry_id = uuid.uuid4()
    transport = ASGITransport(app=voice_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(f"/api/v1/voice/analysis/{entry_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == str(entry_id)
    assert body["status"] == "unavailable"


@pytest.mark.asyncio
async def test_realtime_emotion_returns_501(voice_app: FastAPI) -> None:
    transport = ASGITransport(app=voice_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/v1/voice/emotion/realtime")
    assert resp.status_code == 501
    body = resp.json()
    assert body["error"]["code"] == "FEATURE_NOT_AVAILABLE"
