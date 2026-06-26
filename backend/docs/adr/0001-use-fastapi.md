# ADR 0001: Framework and Language Choice

**Date:** 2026-06-13
**Status:** Accepted

## Context
SheCare backend needs a performant, async-native framework for mobile API serving.

## Decision
Use **Python 3.11+** with **FastAPI** for the HTTP layer. Use **SQLAlchemy 2.x async** for database access.

## Rationale
- FastAPI provides native async support, automatic OpenAPI docs, and Pydantic-based validation.
- Python allows rapid iteration and large talent pool.
- SQLAlchemy 2.x async supports PostgreSQL-specific features (JSONB, UUID).

## Consequences
- All endpoint handlers are async.
- Pydantic schemas serve as both validation layer and API contract.
