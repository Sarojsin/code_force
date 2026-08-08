"""nurse_content: add rich media + article fields to educational_contents.

Revision ID: 0022
Revises: 0021
Create Date: 2026-08-08

Backwards-compatible additive migration:
- Adds article fields (summary, body, reading_time_minutes, author_name)
- Adds content_type (article | video | image) — default "article"
- Adds Cloudinary media fields (video_public_id, video_duration_seconds,
  thumbnail_public_id, image gallery JSONB)
- Changes default status from "pending" to "approved" (single-admin model)
  Existing rows in "pending" are NOT retroactively changed.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0022"
down_revision: str | None = "0021"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "educational_contents",
        sa.Column("summary", sa.Text(), nullable=True),
    )
    op.add_column(
        "educational_contents",
        sa.Column("body", sa.Text(), nullable=True),
    )
    op.add_column(
        "educational_contents",
        sa.Column("reading_time_minutes", sa.Integer(), nullable=True),
    )
    op.add_column(
        "educational_contents",
        sa.Column("author_name", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "educational_contents",
        sa.Column(
            "content_type",
            sa.String(length=10),
            nullable=False,
            server_default="article",
        ),
    )
    op.add_column(
        "educational_contents",
        sa.Column("video_public_id", sa.Text(), nullable=True),
    )
    op.add_column(
        "educational_contents",
        sa.Column("video_duration_seconds", sa.Integer(), nullable=True),
    )
    op.add_column(
        "educational_contents",
        sa.Column("thumbnail_public_id", sa.Text(), nullable=True),
    )
    op.add_column(
        "educational_contents",
        sa.Column(
            "images",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    op.create_index(
        op.f("ix_educational_contents_content_type"),
        "educational_contents",
        ["content_type"],
        unique=False,
    )
    # Single-admin model: new content is auto-approved. Change the column default
    # (existing "pending" rows are untouched).
    op.alter_column(
        "educational_contents",
        "status",
        existing_type=sa.String(length=20),
        server_default="approved",
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "educational_contents",
        "status",
        existing_type=sa.String(length=20),
        server_default="pending",
        existing_nullable=False,
    )
    op.drop_index(
        op.f("ix_educational_contents_content_type"),
        table_name="educational_contents",
    )
    op.drop_column("educational_contents", "images")
    op.drop_column("educational_contents", "thumbnail_public_id")
    op.drop_column("educational_contents", "video_duration_seconds")
    op.drop_column("educational_contents", "video_public_id")
    op.drop_column("educational_contents", "content_type")
    op.drop_column("educational_contents", "author_name")
    op.drop_column("educational_contents", "reading_time_minutes")
    op.drop_column("educational_contents", "body")
    op.drop_column("educational_contents", "summary")