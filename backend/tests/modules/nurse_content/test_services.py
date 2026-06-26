"""Nurse content service tests."""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")

import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

from app.core.database import Base
from app.modules.nurse_content.exceptions import ContentNotFoundError, UnauthorizedContentError
from app.modules.nurse_content.schemas import ContentCreate, ContentUpdate
from app.modules.nurse_content.services import NurseContentService


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models as _auth_models  # noqa: F401 (users table for FK)
        from app.modules.nurse_content import models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> NurseContentService:
    return NurseContentService(db=db_session)


nurse_id = uuid.uuid4()
other_nurse_id = uuid.uuid4()


@pytest.mark.asyncio
async def test_get_or_create_profile(svc: NurseContentService) -> None:
    profile = await svc.get_or_create_profile(nurse_id)
    assert profile.user_id == nurse_id


@pytest.mark.asyncio
async def test_create_content(svc: NurseContentService) -> None:
    data = ContentCreate(title="Breathing Basics", description="Learn to breathe", category="wellness")
    content = await svc.create_content(nurse_id, data)
    assert content.title == "Breathing Basics"
    assert content.status == "pending"


@pytest.mark.asyncio
async def test_list_own_content(svc: NurseContentService) -> None:
    await svc.create_content(nurse_id, ContentCreate(title="A", category="wellness"))
    await svc.create_content(nurse_id, ContentCreate(title="B", category="wellness"))
    items = await svc.list_own_content(nurse_id)
    assert len(items) == 2


@pytest.mark.asyncio
async def test_get_content_not_found(svc: NurseContentService) -> None:
    with pytest.raises(ContentNotFoundError):
        await svc.get_content(uuid.uuid4())


@pytest.mark.asyncio
async def test_update_content(svc: NurseContentService) -> None:
    content = await svc.create_content(nurse_id, ContentCreate(title="Original", category="nutrition"))
    updated = await svc.update_content(content.id, nurse_id, ContentUpdate(title="Updated"))
    assert updated.title == "Updated"


@pytest.mark.asyncio
async def test_update_other_nurse_content_raises(svc: NurseContentService) -> None:
    content = await svc.create_content(nurse_id, ContentCreate(title="Mine", category="wellness"))
    with pytest.raises(UnauthorizedContentError):
        await svc.update_content(content.id, other_nurse_id, ContentUpdate(title="Hacked"))


@pytest.mark.asyncio
async def test_delete_other_nurse_content_raises(svc: NurseContentService) -> None:
    content = await svc.create_content(nurse_id, ContentCreate(title="Mine", category="wellness"))
    with pytest.raises(UnauthorizedContentError):
        await svc.delete_content(content.id, other_nurse_id)


@pytest.mark.asyncio
async def test_approve_content(svc: NurseContentService) -> None:
    admin_id = uuid.uuid4()
    content = await svc.create_content(nurse_id, ContentCreate(title="Approve me", category="wellness"))
    approved = await svc.approve_content(content.id, admin_id)
    assert approved.status == "approved"
    assert approved.approved_by == admin_id


@pytest.mark.asyncio
async def test_list_pending(svc: NurseContentService) -> None:
    await svc.create_content(nurse_id, ContentCreate(title="Pending 1", category="wellness"))
    await svc.create_content(nurse_id, ContentCreate(title="Pending 2", category="nutrition"))
    pending = await svc.list_pending()
    assert len(pending) == 2


@pytest.mark.asyncio
async def test_list_approved(svc: NurseContentService) -> None:
    content = await svc.create_content(nurse_id, ContentCreate(title="Approved content", category="wellness"))
    await svc.approve_content(content.id, uuid.uuid4())
    approved = await svc.list_approved()
    assert len(approved) == 1


@pytest.mark.asyncio
async def test_list_approved_by_category(svc: NurseContentService) -> None:
    c1 = await svc.create_content(nurse_id, ContentCreate(title="Wellness", category="wellness"))
    c2 = await svc.create_content(nurse_id, ContentCreate(title="Nutrition", category="nutrition"))
    await svc.approve_content(c1.id, uuid.uuid4())
    await svc.approve_content(c2.id, uuid.uuid4())
    wellness = await svc.list_approved(category="wellness")
    assert len(wellness) == 1
    assert wellness[0].category == "wellness"
