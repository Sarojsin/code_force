"""cycle: add cycle_reports table for AI-generated (or rule-based) analytics.

Cycle_Report-as-a-Service_(RaaS) plan: stores one validated report per
closed cycle (unique cycle_entry_id). Soft-delete via is_active (AGENTS §1.4).

Revision ID: 0026
Revises: 0025
Create Date: 2026-08-15
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

from alembic import op

revision: str = "0026"
down_revision: str | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cycle_reports",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "user_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "cycle_entry_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("cycle_entries.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("report_data", JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("client_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("cycle_entry_id", name="unique_cycle_report_entry"),
    )
    op.create_index("ix_cycle_reports_user_id", "cycle_reports", ["user_id"])
    op.create_index("ix_cycle_reports_is_active", "cycle_reports", ["is_active"])


def downgrade() -> None:
    op.drop_index("ix_cycle_reports_is_active", table_name="cycle_reports")
    op.drop_index("ix_cycle_reports_user_id", table_name="cycle_reports")
    op.drop_table("cycle_reports")