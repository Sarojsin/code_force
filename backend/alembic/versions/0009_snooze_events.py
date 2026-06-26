"""Create snooze_events table.

Phase 1: tracks user "Not yet" taps on predictions for lateness tracking.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "snooze_events",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("user_id", sa.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("predicted_cycle_id", sa.UUID(as_uuid=True), sa.ForeignKey("predicted_cycles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("snoozed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("day_offset", sa.SmallInteger(), nullable=False),
    )
    op.create_index("ix_snooze_events_user_id", "snooze_events", ["user_id"])
    op.create_index("ix_snooze_events_predicted_cycle_id", "snooze_events", ["predicted_cycle_id"])


def downgrade() -> None:
    op.drop_table("snooze_events")
