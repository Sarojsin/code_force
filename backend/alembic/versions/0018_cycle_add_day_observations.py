"""cycle: add day observations (cycle_days) + symptom/medication masters.

Creates:
- cycle_days           per-user-per-day observation record (DayDetailSheet)
- symptoms             symptom master (clients never hardcode names)
- day_symptoms         M2M day -> symptom with severity 1-5
- medications          medication master
- day_medications      M2M day -> medication with dose + taken_at

Reversible: tables carry no destructive data (fresh feature).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: str | None = "93a7172745d5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "cycle_days",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("log_date", sa.Date(), nullable=False),
        sa.Column("mood", sa.String(length=50), nullable=True),
        sa.Column("mood_intensity", sa.SmallInteger(), nullable=True),
        sa.Column("pain_level", sa.SmallInteger(), nullable=True),
        sa.Column("energy_level", sa.SmallInteger(), nullable=True),
        sa.Column("sleep_minutes", sa.Integer(), nullable=True),
        sa.Column("water_glasses", sa.SmallInteger(), nullable=True),
        sa.Column("flow_level", sa.String(length=10), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("client_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.CheckConstraint(
            "pain_level IS NULL OR (pain_level >= 0 AND pain_level <= 10)",
            name="ck_cycle_days_pain_range",
        ),
        sa.CheckConstraint(
            "energy_level IS NULL OR (energy_level >= 1 AND energy_level <= 3)",
            name="ck_cycle_days_energy_range",
        ),
        sa.CheckConstraint(
            "sleep_minutes IS NULL OR (sleep_minutes >= 0 AND sleep_minutes <= 1440)",
            name="ck_cycle_days_sleep_range",
        ),
        sa.CheckConstraint(
            "water_glasses IS NULL OR (water_glasses >= 0 AND water_glasses <= 32)",
            name="ck_cycle_days_water_range",
        ),
        sa.CheckConstraint(
            "flow_level IS NULL OR flow_level IN ('none', 'spotting', 'light', 'medium', 'heavy')",
            name="ck_cycle_days_flow_level",
        ),
        sa.UniqueConstraint("user_id", "log_date", name="unique_user_day_log_date"),
    )
    op.create_index(op.f("ix_cycle_days_user_id"), "cycle_days", ["user_id"], unique=False)
    op.create_index(op.f("ix_cycle_days_log_date"), "cycle_days", ["log_date"], unique=False)
    op.create_index(op.f("ix_cycle_days_is_active"), "cycle_days", ["is_active"], unique=False)

    op.create_table(
        "symptoms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("icon", sa.String(length=10), nullable=True),
        sa.Column("display_order", sa.SmallInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("client_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.UniqueConstraint("name", name="uq_symptoms_name"),
    )
    op.create_index(op.f("ix_symptoms_is_active"), "symptoms", ["is_active"], unique=False)

    op.create_table(
        "day_symptoms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "day_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cycle_days.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "symptom_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("symptoms.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("severity", sa.SmallInteger(), server_default=sa.text("3"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("client_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.CheckConstraint("severity >= 1 AND severity <= 5", name="ck_day_symptoms_severity"),
        sa.UniqueConstraint("day_id", "symptom_id", name="unique_day_symptom"),
    )
    op.create_index(op.f("ix_day_symptoms_day_id"), "day_symptoms", ["day_id"], unique=False)
    op.create_index(
        op.f("ix_day_symptoms_symptom_id"), "day_symptoms", ["symptom_id"], unique=False
    )
    op.create_index(op.f("ix_day_symptoms_is_active"), "day_symptoms", ["is_active"], unique=False)

    op.create_table(
        "medications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("category", sa.String(length=30), nullable=False),
        sa.Column("display_order", sa.SmallInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("client_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.UniqueConstraint("name", name="uq_medications_name"),
    )
    op.create_index(op.f("ix_medications_is_active"), "medications", ["is_active"], unique=False)

    op.create_table(
        "day_medications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "day_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cycle_days.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "medication_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("medications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("dose", sa.String(length=40), nullable=True),
        sa.Column("taken_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("client_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.UniqueConstraint("day_id", "medication_id", name="unique_day_medication"),
    )
    op.create_index(op.f("ix_day_medications_day_id"), "day_medications", ["day_id"], unique=False)
    op.create_index(
        op.f("ix_day_medications_medication_id"), "day_medications", ["medication_id"], unique=False
    )
    op.create_index(
        op.f("ix_day_medications_is_active"), "day_medications", ["is_active"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_day_medications_is_active"), table_name="day_medications")
    op.drop_index(op.f("ix_day_medications_medication_id"), table_name="day_medications")
    op.drop_index(op.f("ix_day_medications_day_id"), table_name="day_medications")
    op.drop_table("day_medications")
    op.drop_index(op.f("ix_medications_is_active"), table_name="medications")
    op.drop_table("medications")
    op.drop_index(op.f("ix_day_symptoms_is_active"), table_name="day_symptoms")
    op.drop_index(op.f("ix_day_symptoms_symptom_id"), table_name="day_symptoms")
    op.drop_index(op.f("ix_day_symptoms_day_id"), table_name="day_symptoms")
    op.drop_table("day_symptoms")
    op.drop_index(op.f("ix_symptoms_is_active"), table_name="symptoms")
    op.drop_table("symptoms")
    op.drop_index(op.f("ix_cycle_days_is_active"), table_name="cycle_days")
    op.drop_index(op.f("ix_cycle_days_log_date"), table_name="cycle_days")
    op.drop_index(op.f("ix_cycle_days_user_id"), table_name="cycle_days")
    op.drop_table("cycle_days")
