"""nurse_content: drop rich article fields, default status -> draft

Phase 1.6 content status state machine. Removes the rich article columns
added in 0022 (summary, body, reading_time_minutes, author_name, content_type,
video_public_id, video_duration_seconds, thumbnail_public_id, images) and
changes the status server_default from 'approved' to 'draft'.

Revision ID: 0023_nurse_content_simplify
Revises: 0022_nurse_content_add_media_fields
Create Date: 2026-08-11
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0025"
down_revision: str | None = "0024"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Drop rich article columns that are no longer part of the simplified model.
    op.drop_column("educational_contents", "summary")
    op.drop_column("educational_contents", "body")
    op.drop_column("educational_contents", "reading_time_minutes")
    op.drop_column("educational_contents", "author_name")
    op.drop_column("educational_contents", "content_type")
    op.drop_column("educational_contents", "video_public_id")
    op.drop_column("educational_contents", "video_duration_seconds")
    op.drop_column("educational_contents", "thumbnail_public_id")
    op.drop_column("educational_contents", "images")

    # Change default status from 'approved' to 'draft' for the state machine.
    op.alter_column(
        "educational_contents",
        "status",
        server_default="draft",
        existing_type=sa.String(length=20),
    )


def downgrade() -> None:
    # Restore default status to 'approved'.
    op.alter_column(
        "educational_contents",
        "status",
        server_default="approved",
        existing_type=sa.String(length=20),
    )

    # Re-add rich article columns.
    op.add_column("educational_contents", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column("educational_contents", sa.Column("body", sa.Text(), nullable=True))
    op.add_column("educational_contents", sa.Column("reading_time_minutes", sa.Integer(), nullable=True))
    op.add_column("educational_contents", sa.Column("author_name", sa.String(length=100), nullable=True))
    op.add_column("educational_contents", sa.Column("content_type", sa.String(length=10), nullable=False, server_default="article"))
    op.add_column("educational_contents", sa.Column("video_public_id", sa.Text(), nullable=True))
    op.add_column("educational_contents", sa.Column("video_duration_seconds", sa.Integer(), nullable=True))
    op.add_column("educational_contents", sa.Column("thumbnail_public_id", sa.Text(), nullable=True))
    op.add_column("educational_contents", sa.Column("images", sa.dialects.postgresql.JSONB(), nullable=True))
