"""Create user_onboarding table.

Phase 1: stores health profile, cycle baseline, symptoms, past cycles,
and the onboarding_completed flag used by the mobile RootNavigator.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_onboarding",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("age", sa.SmallInteger(), nullable=True),
        sa.Column("height_cm", sa.Float(), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("stress_level", sa.String(10), nullable=True),
        sa.Column("exercise_frequency", sa.String(10), nullable=True),
        sa.Column("sleep_hours", sa.Float(), nullable=True),
        sa.Column("diet", sa.String(10), nullable=True),
        sa.Column("current_cycle_start", sa.Date(), nullable=True),
        sa.Column("current_cycle_length", sa.SmallInteger(), nullable=True),
        sa.Column("current_period_length", sa.SmallInteger(), nullable=True),
        sa.Column("current_symptoms", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("past_cycles", postgresql.JSONB(), server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("onboarding_completed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_user_onboarding_user_id", "user_onboarding", ["user_id"])


def downgrade() -> None:
    op.drop_table("user_onboarding")
