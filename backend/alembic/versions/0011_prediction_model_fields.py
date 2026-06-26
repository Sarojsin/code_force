"""Add model_type, confidence_score, training_data_points, prediction_window_days to predicted_cycles.

Phase 2: prediction metadata for the fallback chain and global model alignment.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("predicted_cycles", sa.Column("model_type", sa.String(20), nullable=True))
    op.add_column("predicted_cycles", sa.Column("confidence_score", sa.Float, nullable=True))
    op.add_column("predicted_cycles", sa.Column("training_data_points", sa.SmallInteger, nullable=True))
    op.add_column("predicted_cycles", sa.Column("prediction_window_days", sa.SmallInteger, nullable=True))


def downgrade() -> None:
    op.drop_column("predicted_cycles", "prediction_window_days")
    op.drop_column("predicted_cycles", "training_data_points")
    op.drop_column("predicted_cycles", "confidence_score")
    op.drop_column("predicted_cycles", "model_type")
