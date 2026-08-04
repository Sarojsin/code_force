"""Add correction_delta to cycle_entries.

Stores the prediction error (actual - predicted) on the cycle entry
for easier frontend access and future ML model training.
Positive = user started late, Negative = user started early.

NOTE: Column was manually applied to the database before this migration
was stitched into the chain. This migration is now a no-op (IF NOT EXISTS).
"""

from alembic import op
import sqlalchemy as sa

revision = "0012_correction_delta"
down_revision = "d4e5f6a7b8c9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE cycle_entries ADD COLUMN IF NOT EXISTS correction_delta SMALLINT"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE cycle_entries DROP COLUMN IF EXISTS correction_delta"
    )
