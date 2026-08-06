"""Luna state service: aggregate-only LWW upsert + server-computed mood trend.

Row-level permission is enforced by callers passing ``user_id`` from the
authenticated request only (AGENTS.md §1.12). No HTTP types leak in here.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from statistics import pstdev

from pydantic import ValidationError as PydanticValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.luna.exceptions import LunaValidationError
from app.modules.luna.models import LunaState
from app.modules.luna.schemas import (
    MAX_ACHIEVEMENTS,
    MAX_HABIT_KEYS,
    MAX_MOOD_SAMPLES,
    MAX_PREFERENCES_KEYS,
    MAX_TOP_LOG_TYPES,
    LunaStateUpdate,
    MoodSample,
)

MOOD_SENTIMENT: dict[str, float] = {
    "happy": 2.0,
    "neutral": 0.0,
    "anxious": -1.0,
    "sad": -1.0,
    "angry": -2.0,
}

MOOD_TREND_LOOKBACK = 7
MOOD_TREND_MIN_SAMPLES = 3
TREND_VOLATILE_STD = 1.2
TREND_SLOPE_THRESHOLD = 0.15

SCALAR_FIELDS = ("xp", "level", "coins", "relationship_level")
JSON_FIELDS = ("preferences", "achievements", "habit_patterns")

_EMPTY_TIMESTAMP = datetime.min.replace(tzinfo=UTC)


def _normalize_dt(value: datetime | None) -> datetime:
    """Coerce a client timestamp to a tz-aware UTC datetime (defaults to now)."""
    if value is None:
        return datetime.now(UTC)
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _parse_stored_ts(raw: object) -> datetime:
    """Parse a stored ISO timestamp; unparseable/missing values count as oldest."""
    if not isinstance(raw, str) or not raw:
        return _EMPTY_TIMESTAMP
    try:
        dt = datetime.fromisoformat(raw)
    except (ValueError, TypeError):
        return _EMPTY_TIMESTAMP
    return _normalize_dt(dt)


def compute_mood_trend(samples: list[MoodSample]) -> str:
    """Server-computed trend from typed samples (last ``MOOD_TREND_LOOKBACK``).

    A strong trend wins over volatility (an improving run must not be tagged
    ``volatile``); flat-but-mixed sentiment is ``volatile``; otherwise the
    sentiment slope decides ``improving`` / ``declining`` / ``stable``.
    """
    recent = samples[-MOOD_TREND_LOOKBACK:]
    if len(recent) < MOOD_TREND_MIN_SAMPLES:
        return "stable"
    scores = [MOOD_SENTIMENT[s.mood] for s in recent]
    n = len(scores)
    xs = list(range(n))
    mean_x = sum(xs) / n
    mean_y = sum(scores) / n
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, scores, strict=True))
    den = sum((x - mean_x) ** 2 for x in xs)
    slope = num / den if den else 0.0
    if slope >= TREND_SLOPE_THRESHOLD:
        return "improving"
    if slope <= -TREND_SLOPE_THRESHOLD:
        return "declining"
    if n >= 2 and pstdev(scores) >= TREND_VOLATILE_STD:
        return "volatile"
    return "stable"


def merge_mood_samples(
    existing: list[dict[str, object]], incoming: list[MoodSample]
) -> list[MoodSample]:
    """Append → dedupe → sort → trim (keeps the 30 most recent by ``date``).

    Dedupe key is (``date``, ``source``) with incoming winning, so re-bridging
    the same day is idempotent and backdated logs never evict a newer sample
    (the trim happens after sorting, not by pre-dropping oldest).
    """
    samples: dict[tuple[str, str], MoodSample] = {}
    for raw in existing or []:
        try:
            sample = MoodSample.model_validate(raw)
        except PydanticValidationError:
            continue  # tolerate legacy malformed entries
        samples[(sample.date, sample.source)] = sample
    for sample in incoming:
        samples[(sample.date, sample.source)] = sample
    merged = sorted(samples.values(), key=lambda s: (s.date, s.created_at))
    return merged[-MAX_MOOD_SAMPLES:]


def _stored_mood_samples(state: LunaState) -> list[dict[str, object]]:
    """Read stored samples defensively (legacy/malformed rows degrade to [])."""
    raw = (state.mood_trend or {}).get("samples")
    return raw if isinstance(raw, list) else []


async def _get_or_create_state(db: AsyncSession, user_id: uuid.UUID) -> LunaState:
    stmt = select(LunaState).where(LunaState.user_id == user_id)
    state = (await db.execute(stmt)).scalars().first()
    if state is not None:
        return state
    state = LunaState(user_id=user_id)
    db.add(state)
    await db.flush()
    return state


class LunaService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_state(self, user_id: uuid.UUID) -> LunaState:
        """Fetch aggregate state, creating a default row on first access."""
        state = await _get_or_create_state(self.db, user_id)
        await self.db.commit()
        await self.db.refresh(state)
        return state

    async def upsert_state(self, user_id: uuid.UUID, update: LunaStateUpdate) -> LunaState:
        """Per-field LWW merge; fields absent from the update stay untouched."""
        state = await _get_or_create_state(self.db, user_id)

        # Service-layer size guards (schema constraints already cover the input;
        # these fail loudly with a luna-specific 422 code).
        if update.preferences is not None and len(update.preferences) > MAX_PREFERENCES_KEYS:
            raise LunaValidationError(
                f"preferences exceeds {MAX_PREFERENCES_KEYS} keys"
            )
        if update.habit_patterns is not None:
            if len(update.habit_patterns) > MAX_HABIT_KEYS:
                raise LunaValidationError(f"habit_patterns exceeds {MAX_HABIT_KEYS} keys")
            top_log_types = update.habit_patterns.get("top_log_types")
            if isinstance(top_log_types, list) and len(top_log_types) > MAX_TOP_LOG_TYPES:
                raise LunaValidationError(
                    f"habit_patterns.top_log_types exceeds {MAX_TOP_LOG_TYPES} entries"
                )
        if update.achievements is not None and len(update.achievements) > MAX_ACHIEVEMENTS:
            raise LunaValidationError(f"achievements exceeds {MAX_ACHIEVEMENTS} entries")

        ts = _normalize_dt(update.client_updated_at)
        field_ts: dict[str, str] = dict(state.field_timestamps or {})

        def write(field: str, value: object) -> None:
            if ts < _parse_stored_ts(field_ts.get(field)):
                return  # an older write never clobbers a newer one
            field_ts[field] = ts.isoformat()
            setattr(state, field, value)

        for field in SCALAR_FIELDS:
            value = getattr(update, field)
            if value is not None:
                write(field, value)

        if update.mood_trend is not None:
            existing_samples = _stored_mood_samples(state)
            if ts < _parse_stored_ts(field_ts.get("mood_trend")):
                # Stale mood aggregate — leave the stored value untouched.
                pass
            else:
                merged = merge_mood_samples(existing_samples, update.mood_trend.samples)
                field_ts["mood_trend"] = ts.isoformat()
                state.mood_trend = {
                    "trend": compute_mood_trend(merged),
                    "samples": [s.model_dump(mode="json") for s in merged],
                    "updated_at": ts.isoformat(),
                }

        for field in JSON_FIELDS:
            value = getattr(update, field)
            if value is not None:
                dumped = value
                if field == "achievements":
                    dumped = [a.model_dump(mode="json") for a in value]
                write(field, dumped)

        state.field_timestamps = field_ts
        await self.db.commit()
        await self.db.refresh(state)
        return state


async def refresh_mood_trend_from_day_logged(
    db: AsyncSession,
    user_id: uuid.UUID,
    log_date: str,
    mood: str,
    mood_intensity: int | None,
    created_at: datetime | None = None,
) -> LunaState:
    """Idempotent ``day_logged`` bridge: append one typed sample, recompute trend.

    Dedupe by (``date``, ``source="day_logged"``) means replaying the same event
    (or re-saving the same day) never double-counts.
    """
    state = await _get_or_create_state(db, user_id)
    now = _normalize_dt(created_at)
    mood_value = mood if mood in MOOD_SENTIMENT else "neutral"
    intensity = max(1, min(5, mood_intensity or 5))
    sample = MoodSample(
        date=log_date,
        mood=mood_value,
        intensity=intensity,
        source="day_logged",
        created_at=now,
    )
    existing = _stored_mood_samples(state)
    merged = merge_mood_samples(existing, [sample])
    state.mood_trend = {
        "trend": compute_mood_trend(merged),
        "samples": [s.model_dump(mode="json") for s in merged],
        "updated_at": now.isoformat(),
    }
    await db.commit()
    await db.refresh(state)
    return state
