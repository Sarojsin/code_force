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
from app.integrations.cloudinary_client import CloudinaryClient
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
admin_id = uuid.uuid4()


@pytest.mark.asyncio
async def test_get_or_create_profile(svc: NurseContentService) -> None:
    profile = await svc.get_or_create_profile(nurse_id)
    assert profile.user_id == nurse_id


@pytest.mark.asyncio
async def test_create_content(svc: NurseContentService) -> None:
    data = ContentCreate(title="Breathing Basics", description="Learn to breathe", category="wellness")
    content = await svc.create_content(nurse_id, data)
    assert content.title == "Breathing Basics"
    assert content.status == "draft"


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
async def test_submit_and_approve_content(svc: NurseContentService) -> None:
    content = await svc.create_content(nurse_id, ContentCreate(title="Approve me", category="wellness"))
    assert content.status == "draft"

    # Submit for review: draft -> pending
    submitted = await svc.submit_content(content.id, nurse_id)
    assert submitted.status == "pending"

    # Approve: pending -> approved
    approved = await svc.approve_content(submitted.id, admin_id)
    assert approved.status == "approved"
    assert approved.approved_by == admin_id


@pytest.mark.asyncio
async def test_reject_content(svc: NurseContentService) -> None:
    content = await svc.create_content(nurse_id, ContentCreate(title="Reject me", category="wellness"))
    submitted = await svc.submit_content(content.id, nurse_id)

    rejected = await svc.reject_content(submitted.id, admin_id)
    assert rejected.status == "rejected"

    # Rejected content can be edited and resubmitted
    updated = await svc.update_content(rejected.id, nurse_id, ContentUpdate(title="Fixed"))
    assert updated.status == "draft"

    resubmitted = await svc.submit_content(updated.id, nurse_id)
    assert resubmitted.status == "pending"


@pytest.mark.asyncio
async def test_unpublish_and_publish_content(svc: NurseContentService) -> None:
    content = await svc.create_content(nurse_id, ContentCreate(title="Unpublish me", category="wellness"))
    submitted = await svc.submit_content(content.id, nurse_id)
    approved = await svc.approve_content(submitted.id, admin_id)

    # Unpublish: approved -> unpublished
    unpublished = await svc.unpublish_content(approved.id, admin_id)
    assert unpublished.status == "unpublished"
    assert unpublished.published_at is None

    # Re-publish: unpublished -> approved
    republished = await svc.publish_content(unpublished.id, admin_id)
    assert republished.status == "approved"
    assert republished.published_at is not None


@pytest.mark.asyncio
async def test_list_pending(svc: NurseContentService) -> None:
    c1 = await svc.create_content(nurse_id, ContentCreate(title="Pending 1", category="wellness"))
    await svc.submit_content(c1.id, nurse_id)
    c2 = await svc.create_content(nurse_id, ContentCreate(title="Pending 2", category="nutrition"))
    await svc.submit_content(c2.id, nurse_id)
    pending = await svc.list_pending()
    assert len(pending) == 2


@pytest.mark.asyncio
async def test_list_approved(svc: NurseContentService) -> None:
    content = await svc.create_content(nurse_id, ContentCreate(title="Approved content", category="wellness"))
    submitted = await svc.submit_content(content.id, nurse_id)
    await svc.approve_content(submitted.id, admin_id)
    approved = await svc.list_approved()
    assert len(approved) == 1


@pytest.mark.asyncio
async def test_list_approved_by_category(svc: NurseContentService) -> None:
    c1 = await svc.create_content(nurse_id, ContentCreate(title="Wellness", category="wellness"))
    c2 = await svc.create_content(nurse_id, ContentCreate(title="Nutrition", category="nutrition"))
    s1 = await svc.submit_content(c1.id, nurse_id)
    s2 = await svc.submit_content(c2.id, nurse_id)
    await svc.approve_content(s1.id, admin_id)
    await svc.approve_content(s2.id, admin_id)
    wellness = await svc.list_approved(category="wellness")
    assert len(wellness) == 1
    assert wellness[0].category == "wellness"


class FakeCloudinary:
    """Stands in for CloudinaryClient without network access."""

    def __init__(self) -> None:
        self.configured = True
        self.deleted_urls: list[str | None] = []

    def delete_by_url(self, url: str | None) -> None:
        if CloudinaryClient.parse_url(url) is not None:
            self.deleted_urls.append(url)


def _cloudy_service(db_session: AsyncSession) -> tuple[NurseContentService, FakeCloudinary]:
    fake = FakeCloudinary()
    return NurseContentService(db=db_session, cloudinary=fake), fake


VIDEO_URL = "https://res.cloudinary.com/demo/video/upload/v1653838283/health_content/demo.mp4"
THUMB_URL = "https://res.cloudinary.com/demo/image/upload/v1653838283/health_content/demo.jpg"


def test_cloudinary_parse_url_video() -> None:
    parsed = CloudinaryClient.parse_url(VIDEO_URL)
    assert parsed == ("health_content/demo", "video")


def test_cloudinary_parse_url_no_version() -> None:
    parsed = CloudinaryClient.parse_url("https://res.cloudinary.com/demo/image/upload/health_content/a.png")
    assert parsed == ("health_content/a", "image")


def test_cloudinary_parse_url_with_transformations() -> None:
    parsed = CloudinaryClient.parse_url(
        "https://res.cloudinary.com/demo/image/upload/w_400,c_fill,q_auto,f_auto/v1653838283/health_content/demo.jpg"
    )
    assert parsed == ("health_content/demo", "image")


def test_cloudinary_parse_url_external_returns_none() -> None:
    assert CloudinaryClient.parse_url("https://cdn.example.com/v.mp4") is None
    assert CloudinaryClient.parse_url(None) is None
    assert CloudinaryClient.parse_url("") is None


@pytest.mark.asyncio
async def test_edit_approved_content_keeps_status_and_refreshes_published_at(
    db_session: AsyncSession,
) -> None:
    svc, _ = _cloudy_service(db_session)
    content = await svc.create_content(nurse_id, ContentCreate(title="Live", category="wellness"))
    submitted = await svc.submit_content(content.id, nurse_id)
    approved = await svc.approve_content(submitted.id, admin_id)
    created_at_published = approved.published_at

    updated = await svc.update_content(approved.id, nurse_id, ContentUpdate(title="Live v2"))
    assert updated.status == "approved"
    assert updated.title == "Live v2"
    assert updated.published_at is not None
    assert updated.published_at >= created_at_published


@pytest.mark.asyncio
async def test_edit_unpublished_content_keeps_status(db_session: AsyncSession) -> None:
    svc, _ = _cloudy_service(db_session)
    content = await svc.create_content(nurse_id, ContentCreate(title="Draft", category="wellness"))
    submitted = await svc.submit_content(content.id, nurse_id)
    approved = await svc.approve_content(submitted.id, admin_id)
    unpublished = await svc.unpublish_content(approved.id, admin_id)

    updated = await svc.update_content(unpublished.id, nurse_id, ContentUpdate(title="Edits unpublished"))
    assert updated.status == "unpublished"


@pytest.mark.asyncio
async def test_update_replacing_video_deletes_old_cloudinary_asset(
    db_session: AsyncSession,
) -> None:
    svc, fake = _cloudy_service(db_session)
    content = await svc.create_content(
        nurse_id, ContentCreate(title="Vid", category="wellness", video_url=VIDEO_URL)
    )
    new_url = "https://res.cloudinary.com/demo/video/upload/v9999/health_content/new.mp4"

    updated = await svc.update_content(content.id, nurse_id, ContentUpdate(video_url=new_url))
    assert updated.video_url == new_url
    assert fake.deleted_urls == [VIDEO_URL]


@pytest.mark.asyncio
async def test_update_replacing_thumbnail_deletes_old_cloudinary_asset(
    db_session: AsyncSession,
) -> None:
    svc, fake = _cloudy_service(db_session)
    content = await svc.create_content(
        nurse_id, ContentCreate(title="With thumb", category="wellness", thumbnail_url=THUMB_URL)
    )
    new_thumb = "https://res.cloudinary.com/demo/image/upload/v9999/health_content/new.jpg"

    await svc.update_content(content.id, nurse_id, ContentUpdate(thumbnail_url=new_thumb))
    assert fake.deleted_urls == [THUMB_URL]


@pytest.mark.asyncio
async def test_update_without_media_change_does_not_delete(db_session: AsyncSession) -> None:
    svc, fake = _cloudy_service(db_session)
    content = await svc.create_content(
        nurse_id, ContentCreate(title="Vid", category="wellness", video_url=VIDEO_URL)
    )

    await svc.update_content(content.id, nurse_id, ContentUpdate(title="Renamed only"))
    assert fake.deleted_urls == []


@pytest.mark.asyncio
async def test_update_replacing_external_video_does_not_delete(db_session: AsyncSession) -> None:
    svc, fake = _cloudy_service(db_session)
    content = await svc.create_content(
        nurse_id,
        ContentCreate(title="Ext", category="wellness", video_url="https://cdn.example.com/v.mp4"),
    )

    await svc.update_content(
        content.id, nurse_id, ContentUpdate(video_url="https://cdn.example.com/new.mp4")
    )
    assert fake.deleted_urls == []


@pytest.mark.asyncio
async def test_delete_content_removes_cloudinary_media(db_session: AsyncSession) -> None:
    svc, fake = _cloudy_service(db_session)
    content = await svc.create_content(
        nurse_id,
        ContentCreate(title="Del", category="wellness", video_url=VIDEO_URL, thumbnail_url=THUMB_URL),
    )

    await svc.delete_content(content.id, nurse_id)
    assert sorted(fake.deleted_urls) == sorted([VIDEO_URL, THUMB_URL])
    assert content.is_active is False


@pytest.mark.asyncio
async def test_update_pending_content_raises(db_session: AsyncSession) -> None:
    svc, _ = _cloudy_service(db_session)
    content = await svc.create_content(nurse_id, ContentCreate(title="Pad", category="wellness"))
    submitted = await svc.submit_content(content.id, nurse_id)

    from app.modules.nurse_content.exceptions import ContentStateError

    with pytest.raises(ContentStateError):
        await svc.update_content(
            submitted.id, nurse_id, ContentUpdate(title="Pending edit forbidden")
        )
