"""Pagination helpers: offset-based (admin) and cursor-based (user-facing).

Plan 23: project invariant §3.
"""

from __future__ import annotations

from typing import Any, Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class PageParams(BaseModel):
    """Offset-based pagination params for admin lists (project invariant §3)."""

    limit: int = 50
    offset: int = 0


class CursorParams(BaseModel):
    """Cursor-based pagination params for user-facing lists."""

    limit: int = 20
    cursor: str | None = None


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int
    next_offset: int | None = None


class CursorPage(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None
    has_more: bool = False


async def paginate_offset(
    db: AsyncSession,
    stmt: Select,
    limit: int = 50,
    offset: int = 0,
) -> Page:
    """Execute an offset/limit paginated query. Returns Page with total."""
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    result = await db.execute(stmt.offset(offset).limit(limit))
    items = list(result.scalars().all())
    next_offset = offset + limit if offset + limit < total else None
    return Page(items=items, total=total, limit=limit, offset=offset, next_offset=next_offset)


async def paginate_cursor(
    db: AsyncSession,
    stmt: Select,
    cursor_column: Any,
    limit: int = 20,
    cursor: str | None = None,
) -> CursorPage:
    """Execute a cursor-based paginated query.

    Expects ``cursor_column`` to be the SQLAlchemy column used for ordering
    (typically an auto-incrementing int or UUID hex). The cursor value is
    opaque to the caller.
    """
    if cursor:
        stmt = stmt.where(cursor_column > cursor)
    stmt = stmt.limit(limit + 1)
    result = await db.execute(stmt)
    rows = list(result.scalars().all())
    has_more = len(rows) > limit
    items = rows[:limit]
    next_cursor = str(getattr(items[-1], cursor_column.key, "")) if items and has_more else None
    return CursorPage(items=items, next_cursor=next_cursor, has_more=has_more)


# FastAPI-compatible dependency for easier injection
async def get_offset_params(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)) -> PageParams:
    return PageParams(limit=limit, offset=offset)


async def get_cursor_params(limit: int = Query(20, ge=1, le=100), cursor: str | None = Query(None)) -> CursorParams:
    return CursorParams(limit=limit, cursor=cursor)
