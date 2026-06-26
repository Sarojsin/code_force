"""Add correction columns to cycle_entries and predicted_cycles.

Phase 1: cycle_entries.corrected_prediction_id, cycle_entries.is_correction;
predicted_cycles.actual_cycle_entry_id, predicted_cycles.prediction_error_days.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # cycle_entries
    op.add_column(
        "cycle_entries",
        sa.Column("corrected_prediction_id", sa.UUID(as_uuid=True), sa.ForeignKey("predicted_cycles.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "cycle_entries",
        sa.Column("is_correction", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_cycle_entries_corrected_prediction_id", "cycle_entries", ["corrected_prediction_id"])

    # predicted_cycles
    op.add_column(
        "predicted_cycles",
        sa.Column("actual_cycle_entry_id", sa.UUID(as_uuid=True), sa.ForeignKey("cycle_entries.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "predicted_cycles",
        sa.Column("prediction_error_days", sa.SmallInteger(), nullable=True),
    )
    op.create_index("ix_predicted_cycles_actual_cycle_entry_id", "predicted_cycles", ["actual_cycle_entry_id"])


def downgrade() -> None:
    op.drop_column("predicted_cycles", "prediction_error_days")
    op.drop_column("predicted_cycles", "actual_cycle_entry_id")
    op.drop_column("cycle_entries", "is_correction")
    op.drop_column("cycle_entries", "corrected_prediction_id")
