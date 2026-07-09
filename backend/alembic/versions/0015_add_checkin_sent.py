"""Add checkin_sent column to predicted_cycles.

Phase 3: idempotency flag for daily check-in notification.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0015"
down_revision: str | None = "ea796595c9f5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "predicted_cycles",
        sa.Column("checkin_sent", sa.Boolean(), server_default=sa.text("false"), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("predicted_cycles", "checkin_sent")
