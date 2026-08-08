"""diary: create diaries, diary_pages, diary_page_objects, diary_media tables

Revision ID: 0020
Revises: 0019
Create Date: 2026-08-07

Adds the diary module tables (plan 08 / journal upgrade). Reversible.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0020"
down_revision: str | None = "0019"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # ─── diaries ────────────────────────────────────────────────────────
    op.create_table(
        "diaries",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            index=True,
            nullable=False,
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("cover_color", sa.String(length=20), nullable=False, server_default=sa.text("'primary'")),
        sa.Column("texture_id", sa.String(length=50), nullable=True),
        sa.Column("font_id", sa.String(length=50), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("lock_type", sa.String(length=20), nullable=True),
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
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
            index=True,
        ),
    )

    # ─── diary_pages ────────────────────────────────────────────────────
    op.create_table(
        "diary_pages",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "diary_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("diaries.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        ),
        sa.Column("page_number", sa.Integer(), nullable=False),
        sa.Column("page_date", sa.Date(), nullable=False, index=True),
        sa.Column("memory_title", sa.String(length=200), nullable=True),
        sa.Column(
            "memory_tags",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column(
            "memory_people",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("memory_location", sa.String(length=200), nullable=True),
        sa.Column("memory_weather", sa.String(length=50), nullable=True),
        sa.Column("memory_mood", sa.String(length=50), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("is_favorite", sa.Boolean(), nullable=False, server_default=sa.false()),
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
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
            index=True,
        ),
        sa.UniqueConstraint("diary_id", "page_number", name=op.f("uq_diary_pages_diary_id")),
    )

    # ─── diary_media ────────────────────────────────────────────────────
    op.create_table(
        "diary_media",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            index=True,
            nullable=False,
        ),
        sa.Column("media_type", sa.String(length=10), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(length=50), nullable=False),
        sa.Column("s3_key", sa.String(length=500), nullable=True),
        sa.Column("thumbnail_s3_key", sa.String(length=500), nullable=True),
        sa.Column("upload_status", sa.String(length=20), nullable=False, server_default=sa.text("'local'")),
        sa.Column("duration_sec", sa.Integer(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("local_file_path", sa.String(length=500), nullable=True),
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
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
            index=True,
        ),
    )

    # ─── diary_page_objects ─────────────────────────────────────────────
    op.create_table(
        "diary_page_objects",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "page_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("diary_pages.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        ),
        sa.Column(
            "object_type",
            sa.Enum(
                "TEXT",
                "IMAGE",
                "VIDEO",
                "VOICE",
                "MOOD",
                "STICKER",
                name="canvasobjecttype",
            ),
            nullable=False,
        ),
        sa.Column("text_content", sa.Text(), nullable=True),
        sa.Column("font_family", sa.String(length=50), nullable=True),
        sa.Column("font_size", sa.Integer(), nullable=True),
        sa.Column("color", sa.String(length=20), nullable=True),
        sa.Column("text_alignment", sa.String(length=10), nullable=True),
        sa.Column(
            "media_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("diary_media.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("caption", sa.String(length=500), nullable=True),
        sa.Column("thumbnail_s3_key", sa.String(length=500), nullable=True),
        sa.Column("video_duration_sec", sa.Integer(), nullable=True),
        sa.Column("sticker_id", sa.String(length=50), nullable=True),
        sa.Column(
            "metadata",
            postgresql.JSONB(),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("position_x", sa.Float(), nullable=False),
        sa.Column("position_y", sa.Float(), nullable=False),
        sa.Column("width", sa.Float(), nullable=True),
        sa.Column("height", sa.Float(), nullable=True),
        sa.Column("rotation", sa.Float(), nullable=True, server_default=sa.text("0")),
        sa.Column("z_index", sa.Integer(), nullable=False, server_default=sa.text("0")),
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
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
            index=True,
        ),
    )


def downgrade() -> None:
    op.drop_table("diary_page_objects")
    op.drop_table("diary_media")
    op.drop_table("diary_pages")
    op.drop_table("diaries")
    op.execute("DROP TYPE IF EXISTS canvasobjecttype")