"""Wellness Celery task tests: analyze_journal_sentiment, generate_weekly_insights."""

from __future__ import annotations

import os

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("ENCRYPTION__MASTER_KEY", "test-master-key-for-tests-only-32b")

import asyncio
import uuid
from datetime import UTC, date, datetime
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

from app.core.celery_app import celery_app
from app.core.database import Base


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


@pytest.fixture(autouse=True)
def eager_celery() -> None:
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = True
    yield
    celery_app.conf.task_always_eager = False
    celery_app.conf.task_eager_propagates = False


@pytest.fixture
def db_session():
    """Create in-memory SQLite engine, patch AsyncSessionLocal, yield sessionmaker."""
    import app.core.database as db_module
    from app.modules.auth import models as _auth_models  # noqa: F401
    from app.modules.wellness import models  # noqa: F401

    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    async def _init() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    asyncio.run(_init())

    sm = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    original = db_module.AsyncSessionLocal
    db_module.AsyncSessionLocal = sm

    yield sm

    db_module.AsyncSessionLocal = original
    asyncio.run(engine.dispose())


def _run(coro):
    """Execute an async coroutine from a synchronous test context."""
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# analyze_journal_sentiment
# ---------------------------------------------------------------------------


def _seed_journal_entry(sm, user_id: uuid.UUID, entry_id: uuid.UUID) -> None:
    from app.modules.auth.models import User
    from app.modules.wellness.models import JournalEntry

    async def _seed() -> None:
        async with sm() as session:
            session.add(User(id=user_id, email="test@wellness.com", provider="local", is_verified=True))
            session.add(
                JournalEntry(id=entry_id, user_id=user_id, content="encrypted-content", entry_date=date.today())
            )
            await session.commit()

    _run(_seed())


def test_analyze_journal_sentiment_success(db_session) -> None:
    from app.modules.wellness.tasks import analyze_journal_sentiment

    sm = db_session
    user_id = uuid.uuid4()
    entry_id = uuid.uuid4()
    _seed_journal_entry(sm, user_id, entry_id)

    result = analyze_journal_sentiment.delay(str(entry_id), str(user_id))

    assert result.successful()

    async def _verify() -> None:
        from app.modules.wellness.models import JournalEntry

        async with sm() as session:
            entry = (await session.execute(select(JournalEntry).where(JournalEntry.id == entry_id))).scalar_one()
            assert entry.sentiment_label is not None
            assert entry.sentiment_score is not None
            assert entry.analyzed_at is not None

    _run(_verify())


def test_analyze_journal_sentiment_entry_not_found(db_session) -> None:
    from app.modules.wellness.tasks import analyze_journal_sentiment

    result = analyze_journal_sentiment.delay(str(uuid.uuid4()), str(uuid.uuid4()))

    assert result.successful()


def test_analyze_journal_sentiment_huggingface_failure(db_session) -> None:
    from app.integrations.huggingface_client import HuggingFaceClient
    from app.modules.wellness.tasks import analyze_journal_sentiment

    sm = db_session
    user_id = uuid.uuid4()
    entry_id = uuid.uuid4()
    _seed_journal_entry(sm, user_id, entry_id)

    with patch.object(HuggingFaceClient, "analyze_sentiment", side_effect=Exception("API error")):
        with pytest.raises(Exception, match="API error"):
            analyze_journal_sentiment.delay(str(entry_id), str(user_id))


# ---------------------------------------------------------------------------
# generate_weekly_insights
# ---------------------------------------------------------------------------


def test_generate_weekly_insights_empty(db_session) -> None:
    from app.modules.wellness.tasks import generate_weekly_insights

    mock_svc = AsyncMock()

    with patch("app.modules.wellness.services.WellnessService", return_value=mock_svc):
        result = generate_weekly_insights.delay()

    assert result.successful()
    assert result.result == 0
    mock_svc.get_insights.assert_not_awaited()


def test_generate_weekly_insights_with_active_users(db_session) -> None:
    from app.modules.wellness.tasks import generate_weekly_insights
    from app.modules.auth.models import User

    sm = db_session
    user_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            session.add(
                User(id=user_id, email="active@wellness.com", provider="local", is_verified=True, is_active=True)
            )
            await session.commit()

    _run(_seed())

    mock_svc = AsyncMock()
    mock_svc.get_insights.return_value = {
        "total_journal_entries": 0,
        "total_mood_logs": 0,
        "average_mood_intensity": None,
        "most_common_mood": None,
        "recommendation": "Keep logging your moods and journal entries for personalized insights.",
    }

    with patch("app.modules.wellness.services.WellnessService", return_value=mock_svc):
        result = generate_weekly_insights.delay()

    assert result.successful()
    assert result.result == 1
    mock_svc.get_insights.assert_awaited_once_with(user_id)


def test_generate_weekly_insights_skips_inactive(db_session) -> None:
    from app.modules.wellness.tasks import generate_weekly_insights
    from app.modules.auth.models import User

    sm = db_session

    async def _seed() -> None:
        async with sm() as session:
            session.add(
                User(id=uuid.uuid4(), email="active@wellness.com", provider="local", is_verified=True, is_active=True)
            )
            session.add(
                User(
                    id=uuid.uuid4(), email="inactive@wellness.com", provider="local", is_verified=True, is_active=False
                )
            )
            await session.commit()

    _run(_seed())

    mock_svc = AsyncMock()
    mock_svc.get_insights.return_value = {
        "total_journal_entries": 0,
        "total_mood_logs": 0,
    }

    with patch("app.modules.wellness.services.WellnessService", return_value=mock_svc):
        result = generate_weekly_insights.delay()

    assert result.successful()
    assert result.result == 1


def test_generate_weekly_insights_partial_failure(db_session) -> None:
    from app.modules.wellness.tasks import generate_weekly_insights
    from app.modules.auth.models import User

    sm = db_session
    good_id = uuid.uuid4()
    bad_id = uuid.uuid4()

    async def _seed() -> None:
        async with sm() as session:
            session.add(
                User(id=good_id, email="good@wellness.com", provider="local", is_verified=True, is_active=True)
            )
            session.add(
                User(id=bad_id, email="bad@wellness.com", provider="local", is_verified=True, is_active=True)
            )
            await session.commit()

    _run(_seed())

    mock_svc = AsyncMock()
    mock_svc.get_insights.side_effect = [
        {"total_journal_entries": 5, "total_mood_logs": 3},
        Exception("insights error"),
    ]

    with patch("app.modules.wellness.services.WellnessService", return_value=mock_svc):
        result = generate_weekly_insights.delay()

    assert result.successful()
    assert result.result == 1
    assert mock_svc.get_insights.await_count == 2
