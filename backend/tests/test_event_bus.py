import pytest
from unittest.mock import AsyncMock

from app.core.event_bus import EventBus


@pytest.fixture
def bus() -> EventBus:
    return EventBus()


@pytest.mark.asyncio
async def test_subscribe_and_emit(bus: EventBus) -> None:
    handler = AsyncMock()
    await bus.subscribe("user_registered", handler)
    await bus.emit("user_registered", user_id="abc")
    handler.assert_awaited_once_with(user_id="abc")


@pytest.mark.asyncio
async def test_emit_no_subscribers_logs_only(bus: EventBus) -> None:
    await bus.emit("unused_event", data=1)


@pytest.mark.asyncio
async def test_multiple_subscribers_all_called(bus: EventBus) -> None:
    handler1 = AsyncMock()
    handler2 = AsyncMock()
    await bus.subscribe("order_placed", handler1)
    await bus.subscribe("order_placed", handler2)
    await bus.emit("order_placed", order_id=42)
    handler1.assert_awaited_once_with(order_id=42)
    handler2.assert_awaited_once_with(order_id=42)


@pytest.mark.asyncio
async def test_subscriber_error_does_not_break_others(bus: EventBus) -> None:
    failing = AsyncMock(side_effect=ValueError("oops"))
    succeeding = AsyncMock()
    await bus.subscribe("event", failing)
    await bus.subscribe("event", succeeding)
    await bus.emit("event", x=1)
    succeeding.assert_awaited_once_with(x=1)


@pytest.mark.asyncio
async def test_subscribe_sync_adds_handler(bus: EventBus) -> None:
    handler = AsyncMock()
    bus.subscribe_sync("sync_event", handler)
    await bus.emit("sync_event", val=99)
    handler.assert_awaited_once_with(val=99)


@pytest.mark.asyncio
async def test_event_payload_is_kwargs(bus: EventBus) -> None:
    handler = AsyncMock()
    await bus.subscribe("test", handler)
    await bus.emit("test", a=1, b="two", c=[3])
    handler.assert_awaited_once_with(a=1, b="two", c=[3])
