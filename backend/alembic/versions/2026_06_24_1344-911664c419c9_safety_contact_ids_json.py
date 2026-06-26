"""safety: change contact_ids_notified from ARRAY(UUID) to JSON

Revision ID: 911664c419c9
Revises: 0014
Create Date: 2026-06-24 13:44:37.574694+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = '911664c419c9'
down_revision: str | None = '0014'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE sos_alerts ALTER COLUMN contact_ids_notified DROP DEFAULT")
    op.alter_column(
        'sos_alerts', 'contact_ids_notified',
        existing_type=postgresql.ARRAY(sa.UUID()),
        type_=sa.JSON(),
        postgresql_using='array_to_json(contact_ids_notified)',
        existing_nullable=False,
    )
    op.execute("ALTER TABLE sos_alerts ALTER COLUMN contact_ids_notified SET DEFAULT '[]'::json")


def downgrade() -> None:
    op.execute("ALTER TABLE sos_alerts ALTER COLUMN contact_ids_notified DROP DEFAULT")
    op.alter_column(
        'sos_alerts', 'contact_ids_notified',
        existing_type=sa.JSON(),
        type_=postgresql.ARRAY(sa.UUID()),
        postgresql_using='ARRAY(SELECT jsonb_array_elements_text(contact_ids_notified::jsonb)::uuid)',
        existing_nullable=False,
    )
    op.execute("ALTER TABLE sos_alerts ALTER COLUMN contact_ids_notified SET DEFAULT '{}'::uuid[]")
