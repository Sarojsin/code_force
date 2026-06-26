"""Smoke test: app boots and /health/live returns 200."""

import pytest


@pytest.mark.asyncio
async def test_health_live(client) -> None:
    response = await client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
