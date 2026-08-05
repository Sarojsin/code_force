"""create wellness health_tips table

Revision ID: eb292784c924
Revises: 0012_correction_delta
Create Date: 2026-08-05 05:07:37.379479+00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'eb292784c924'
down_revision: Union[str, None] = '0012_correction_delta'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'health_tips',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('metric_type', sa.String(length=20), nullable=False),
        sa.Column('tip', sa.Text(), nullable=False),
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('client_updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_health_tips')),
    )
    op.create_index(op.f('ix_health_tips_metric_type'), 'health_tips', ['metric_type'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_health_tips_metric_type'), table_name='health_tips')
    op.drop_table('health_tips')