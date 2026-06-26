"""Add ML metrics columns to users table.

Phase 1: avg_cycle_length, cycle_length_std_dev, avg_prediction_error_days,
total_cycles_logged, is_dirty_for_retraining.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avg_cycle_length", sa.Float(), nullable=True))
    op.add_column("users", sa.Column("cycle_length_std_dev", sa.Float(), nullable=True))
    op.add_column(
        "users",
        sa.Column("avg_prediction_error_days", sa.Float(), nullable=False, server_default=sa.text("0.0")),
    )
    op.add_column(
        "users",
        sa.Column("total_cycles_logged", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "users",
        sa.Column("is_dirty_for_retraining", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("users", "is_dirty_for_retraining")
    op.drop_column("users", "total_cycles_logged")
    op.drop_column("users", "avg_prediction_error_days")
    op.drop_column("users", "cycle_length_std_dev")
    op.drop_column("users", "avg_cycle_length")
