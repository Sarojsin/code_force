"""Add client_updated_at to user_onboarding and predicted_cycles

Revision ID: 52433d5717b1
Revises: 7ccfe1b50f12
Create Date: 2026-07-01 15:58:45.459746+00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '52433d5717b1'
down_revision: Union[str, None] = '7ccfe1b50f12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = [
    'audit_logs',
    'breathing_exercises',
    'chat_invites',
    'educational_contents',
    'family_links',
    'journal_analyses',
    'nurse_profiles',
    'otp_attempts',
    'predicted_cycles',
    'pregnancy_milestones',
    'pregnancy_profiles',
    'snooze_events',
    'sos_alerts',
    'sos_notification_attempts',
    'system_config',
    'user_consents',
    'user_exercise_sessions',
    'user_onboarding',
]


def upgrade() -> None:
    for table in TABLES:
        op.add_column(table, sa.Column('client_updated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_column(table, 'client_updated_at')
