from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy import Column, Integer, String, select
from sqlalchemy.orm import declarative_base

from app.core.pagination import (
    CursorPage,
    CursorParams,
    Page,
    PageParams,
    get_cursor_params,
    get_offset_params,
    paginate_cursor,
    paginate_offset,
)

Base = declarative_base()


class FakeModel(Base):
    __tablename__ = "fake"
    id = Column(Integer, primary_key=True)
    name = Column(String)


def test_page_params_defaults() -> None:
    params = PageParams()
    assert params.limit == 50
    assert params.offset == 0


def test_page_params_custom() -> None:
    params = PageParams(limit=10, offset=20)
    assert params.limit == 10
    assert params.offset == 20


def test_cursor_params_defaults() -> None:
    params = CursorParams()
    assert params.limit == 20
    assert params.cursor is None


def test_cursor_params_with_cursor() -> None:
    params = CursorParams(limit=5, cursor="abc")
    assert params.limit == 5
    assert params.cursor == "abc"


def test_page_model() -> None:
    page = Page(items=["a", "b"], total=10, limit=5, offset=0, next_offset=5)
    assert page.items == ["a", "b"]
    assert page.total == 10
    assert page.next_offset == 5


def test_cursor_page_model() -> None:
    page = CursorPage(items=["a"], next_cursor="xyz", has_more=True)
    assert page.next_cursor == "xyz"
    assert page.has_more is True


@pytest.mark.asyncio
async def test_paginate_offset() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar.return_value = 1
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = [FakeModel(id=1, name="a")]
    mock_result.scalars.return_value = mock_scalars

    async def mock_execute(stmt):
        return mock_result

    mock_db.execute = mock_execute

    stmt = select(FakeModel)
    page = await paginate_offset(mock_db, stmt, limit=10, offset=0)
    assert isinstance(page, Page)
    assert len(page.items) <= 10


@pytest.mark.asyncio
async def test_paginate_cursor() -> None:
    mock_db = AsyncMock()
    mock_result = MagicMock()
    item = FakeModel(id=1, name="a")
    mock_scalars = MagicMock()
    mock_scalars.all.return_value = [item]
    mock_result.scalars.return_value = mock_scalars

    async def mock_execute(stmt):
        return mock_result

    mock_db.execute = mock_execute

    stmt = select(FakeModel)
    page = await paginate_cursor(
        mock_db, stmt, FakeModel.id, limit=10, cursor=None
    )
    assert isinstance(page, CursorPage)


def test_get_offset_params() -> None:
    import asyncio
    params = asyncio.run(get_offset_params(limit=20, offset=10))
    assert params.limit == 20
    assert params.offset == 10


def test_get_cursor_params() -> None:
    import asyncio
    params = asyncio.run(get_cursor_params(limit=5, cursor="abc"))
    assert params.limit == 5
    assert params.cursor == "abc"
