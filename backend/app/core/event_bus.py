"""In-process event bus for cross-module communication.

Backend rule §10: modules communicate via events, never direct service imports.
For distributed deployment, swap this for a Redis pub/sub implementation —
the public API stays the same.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")
EventHandler = Callable[..., Awaitable[None]]


class EventBus:
    """Simple async pub/sub. Subscribers are async callables."""

    def __init__(self) -> None:
        self._subscribers: dict[str, list[EventHandler]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, event_name: str, handler: EventHandler) -> None:
        async with self._lock:
            self._subscribers.setdefault(event_name, []).append(handler)

    def subscribe_sync(self, event_name: str, handler: EventHandler) -> None:
        """For module init_module() hooks (called outside async context)."""
        self._subscribers.setdefault(event_name, []).append(handler)

    async def emit(self, event_name: str, **payload: Any) -> None:
        handlers = list(self._subscribers.get(event_name, []))
        if not handlers:
            logger.debug("event_bus.no_subscribers", extra={"event": event_name})
            return
        await asyncio.gather(
            *(self._safe_invoke(h, event_name, payload) for h in handlers),
            return_exceptions=False,
        )
        logger.debug(
            "event_bus.dispatched",
            extra={"event": event_name, "handler_count": len(handlers)},
        )
        return None  # results currently unused; keep for future metrics

    @staticmethod
    async def _safe_invoke(
        handler: EventHandler,
        event_name: str,
        payload: dict[str, Any],
    ) -> None:
        try:
            await handler(**payload)
        except Exception:
            # Rule §10: subscriber failure must not break the emitter.
            # Logged with traceback so Sentry can pick it up.
            logger.exception("event_bus.subscriber_failed", extra={"event": event_name})


# Module-level singleton. Tests can reset it.
event_bus = EventBus()
