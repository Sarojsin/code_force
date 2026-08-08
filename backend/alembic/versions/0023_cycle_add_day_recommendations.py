"""cycle: add cycle_days.recommendations_completed JSONB column.

Stores the set of recommendation ids the user marked as done on a given day
(PR 3 of the DayDetailSheet upgrade). Empty by default; nullable=False.

Reversible: drop the column.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cycle_days",
        sa.Column(
            "recommendations_completed",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("cycle_days", "recommendations_completed")
