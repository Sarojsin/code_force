from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")

import uuid
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


from app.core.database import Base
from app.modules.auth.models import User
from app.modules.family.services import FamilyService


@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        from app.modules.auth import models as _auth_models  # noqa: F401
        from app.modules.family import models as _family_models  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with Session() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def svc(db_session: AsyncSession) -> FamilyService:
    return FamilyService(db=db_session)


@pytest_asyncio.fixture
async def users(db_session: AsyncSession) -> tuple[User, User]:
    u1 = User(email="alice@test.com", provider="local", user_secret_key="a" * 64)
    u2 = User(email="bob@test.com", provider="local", user_secret_key="b" * 64)
    db_session.add_all([u1, u2])
    await db_session.commit()
    await db_session.refresh(u1)
    await db_session.refresh(u2)
    return u1, u2


@pytest.mark.asyncio
async def test_generate_invite(svc: FamilyService, users: tuple[User, User]) -> None:
    u1, u2 = users
    link, token = await svc.generate_invite(u1.id, permission_level=1)
    assert link.user_id == u1.id
    assert link.status == "pending"
    assert token is not None


@pytest.mark.asyncio
async def test_get_invite_info(svc: FamilyService, users: tuple[User, User]) -> None:
    u1, u2 = users
    link, token = await svc.generate_invite(u1.id, permission_level=1)
    info = await svc.get_invite_info(token)
    assert info.user_id == u1.id


@pytest.mark.asyncio
async def test_accept_invite(svc: FamilyService, users: tuple[User, User]) -> None:
    u1, u2 = users
    link, token = await svc.generate_invite(u1.id, permission_level=1)
    accepted = await svc.accept_invite(token, u2.id)
    assert accepted.status == "accepted"
    assert accepted.linked_user_id == u2.id


@pytest.mark.asyncio
async def test_list_links(svc: FamilyService, users: tuple[User, User]) -> None:
    u1, u2 = users
    link, token = await svc.generate_invite(u1.id, permission_level=1)
    await svc.accept_invite(token, u2.id)
    links = await svc.list_links(u1.id)
    assert len(links) >= 1
