"""luna: add aggregate state table (luna2phase4)

Revision ID: 0019
Revises: eb292784c924
Create Date: 2026-08-06

Adds ``luna_state`` — one aggregate-only row per user (XP, level, coins,
relationship level, mood trend, preferences, achievements, habit patterns)
with JSONB + GIN indexes and a per-field LWW timestamp map. Reversible.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0019"
down_revision: str | None = "eb292784c924"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "luna_state",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            unique=True,
            index=True,
            nullable=False,
        ),
        sa.Column("xp", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("level", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("coins", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "relationship_level",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("1"),
        ),
        sa.Column(
            "mood_trend",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "preferences",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "achievements",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "habit_patterns",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "field_timestamps",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("client_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
            index=True,
        ),
    )

    op.create_index("ix_luna_state_mood_trend_gin", "luna_state", ["mood_trend"], postgresql_using="gin")
    op.create_index("ix_luna_state_preferences_gin", "luna_state", ["preferences"], postgresql_using="gin")
    op.create_index("ix_luna_state_achievements_gin", "luna_state", ["achievements"], postgresql_using="gin")
    op.create_index("ix_luna_state_habit_patterns_gin", "luna_state", ["habit_patterns"], postgresql_using="gin")
    op.create_index("ix_luna_state_field_timestamps_gin", "luna_state", ["field_timestamps"], postgresql_using="gin")


def downgrade() -> None:
    op.drop_index("ix_luna_state_field_timestamps_gin", table_name="luna_state")
    op.drop_index("ix_luna_state_habit_patterns_gin", table_name="luna_state")
    op.drop_index("ix_luna_state_achievements_gin", table_name="luna_state")
    op.drop_index("ix_luna_state_preferences_gin", table_name="luna_state")
    op.drop_index("ix_luna_state_mood_trend_gin", table_name="luna_state")
    op.drop_table("luna_state")
