"""cycle: resync symptom master to 4-category physical taxonomy.

Replaces the ad-hoc 5-category seed (pain/body/mood/energy/reproductive — 21 rows)
with the 4-category clinical taxonomy (pain/digestive/skin/general — 30 rows) from
the DayDetailSheet upgrade plan.

Strategy (idempotent, no data loss):
- 1:1 semantic matches are RENAMED in place (UUID preserved → day_symptoms FKs intact).
- Rows with no replacement are soft-deactivated (is_active = False), never deleted.
- New rows are inserted; category + display_order aligned per category.

Reversible: downgrade restores the previous names/categories/orders and re-activates
deactivated rows.
"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.dialects.postgresql import insert as pg_insert

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# (name, category, icon, display_order) — display_order is per-category (1..N).
# NOTE: must match SYMPTOM_SEED in seed.py and the mobile symptoms.json bundle exactly.
NEW_SEED: list[tuple[str, str, str, int]] = [
    # Pain & Discomfort
    ("Abdominal Cramps", "pain", "🔥", 1),
    ("Upper Stomach Pain", "pain", "🫁", 2),
    ("Lower Back Pain", "pain", "🦴", 3),
    ("Leg / Thigh Pain", "pain", "🦵", 4),
    ("Joint Pain", "pain", "🔗", 5),
    ("Muscle Aches", "pain", "💪", 6),
    ("Headache", "pain", "🤕", 7),
    ("Migraine", "pain", "😖", 8),
    ("Breast Tenderness", "pain", "💗", 9),
    ("Painful Sex", "pain", "🚫", 10),
    # Digestive & Bloating
    ("Bloating", "digestive", "🎈", 1),
    ("Constipation", "digestive", "🚧", 2),
    ("Diarrhea", "digestive", "💩", 3),
    ("Nausea", "digestive", "🤢", 4),
    ("Vomiting", "digestive", "🤮", 5),
    ("Increased Appetite", "digestive", "🍽️", 6),
    ("Food Cravings", "digestive", "🍫", 7),
    # Skin & Appearance
    ("Acne / Pimples", "skin", "🔴", 1),
    ("Oily Skin", "skin", "✨", 2),
    ("Greasy Hair", "skin", "💇", 3),
    # General Physical
    ("Fatigue", "general", "😴", 1),
    ("Low Energy", "general", "🪫", 2),
    ("Increased Discharge", "general", "💧", 3),
    ("Fluid Retention", "general", "🧊", 4),
    ("Weight Gain", "general", "⚖️", 5),
    ("Hot Flashes", "general", "🌡️", 6),
    ("Chills", "general", "🥶", 7),
    ("Dizziness", "general", "🌀", 8),
    ("Trouble Sleeping", "general", "🌙", 9),
    ("Sleeping Too Much", "general", "😪", 10),
]

# 1:1 semantic renames: (old exact seed name -> new canonical name).
RENAMES: dict[str, str] = {
    "Cramps": "Abdominal Cramps",
    "Backache": "Lower Back Pain",
    "Muscle aches": "Muscle Aches",
    "Breast tenderness": "Breast Tenderness",
    "Acne": "Acne / Pimples",
    "Hot flashes": "Hot Flashes",
    "Insomnia": "Trouble Sleeping",
    "Cravings": "Food Cravings",
    "Swelling": "Fluid Retention",
}

# No replacement -> soft-deactivate (spotting is covered by cycle_days.flow_level).
REMOVE: list[str] = [
    "Mood swings",
    "Anxiety",
    "Brain fog",
    "Spotting",
]

_symptom_table = sa.table(
    "symptoms",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("name", sa.String),
    sa.column("category", sa.String),
    sa.column("icon", sa.String),
    sa.column("display_order", sa.SmallInteger),
    sa.column("is_active", sa.Boolean),
)


def upgrade() -> None:
    conn = op.get_bind()

    # 1) Apply 1:1 renames (UUID + day_symptoms references preserved).
    for old, new in RENAMES.items():
        conn.execute(
            sa.update(_symptom_table)
            .where(_symptom_table.c.name == old)
            .values(name=new, is_active=True)
        )

    # 2) Soft-deactivate rows with no replacement.
    for name in REMOVE:
        conn.execute(
            sa.update(_symptom_table)
            .where(_symptom_table.c.name == name)
            .values(is_active=False)
        )

    # 3) Upsert the new taxonomy (insert-or-update by name).
    for name, category, icon, order in NEW_SEED:
        conn.execute(
            pg_insert(_symptom_table)
            .values(
                id=uuid.uuid4(),
                name=name,
                category=category,
                icon=icon,
                display_order=order,
                is_active=True,
            )
            .on_conflict_do_update(
                constraint="uq_symptoms_name",
                set_={
                    "category": category,
                    "icon": icon,
                    "display_order": order,
                    "is_active": True,
                },
            )
        )


def downgrade() -> None:
    """Reverse: restore old names/categories/orders and re-activate removed rows."""
    conn = op.get_bind()

    # Reverse renames.
    for new, old in RENAMES.items():
        conn.execute(
            sa.update(_symptom_table)
            .where(_symptom_table.c.name == new)
            .values(name=old, is_active=True)
        )

    # Re-activate rows that were removed.
    for name in REMOVE:
        conn.execute(
            sa.update(_symptom_table)
            .where(_symptom_table.c.name == name)
            .values(is_active=True)
        )

    # Old taxonomy (exact pre-0021 seed) — category + display_order.
    OLD_SEED: list[tuple[str, str, str, int]] = [
        ("Cramps", "pain", "🔥", 1),
        ("Headache", "pain", "🤕", 2),
        ("Backache", "pain", "🦴", 3),
        ("Muscle aches", "pain", "💪", 4),
        ("Bloating", "body", "🎈", 1),
        ("Nausea", "body", "🤢", 2),
        ("Breast tenderness", "body", "💗", 3),
        ("Acne", "body", "🔴", 4),
        ("Swelling", "body", "🧊", 5),
        ("Hot flashes", "body", "🌡️", 6),
        ("Dizziness", "body", "🌀", 7),
        ("Diarrhea", "body", "💩", 8),
        ("Constipation", "body", "🚫", 9),
        ("Mood swings", "mood", "🎭", 1),
        ("Anxiety", "mood", "😟", 2),
        ("Cravings", "mood", "🍫", 3),
        ("Brain fog", "mood", "☁️", 4),
        ("Fatigue", "energy", "😴", 1),
        ("Insomnia", "energy", "🌙", 2),
        ("Spotting", "reproductive", "🩸", 1),
    ]
    for name, category, icon, order in OLD_SEED:
        conn.execute(
            sa.update(_symptom_table)
            .where(_symptom_table.c.name == name)
            .values(category=category, icon=icon, display_order=order)
        )
