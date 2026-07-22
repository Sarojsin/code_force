"""Add cycle_type column to cycle_entries.

Postpartum / medical anovulatory state marker for prediction suspension.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cycle_entries",
        sa.Column("cycle_type", sa.String(20), nullable=False, server_default="menstrual"),
    )


def downgrade() -> None:
    op.drop_column("cycle_entries", "cycle_type")
