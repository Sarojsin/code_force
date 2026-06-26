"""Create system_config table for global model version tracking.

Stores key-value pairs: global_model_version, global_model_path,
global_model_rmse, global_model_mae, etc. Value is a JSON blob
(VARCHAR(500)) for future extensibility.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "system_config",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("value", sa.Text, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("system_config")
