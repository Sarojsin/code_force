"""Add idempotency_key column to cycle_entries.

Project invariant §5 — idempotency for sync and SOS mutations.
Already present on SOSAlert (0014), adding to CycleEntry now.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cycle_entries",
        sa.Column("idempotency_key", sa.String(64), nullable=True),
    )
    op.create_index("ix_cycle_entries_idempotency_key", "cycle_entries", ["idempotency_key"])


def downgrade() -> None:
    op.drop_index("ix_cycle_entries_idempotency_key", table_name="cycle_entries")
    op.drop_column("cycle_entries", "idempotency_key")
