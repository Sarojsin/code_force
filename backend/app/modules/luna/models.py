"""Luna companion database models.

Aggregate-only companion state (luna2phase4): XP, level, coins, relationship
level, mood/trend summaries, preferences, achievements, and habit patterns.
Never journal content, dialogue history, or raw health data (privacy boundary
per AGENTS.md §3.8). ``field_timestamps`` backs the per-field LWW merge.
"""

from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Index
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LunaState(Base):
    """One aggregate-state row per user; user_id is unique."""

    __tablename__ = "luna_state"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    xp: Mapped[int] = mapped_column(default=0, nullable=False)
    level: Mapped[int] = mapped_column(default=1, nullable=False)
    coins: Mapped[int] = mapped_column(default=0, nullable=False)
    relationship_level: Mapped[int] = mapped_column(default=1, nullable=False)
    # {"trend": "improving|declining|stable|volatile", "samples": [MoodSample...], "updated_at": iso}
    mood_trend: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
    # {"speechEnabled": bool, "speechRate": float, "muteSounds": bool, ...}
    preferences: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
    # [{"id": "sleep_streak_7", "unlocked_at": iso}, ...]
    achievements: Mapped[list[object]] = mapped_column(JSONB, default=list, nullable=False)
    # {"sleep_avg_hour": 23.1, "top_log_types": [...], ...}
    habit_patterns: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict, nullable=False)
    # per-field LWW bookkeeping: {"xp": iso, "mood_trend": iso, ...}
    field_timestamps: Mapped[dict[str, str]] = mapped_column(JSONB, default=dict, nullable=False)

    __table_args__ = (
        Index("ix_luna_state_mood_trend_gin", "mood_trend", postgresql_using="gin"),
        Index("ix_luna_state_preferences_gin", "preferences", postgresql_using="gin"),
        Index("ix_luna_state_achievements_gin", "achievements", postgresql_using="gin"),
        Index("ix_luna_state_habit_patterns_gin", "habit_patterns", postgresql_using="gin"),
        Index("ix_luna_state_field_timestamps_gin", "field_timestamps", postgresql_using="gin"),
    )
