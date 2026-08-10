"""cycle: expand symptom master to the full 6-category clinical taxonomy.

Extends the 4-category master (pain/digestive/skin/general — 30 rows) with
`mood` and `reproductive` categories plus additional physical rows
(skin +3, general +5) — 27 new rows → 57 total (Full_Symptom-Driven engine PR 1).

Strategy (idempotent, pure additions):
- Existing rows are untouched (name, category, icon, display_order preserved).
- New rows are inserted only if their name is not already present.

Downgrade is a no-op — these are pure additions; keeping them is harmless
(see Full_..._plan1.md §4, Implementation Note 5).
"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.dialects.postgresql import insert as pg_insert

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0024"
down_revision: str | None = "0023"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# (name, category, icon, display_order) — display_order is per-category (1..N).
# NOTE: must match SYMPTOM_SEED in seed.py and the mobile symptoms.json bundle exactly.
NEW_SEED: list[tuple[str, str, str, int]] = [
    # Skin & Appearance (existing 3 + 3 new)
    ("Hair Thinning / Loss", "skin", "🪮", 4),
    ("Excess Facial / Body Hair", "skin", "🌿", 5),
    ("Dry / Itchy Skin", "skin", "🧴", 6),
    # General Physical (existing 10 + 5 new)
    ("Night Sweats", "general", "🌙", 11),
    ("Heart Palpitations", "general", "💓", 12),
    ("Feeling Unwell / Weakness", "general", "🥺", 13),
    ("Frequent Urination / UTIs", "general", "🚽", 14),
    ("Vision Changes", "general", "👁️", 15),
    # Mental & Emotional (NEW category)
    ("Mood Swings", "mood", "🎢", 1),
    ("Irritability", "mood", "😤", 2),
    ("Anxiety / Nervousness", "mood", "😰", 3),
    ("Depressed Mood / Sadness", "mood", "😔", 4),
    ("Tearfulness / Crying Spells", "mood", "😢", 5),
    ("Brain Fog", "mood", "🌫️", 6),
    ("Difficulty Concentrating", "mood", "🎯", 7),
    ("Feeling Overwhelmed", "mood", "🌊", 8),
    ("Social Withdrawal", "mood", "🐢", 9),
    ("Reduced Libido", "mood", "🦋", 10),
    ("Severe Depression / Self-Harm", "mood", "🆘", 11),
    # Menstrual & Hormonal (NEW category)
    ("Heavy / Prolonged Bleeding", "reproductive", "🩸", 1),
    ("Irregular Cycles", "reproductive", "🔄", 2),
    ("Bleeding / Spotting Between Periods", "reproductive", "🩹", 3),
    ("Absent Period / Amenorrhea", "reproductive", "⭕", 4),
    ("Painful Ovulation", "reproductive", "📌", 5),
    ("PMS Symptoms", "reproductive", "🌩️", 6),
    ("PMDD (Severe PMS)", "reproductive", "⛈️", 7),
    ("Painful Urination", "reproductive", "🔥", 8),
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
    # downgrade is no-op — these are pure additions; keeping them is harmless.
    pass
