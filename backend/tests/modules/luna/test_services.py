"""Luna state service tests (luna2phase4 §5).

Covers `compute_mood_trend`, `merge_mood_samples`, `LunaService` upsert/LWW
semantics, size caps, and the `day_logged` bridge. Uses in-memory SQLite with
a JSONB→JSON compiler shim (pattern from `tests/modules/wellness/`).
"""

from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime, timedelta

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("DATABASE__URL", "sqlite+aiosqlite:///:memory:")

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles

import app.modules.auth.models
import app.modules.luna.models  # noqa: F401
from app.core.database import Base
from app.core.encryption import make_user_salt
from app.modules.luna.exceptions import LunaValidationError
from app.modules.luna.models import LunaState
from app.modules.luna.schemas import LunaStateUpdate, MoodSample
from app.modules.luna.services import (
    LunaService,
    compute_mood_trend,
    merge_mood_samples,
    refresh_mood_trend_from_day_logged,
)


@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


def _sample(date: str, mood: str, source: str = "manual", intensity: int = 3) -> MoodSample:
    return MoodSample(
        date=date,
        mood=mood,  # type: ignore[arg-type]
        intensity=intensity,
        source=source,  # type: ignore[arg-type]
        created_at=datetime.now(UTC),
    )


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    user_id = uuid.uuid4()
    async with factory() as db:
        from app.modules.auth.models import User

        db.add(
            User(
                id=user_id,
                email="luna@test.com",
                display_name="Luna Tester",
                user_secret_key=str(uuid.uuid4()),
                encryption_key_salt=make_user_salt(),
                is_verified=True,
                provider="local",
            )
        )
        await db.commit()
    async with factory() as db:
        yield (db, user_id)
    await engine.dispose()


# ---------------------------------------------------------------------------
# compute_mood_trend
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_trend_requires_min_samples(session) -> None:
    assert compute_mood_trend([]) == "stable"
    assert compute_mood_trend([_sample("2026-08-01", "happy")]) == "stable"
    assert compute_mood_trend(
        [_sample("2026-08-01", "happy"), _sample("2026-08-02", "happy")]
    ) == "stable"


@pytest.mark.asyncio
async def test_trend_improving(session) -> None:
    samples = [
        _sample("2026-08-01", "neutral"),
        _sample("2026-08-02", "neutral"),
        _sample("2026-08-03", "happy"),
    ]
    assert compute_mood_trend(samples) == "improving"


@pytest.mark.asyncio
async def test_trend_declining(session) -> None:
    samples = [
        _sample("2026-08-01", "happy"),
        _sample("2026-08-02", "neutral"),
        _sample("2026-08-03", "sad"),
    ]
    assert compute_mood_trend(samples) == "declining"


@pytest.mark.asyncio
async def test_trend_volatile(session) -> None:
    samples = [
        _sample("2026-08-01", "happy"),
        _sample("2026-08-02", "angry"),
        _sample("2026-08-03", "angry"),
        _sample("2026-08-04", "happy"),
    ]
    assert compute_mood_trend(samples) == "volatile"


@pytest.mark.asyncio
async def test_trend_stable(session) -> None:
    samples = [_sample(f"2026-08-0{i}", "neutral") for i in range(1, 6)]
    assert compute_mood_trend(samples) == "stable"


# ---------------------------------------------------------------------------
# merge_mood_samples
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_merge_dedupes_by_date_and_source(session) -> None:
    existing = [_sample("2026-08-01", "happy", source="manual")]
    incoming = [_sample("2026-08-01", "sad", source="manual")]
    merged = merge_mood_samples(existing, incoming)
    assert len(merged) == 1
    assert merged[0].mood == "sad"  # incoming wins


@pytest.mark.asyncio
async def test_merge_keeps_distinct_sources(session) -> None:
    existing = [_sample("2026-08-01", "happy", source="day_logged")]
    incoming = [_sample("2026-08-01", "sad", source="manual")]
    merged = merge_mood_samples(existing, incoming)
    assert len(merged) == 2


@pytest.mark.asyncio
async def test_merge_trims_to_thirty_most_recent(session) -> None:
    existing = [_sample(f"2026-08-{i:02d}", "neutral") for i in range(1, 25)]
    incoming = [_sample(f"2026-09-{i:02d}", "neutral") for i in range(1, 11)]
    merged = merge_mood_samples(existing, incoming)
    assert len(merged) == 30
    assert merged[-1].date == "2026-09-10"


@pytest.mark.asyncio
async def test_merge_tolerates_malformed_entries(session) -> None:
    merged = merge_mood_samples([{"date": "not-a-date"}], [_sample("2026-08-01", "happy")])
    assert len(merged) == 1
    assert merged[0].mood == "happy"


# ---------------------------------------------------------------------------
# LunaService.get_state / upsert_state
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_state_creates_default_row(session) -> None:
    db, user_id = session
    state = await LunaService(db).get_state(user_id)
    assert state.xp == 0
    assert state.level == 1
    assert state.coins == 0
    assert state.relationship_level == 1
    assert state.mood_trend == {}
    assert state.preferences == {}
    assert state.achievements == []
    assert state.habit_patterns == {}


@pytest.mark.asyncio
async def test_upsert_partial_update_leaves_other_fields(session) -> None:
    db, user_id = session
    svc = LunaService(db)
    await svc.get_state(user_id)
    now = datetime.now(UTC).isoformat()
    updated = await svc.upsert_state(
        user_id,
        LunaStateUpdate(xp=120, coins=45, client_updated_at=now),
    )
    assert updated.xp == 120
    assert updated.coins == 45
    assert updated.level == 1  # untouched


@pytest.mark.asyncio
async def test_upsert_lww_newer_wins(session) -> None:
    db, user_id = session
    svc = LunaService(db)
    t0 = datetime.now(UTC).isoformat()
    t1 = (datetime.now(UTC) + timedelta(seconds=10)).isoformat()
    await svc.upsert_state(user_id, LunaStateUpdate(xp=100, client_updated_at=t0))
    updated = await svc.upsert_state(user_id, LunaStateUpdate(xp=200, client_updated_at=t1))
    assert updated.xp == 200


@pytest.mark.asyncio
async def test_upsert_lww_older_write_ignored(session) -> None:
    db, user_id = session
    svc = LunaService(db)
    t0 = datetime.now(UTC).isoformat()
    t1 = (datetime.now(UTC) + timedelta(seconds=10)).isoformat()
    await svc.upsert_state(user_id, LunaStateUpdate(xp=200, client_updated_at=t1))
    updated = await svc.upsert_state(user_id, LunaStateUpdate(xp=100, client_updated_at=t0))
    assert updated.xp == 200


@pytest.mark.asyncio
async def test_upsert_mood_trend_recomputes_client_trend(session) -> None:
    db, user_id = session
    svc = LunaService(db)
    updated = await svc.upsert_state(
        user_id,
        LunaStateUpdate(
            mood_trend={
                "samples": [
                    {"date": "2026-08-01", "mood": "neutral", "intensity": 3, "source": "manual", "created_at": "2026-08-01T10:00:00Z"},
                    {"date": "2026-08-02", "mood": "neutral", "intensity": 3, "source": "manual", "created_at": "2026-08-02T10:00:00Z"},
                    {"date": "2026-08-03", "mood": "happy", "intensity": 4, "source": "manual", "created_at": "2026-08-03T10:00:00Z"},
                ],
                "trend": "volatile",  # client-supplied — must be overwritten
                "updated_at": "2026-08-03T10:00:00Z",
            },
            client_updated_at=datetime.now(UTC).isoformat(),
        ),
    )
    trend = updated.mood_trend["trend"]
    assert trend == "improving"  # server-computed, not the client's "volatile"


@pytest.mark.asyncio
async def test_upsert_mood_samples_append_sort_trim(session) -> None:
    db, user_id = session
    svc = LunaService(db)
    base = [
        {"date": f"2026-06-{i:02d}", "mood": "neutral", "intensity": 3, "source": "manual", "created_at": f"2026-06-{i:02d}T10:00:00Z"}
        for i in range(1, 31)
    ]
    await svc.upsert_state(
        user_id,
        LunaStateUpdate(
            mood_trend={"samples": base},
            client_updated_at=datetime.now(UTC).isoformat(),
        ),
    )
    updated = await svc.upsert_state(
        user_id,
        LunaStateUpdate(
            mood_trend={"samples": [
                {"date": "2026-07-01", "mood": "happy", "intensity": 5, "source": "manual", "created_at": "2026-07-01T10:00:00Z"},
            ]},
            client_updated_at=(datetime.now(UTC) + timedelta(seconds=5)).isoformat(),
        ),
    )
    samples = updated.mood_trend["samples"]
    assert len(samples) == 30
    assert samples[-1]["date"] == "2026-07-01"  # newest retained


@pytest.mark.asyncio
async def test_upsert_backdated_log_does_not_evict_newer(session) -> None:
    db, user_id = session
    svc = LunaService(db)
    base = [
        {"date": f"2026-06-{i:02d}", "mood": "neutral", "intensity": 3, "source": "manual", "created_at": f"2026-06-{i:02d}T10:00:00Z"}
        for i in range(1, 31)
    ]
    t0 = datetime.now(UTC).isoformat()
    await svc.upsert_state(user_id, LunaStateUpdate(mood_trend={"samples": base}, client_updated_at=t0))
    # Backdated entry older than every stored sample must not evict newer ones.
    updated = await svc.upsert_state(
        user_id,
        LunaStateUpdate(
            mood_trend={"samples": [
                {"date": "2026-01-01", "mood": "sad", "intensity": 1, "source": "manual", "created_at": "2026-01-01T10:00:00Z"},
            ]},
            client_updated_at=(datetime.now(UTC) + timedelta(seconds=5)).isoformat(),
        ),
    )
    samples = updated.mood_trend["samples"]
    assert len(samples) == 30
    assert samples[-1]["date"] == "2026-06-30"  # newest kept, backdated dropped


@pytest.mark.asyncio
async def test_upsert_preferences_cap_raises_luna_validation(session) -> None:
    db, user_id = session
    svc = LunaService(db)
    # model_construct bypasses Pydantic validators so the service-layer guard
    # (belt-and-suspenders backstop) is what rejects the payload.
    update = LunaStateUpdate.model_construct(preferences={f"key_{i}": i for i in range(51)})
    with pytest.raises(LunaValidationError):
        await svc.upsert_state(user_id, update)


@pytest.mark.asyncio
async def test_upsert_habit_patterns_cap_raises_luna_validation(session) -> None:
    db, user_id = session
    svc = LunaService(db)
    update = LunaStateUpdate.model_construct(habit_patterns={f"key_{i}": i for i in range(101)})
    with pytest.raises(LunaValidationError):
        await svc.upsert_state(user_id, update)


@pytest.mark.asyncio
async def test_upsert_achievements_cap_raises_luna_validation(session) -> None:
    db, user_id = session
    svc = LunaService(db)
    update = LunaStateUpdate.model_construct(
        achievements=[{"id": f"ach_{i}", "unlocked_at": "2026-08-01T10:00:00Z"} for i in range(101)]
    )
    with pytest.raises(LunaValidationError):
        await svc.upsert_state(user_id, update)


# ---------------------------------------------------------------------------
# day_logged bridge
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_day_logged_refreshes_mood_trend(session) -> None:
    db, user_id = session
    state = await refresh_mood_trend_from_day_logged(
        db, user_id, log_date="2026-08-01", mood="happy", mood_intensity=5
    )
    samples = state.mood_trend["samples"]
    assert len(samples) == 1
    assert samples[0]["source"] == "day_logged"
    assert samples[0]["mood"] == "happy"
    assert state.mood_trend["trend"] == "stable"  # single sample → not enough data


@pytest.mark.asyncio
async def test_day_logged_is_idempotent(session) -> None:
    db, user_id = session
    await refresh_mood_trend_from_day_logged(
        db, user_id, log_date="2026-08-01", mood="happy", mood_intensity=5
    )
    state = await refresh_mood_trend_from_day_logged(
        db, user_id, log_date="2026-08-01", mood="sad", mood_intensity=2
    )
    samples = state.mood_trend["samples"]
    assert len(samples) == 1  # same (date, source) → dedupe, no double-count
    assert samples[0]["mood"] == "sad"  # latest value wins


@pytest.mark.asyncio
async def test_day_logged_unknown_mood_defaults_to_neutral(session) -> None:
    db, user_id = session
    state = await refresh_mood_trend_from_day_logged(
        db, user_id, log_date="2026-08-01", mood="tired", mood_intensity=4
    )
    assert state.mood_trend["samples"][0]["mood"] == "neutral"


@pytest.mark.asyncio
async def test_row_isolation_between_users(session) -> None:
    db, user_id = session
    svc = LunaService(db)
    await svc.upsert_state(
        user_id,
        LunaStateUpdate(xp=999, client_updated_at=datetime.now(UTC).isoformat()),
    )
    other_id = uuid.uuid4()
    other = await svc.get_state(other_id)
    assert other.xp == 0  # other user never sees user A's state
    rows = (await db.execute(select(LunaState))).scalars().all()
    assert len(rows) == 2
