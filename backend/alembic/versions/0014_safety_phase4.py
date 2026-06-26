"""Phase 4 Safety: add contact_user_id, idempotency_key, trigger_source, resolved_at, and SMS rate-limit fields.

Adds:
  - EmergencyContact.contact_user_id (FK → users.id)
  - SOSAlert.idempotency_key (unique, for dedup within 24h)
  - SOSAlert.trigger_source (enum: button|shake|hardware_triple_press)
  - SOSAlert.resolved_at (timestamp for resolve flow)
  - SOSAlert.false_alarm (boolean for cancel/resolve)
  - SOSNotificationAttempt.push_token (for push-vs-SMS tracking)
  - SMS rate limit 5/hour enforced in services (no schema change needed)
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # EmergencyContact.contact_user_id
    op.add_column(
        "emergency_contacts",
        sa.Column("contact_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.add_column(
        "emergency_contacts",
        sa.Column("contact_user_id_linked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_emergency_contacts_contact_user_id", "emergency_contacts", ["contact_user_id"])

    # SOSAlert new fields
    op.add_column(
        "sos_alerts",
        sa.Column("idempotency_key", sa.String(64), nullable=True),
    )
    op.create_index("ix_sos_alerts_idempotency_key", "sos_alerts", ["idempotency_key"], unique=True)
    op.execute("CREATE TYPE sos_trigger_source AS ENUM ('button', 'shake', 'hardware_triple_press')")
    op.add_column(
        "sos_alerts",
        sa.Column(
            "trigger_source",
            postgresql.ENUM("button", "shake", "hardware_triple_press", name="sos_trigger_source", create_type=False),
            nullable=True,
        ),
    )
    op.add_column(
        "sos_alerts",
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "sos_alerts",
        sa.Column("false_alarm", sa.Boolean, nullable=False, server_default=sa.text("false")),
    )

    # SOSNotificationAttempt.push_token
    op.add_column(
        "sos_notification_attempts",
        sa.Column("push_token", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("sos_notification_attempts", "push_token")
    op.drop_column("sos_alerts", "false_alarm")
    op.drop_column("sos_alerts", "resolved_at")

    op.drop_index("ix_sos_alerts_idempotency_key", table_name="sos_alerts")
    op.drop_column("sos_alerts", "idempotency_key")
    op.drop_column("sos_alerts", "trigger_source")
    op.execute("DROP TYPE IF EXISTS sos_trigger_source")
    op.drop_index("ix_emergency_contacts_contact_user_id", table_name="emergency_contacts")
    op.drop_column("emergency_contacts", "contact_user_id_linked_at")
    op.drop_column("emergency_contacts", "contact_user_id")
