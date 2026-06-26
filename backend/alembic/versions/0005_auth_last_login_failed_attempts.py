"""Add last_login_at, failed_login_attempts to users; ip_address to user_sessions.

Phase 0 changes:
  - ADD last_login_at       (DateTime(tz), nullable) — records last successful login
  - ADD failed_login_attempts (Integer, default 0) — incremented per failed attempt
  - ADD ip_address          (String(45), nullable) — on user_sessions for audit
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Users
    op.add_column(
        "users",
        sa.Column(
            "last_login_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "users",
        sa.Column(
            "failed_login_attempts",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    # User sessions
    op.add_column(
        "user_sessions",
        sa.Column(
            "ip_address",
            sa.String(45),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("user_sessions", "ip_address")
    op.drop_column("users", "failed_login_attempts")
    op.drop_column("users", "last_login_at")
