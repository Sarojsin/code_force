# ADR 0004: Celery for Async Task Queue

**Date:** 2026-06-13
**Status:** Accepted

## Context
Need async processing for sentiment analysis, SOS notifications, push broadcasts, and periodic cleanup.

## Decision
Use **Celery with Redis** as both broker and result backend.

## Rationale
- Celery is the most mature async task queue for Python.
- Redis is already in the stack for rate limiting and caching.
- Celery beat provides reliable periodic task scheduling.
- Three queues (default, priority, ai) ensure SOS alerts aren't blocked by AI analysis.

## Consequences
- All tasks are idempotent with soft/hard time limits.
- Tasks use `task_id` based on business key for deduplication.
- Dead-letter pattern for tasks that exhaust retries.
