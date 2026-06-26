"""Add email, user_secret_key, provider, is_verified to users table.

Migration for jwt_authplan.md:
  - ADD email             (nullable, unique partial index)
  - ADD user_secret_key   (non-nullable, back-filled via gen_random_bytes)
  - ADD provider          (non-nullable, default 'local')
  - ADD is_verified       (non-nullable, default False)
  - ALTER phone_number    (nullable=True — was nullable=False)
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Enable pgcrypto extension for gen_random_bytes (safe to run multiple times)
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # 2. Add new columns (nullable / with defaults so existing rows are valid)
    op.add_column("users", sa.Column("email", sa.String(255), nullable=True))
    op.add_column(
        "users",
        sa.Column("user_secret_key", sa.String(64), nullable=False, server_default=""),
    )
    op.add_column(
        "users",
        sa.Column("provider", sa.String(20), nullable=False, server_default="local"),
    )
    op.add_column(
        "users",
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    # 3. Back-fill user_secret_key for rows that still have the default empty string
    op.execute(
        "UPDATE users SET user_secret_key = encode(gen_random_bytes(32), 'hex') "
        "WHERE user_secret_key = ''"
    )

    # 4. Back-fill provider for any rows that may have been missed
    op.execute("UPDATE users SET provider = 'local' WHERE provider IS NULL OR provider = ''")

    # 5. Make phone_number nullable (email becomes the primary identifier going forward)
    op.alter_column("users", "phone_number", existing_type=sa.String(20), nullable=True)

    # 6. Partial unique index on email (only non-null values)
    op.create_index(
        "ix_users_email",
        "users",
        ["email"],
        unique=True,
        postgresql_where=sa.text("email IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users", postgresql_where=sa.text("email IS NOT NULL"))
    op.alter_column("users", "phone_number", existing_type=sa.String(20), nullable=False)
    op.drop_column("users", "is_verified")
    op.drop_column("users", "provider")
    op.drop_column("users", "user_secret_key")
    op.drop_column("users", "email")
