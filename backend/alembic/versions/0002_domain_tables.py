"""Domain tables: cycle, wellness, pregnancy, safety, family, nurse, chat.

Revision ID: 0002_domain_tables
Revises: 0001_auth_initial
Create Date: 2026-06-19 10:00:00

Tables created:
  - cycle_entries, predicted_cycles
  - journal_entries, mood_logs, breathing_exercises, user_exercise_sessions
  - pregnancy_profiles, pregnancy_daily_logs, pregnancy_milestones
  - sos_alerts, sos_notification_attempts
  - family_links
  - nurse_profiles, educational_contents
  - chat_invites

Per backend rule §4.1 / §17.1: one migration per logical change.
This is a single bulk migration since none of these tables exist yet.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002_domain_tables"
down_revision: str | None = "0001_auth_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- cycle_entries (plan 07) ---
    op.create_table(
        "cycle_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_start_date", sa.Date(), nullable=False, index=True),
        sa.Column("period_end_date", sa.Date(), nullable=True),
        sa.Column("flow_intensity", sa.String(length=10), nullable=True),
        sa.Column("symptoms", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("mood_tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("energy_level", sa.SmallInteger(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    # Indexes are handled via index=True on column defs in create_table.

    # --- predicted_cycles (plan 07) ---
    op.create_table(
        "predicted_cycles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("predicted_next_period_start", sa.Date(), nullable=False, index=True),
        sa.Column("predicted_fertile_window_start", sa.Date(), nullable=True),
        sa.Column("predicted_fertile_window_end", sa.Date(), nullable=True),
        sa.Column("model_version", sa.String(length=20), nullable=False, server_default="rule_based_v2"),
    )
    # --- journal_entries (plan 08) ---
    op.create_table(
        "journal_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sentiment_score", sa.Float(), nullable=True),
        sa.Column("sentiment_label", sa.String(length=20), nullable=True),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("entry_date", sa.Date(), nullable=False, index=True),
    )
    # --- mood_logs (plan 08) ---
    op.create_table(
        "mood_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mood", sa.String(length=50), nullable=False, index=True),
        sa.Column("intensity", sa.SmallInteger(), nullable=False, server_default="3"),
        sa.Column("logged_at", sa.DateTime(timezone=True), nullable=False, index=True),
    )
    # --- breathing_exercises (plan 08 - static content) ---
    op.create_table(
        "breathing_exercises",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("instructions", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("audio_url", sa.String(length=500), nullable=True),
    )

    # --- user_exercise_sessions (plan 08) ---
    op.create_table(
        "user_exercise_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("exercise_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("breathing_exercises.id", ondelete="CASCADE"), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
    )
    # --- pregnancy_profiles (plan 10) ---
    op.create_table(
        "pregnancy_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False, index=True),
        sa.Column("lmp_date", sa.Date(), nullable=False),
        sa.Column("current_week", sa.SmallInteger(), nullable=False),
    )
    # --- pregnancy_daily_logs (plan 10) ---
    op.create_table(
        "pregnancy_daily_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("pregnancy_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pregnancy_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("symptoms", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("cravings", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("mood", sa.String(length=50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("log_date", sa.Date(), nullable=False, index=True),
    )
    # --- pregnancy_milestones (plan 10 - static table) ---
    op.create_table(
        "pregnancy_milestones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("week", sa.SmallInteger(), nullable=False, index=True),
        sa.Column("baby_size_cm", sa.Float(), nullable=True),
        sa.Column("baby_weight_g", sa.Float(), nullable=True),
        sa.Column("development_tip", sa.Text(), nullable=False),
    )
    # --- sos_alerts (plan 11) ---
    op.create_table(
        "sos_alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("latitude", sa.Numeric(precision=10, scale=8), nullable=False),
        sa.Column("longitude", sa.Numeric(precision=11, scale=8), nullable=False),
        sa.Column("location_accuracy_m", sa.Integer(), nullable=True),
        sa.Column("contact_ids_notified", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=False, server_default=sa.text("'{}'::uuid[]")),
        sa.Column("sms_status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("push_status", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("manual_intervention_needed", sa.Boolean(), nullable=False, server_default=sa.false(), index=True),
        sa.Column("escalation_flag", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # --- sos_notification_attempts (plan 11) ---
    op.create_table(
        "sos_notification_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("sos_alert_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sos_alerts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("contact_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("emergency_contacts.id"), nullable=False),
        sa.Column("channel", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending", index=True),
        sa.Column("retry_count", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("attempted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("succeeded_at", sa.DateTime(timezone=True), nullable=True),
    )
    # --- family_links (plan 12) ---
    op.create_table(
        "family_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("linked_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("permission_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("invite_token", sa.String(length=64), unique=True, nullable=False, index=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending", index=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
    )
    # --- nurse_profiles (plan 13) ---
    op.create_table(
        "nurse_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("qualification", sa.Text(), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("hospital_affiliation", sa.String(length=200), nullable=True),
    )

    # --- educational_contents (plan 13) ---
    op.create_table(
        "educational_contents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("nurse_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("video_url", sa.Text(), nullable=True),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=50), nullable=False, index=True),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=False, server_default=sa.text("'{}'::varchar[]")),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending", index=True),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    # --- chat_invites (plan 14) ---
    op.create_table(
        "chat_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("room_id", sa.String(length=255), nullable=False, index=True),
        sa.Column("inviter_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invite_token", sa.String(length=255), unique=True, nullable=False, index=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("max_uses", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("use_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    # Drop tables in reverse dependency order
    op.drop_table("chat_invites")
    op.drop_table("educational_contents")
    op.drop_table("nurse_profiles")
    op.drop_table("family_links")
    op.drop_table("sos_notification_attempts")
    op.drop_table("sos_alerts")
    op.drop_table("pregnancy_milestones")
    op.drop_table("pregnancy_daily_logs")
    op.drop_table("pregnancy_profiles")
    op.drop_table("user_exercise_sessions")
    op.drop_table("breathing_exercises")
    op.drop_table("mood_logs")
    op.drop_table("journal_entries")
    op.drop_table("predicted_cycles")
    op.drop_table("cycle_entries")
