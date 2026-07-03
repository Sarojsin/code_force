"""wellness: add title/mood to journal_entries, notes to mood_logs

Revision ID: ea796595c9f5
Revises: 52433d5717b1
Create Date: 2026-07-02 16:23:08.905198+00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'ea796595c9f5'
down_revision: Union[str, None] = '52433d5717b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('journal_entries', sa.Column('title', sa.String(length=200), nullable=True))
    op.add_column('journal_entries', sa.Column('mood', sa.String(length=50), nullable=True))
    op.add_column('mood_logs', sa.Column('notes', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('journal_entries', 'title')
    op.drop_column('journal_entries', 'mood')
    op.drop_column('mood_logs', 'notes')
