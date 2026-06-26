"""Add UNIQUE constraint on cycle_entries(user_id, period_start_date).

Phase 1 gap: pre-existing database-level defence against duplicate entries
(a bug in POST /cycle/entries could insert dups, corrupting ML training set).
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(
        "unique_user_period_start",
        "cycle_entries",
        ["user_id", "period_start_date"],
    )


def downgrade() -> None:
    op.drop_constraint("unique_user_period_start", "cycle_entries", type_="unique")
