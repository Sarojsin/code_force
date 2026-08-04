"""Seed reference data for day observations: symptoms + medications masters.

The mobile app ships matching bundled JSON (``src/assets/masters/*.json``), so
the exact ``name`` values here are the wire contract — keep both in sync in the
same PR (see DayDetailShee_plan.md §13.2).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.cycle.models import Medication, Symptom

# (name, category, icon, display_order)
SYMPTOM_SEED: list[tuple[str, str, str, int]] = [
    # Pain
    ("Cramps", "pain", "🔥", 1),
    ("Headache", "pain", "🤕", 2),
    ("Backache", "pain", "🦴", 3),
    ("Muscle aches", "pain", "💪", 4),
    # Body
    ("Bloating", "body", "🎈", 1),
    ("Nausea", "body", "🤢", 2),
    ("Breast tenderness", "body", "💗", 3),
    ("Acne", "body", "🔴", 4),
    ("Swelling", "body", "🧊", 5),
    ("Hot flashes", "body", "🌡️", 6),
    ("Dizziness", "body", "🌀", 7),
    ("Diarrhea", "body", "💩", 8),
    ("Constipation", "body", "🚫", 9),
    # Mood
    ("Mood swings", "mood", "🎭", 1),
    ("Anxiety", "mood", "😟", 2),
    ("Cravings", "mood", "🍫", 3),
    ("Brain fog", "mood", "☁️", 4),
    # Energy
    ("Fatigue", "energy", "😴", 1),
    ("Insomnia", "energy", "🌙", 2),
    # Reproductive
    ("Spotting", "reproductive", "🩸", 1),
]

# (name, category, display_order)
MEDICATION_SEED: list[tuple[str, str, int]] = [
    ("Ibuprofen", "painkiller", 1),
    ("Paracetamol", "painkiller", 2),
    ("Naproxen", "painkiller", 3),
    ("Birth Control Pill", "hormone", 4),
    ("Iron Supplement", "supplement", 5),
    ("Magnesium", "supplement", 6),
    ("Vitamin D", "supplement", 7),
]


async def seed_day_masters(db: AsyncSession) -> dict[str, int]:
    """Insert seed symptoms + medications if missing (idempotent by name)."""
    added_symptoms = 0
    for name, category, icon, order in SYMPTOM_SEED:
        existing = await db.execute(select(Symptom).where(Symptom.name == name))
        if existing.scalar_one_or_none() is None:
            db.add(Symptom(name=name, category=category, icon=icon, display_order=order))
            added_symptoms += 1

    added_medications = 0
    for name, category, order in MEDICATION_SEED:
        existing = await db.execute(select(Medication).where(Medication.name == name))
        if existing.scalar_one_or_none() is None:
            db.add(Medication(name=name, category=category, display_order=order))
            added_medications += 1

    await db.commit()
    return {"symptoms": added_symptoms, "medications": added_medications}
