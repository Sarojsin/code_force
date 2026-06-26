"""Pytest fixtures shared across all tests (rule §9)."""

import asyncio
import os
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Force the test environment BEFORE importing the app.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "postgresql+asyncpg://shecare:shecare@localhost:5432/shecare_test")
os.environ.setdefault("REDIS__URL", "redis://localhost:6379/15")


@pytest.fixture(scope="session")
def event_loop() -> AsyncIterator[asyncio.AbstractEventLoop]:
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    from app.main import create_app

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
