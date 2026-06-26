# ADR 0003: Cross-Module Communication via Event Bus

**Date:** 2026-06-13
**Status:** Accepted

## Context
Backend is organized by feature modules. Modules must not import each other's services directly.

## Decision
Use an **in-process event bus** (`core/event_bus.py`) for synchronous cross-module communication. For async work, subscribers enqueue a Celery task.

## Rationale
- Keeps modules fully decoupled. A module's only public surface is its events + route handlers.
- Simpler than a message broker for in-process events.
- Celery handles durability and retries for async work.

## Consequences
- Module A cannot call Module B's service directly. Module A emits an event; Module B subscribes.
- Subscriber registration happens in the subscriber's module, not the emitter's.
- Event payloads should be simple dicts, not ORM models.
