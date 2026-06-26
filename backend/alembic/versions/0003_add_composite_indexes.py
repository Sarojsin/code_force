"""Add composite indexes for common query patterns (plan 23).

- cycle_entries (user_id, period_start_date) for user's cycle history
- wellness_journal_entries (user_id, entry_date) for journal timeline
- safety_sos_alerts (user_id, triggered_at) for SOS history
- pregnancy_daily_logs (pregnancy_id, log_date) for daily log timeline
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002_domain_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_cycle_entries_user_period", "cycle_entries", ["user_id", "period_start_date"])
    op.create_index("ix_journal_entries_user_date", "journal_entries", ["user_id", "entry_date"])
    op.create_index("ix_sos_alerts_user_triggered", "sos_alerts", ["user_id", "triggered_at"])
    op.create_index("ix_preg_daily_logs_preg_date", "pregnancy_daily_logs", ["pregnancy_id", "log_date"])
    op.create_index("ix_mood_logs_user_logged", "mood_logs", ["user_id", "logged_at"])
    op.create_index("ix_emergency_contacts_user_primary", "emergency_contacts", ["user_id", "is_primary"])


def downgrade() -> None:
    op.drop_index("ix_cycle_entries_user_period")
    op.drop_index("ix_journal_entries_user_date")
    op.drop_index("ix_sos_alerts_user_triggered")
    op.drop_index("ix_preg_daily_logs_preg_date")
    op.drop_index("ix_mood_logs_user_logged")
    op.drop_index("ix_emergency_contacts_user_primary")
