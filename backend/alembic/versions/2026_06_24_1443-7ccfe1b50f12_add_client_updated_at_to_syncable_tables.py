"""Add client_updated_at to syncable tables

Revision ID: 7ccfe1b50f12
Revises: 911664c419c9
Create Date: 2026-06-24 14:43:00.000000+00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = '7ccfe1b50f12'
down_revision: str | None = '911664c419c9'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = [
    'journal_entries',
    'mood_logs',
    'cycle_entries',
    'pregnancy_daily_logs',
    'emergency_contacts',
]


def upgrade() -> None:
    for table in TABLES:
        op.add_column(table, sa.Column('client_updated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    for table in TABLES:
        op.drop_column(table, 'client_updated_at')
