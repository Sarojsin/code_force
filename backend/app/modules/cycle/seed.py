"""Seed reference data for day observations: symptoms + medications masters.

The mobile app ships matching bundled JSON (``src/assets/masters/*.json``), so
the exact ``name`` values here are the wire contract — keep both in sync in the
same PR (see DayDetailShee_plan.md §13.2).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.cycle.models import Medication, Symptom

# (name, category, icon, display_order) — display_order is per-category (1..N).
# MUST match alembic 0021 NEW_SEED and the mobile symptoms.json bundle exactly (§14.2).
SYMPTOM_SEED: list[tuple[str, str, str, int]] = [
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
    ("Hair Thinning / Loss", "skin", "🪮", 4),
    ("Excess Facial / Body Hair", "skin", "🌿", 5),
    ("Dry / Itchy Skin", "skin", "🧴", 6),
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
    ("Night Sweats", "general", "🌙", 11),
    ("Heart Palpitations", "general", "💓", 12),
    ("Feeling Unwell / Weakness", "general", "🥺", 13),
    ("Frequent Urination / UTIs", "general", "🚽", 14),
    ("Vision Changes", "general", "👁️", 15),
    # Mental & Emotional
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
    # Menstrual & Hormonal
    ("Heavy / Prolonged Bleeding", "reproductive", "🩸", 1),
    ("Irregular Cycles", "reproductive", "🔄", 2),
    ("Bleeding / Spotting Between Periods", "reproductive", "🩹", 3),
    ("Absent Period / Amenorrhea", "reproductive", "⭕", 4),
    ("Painful Ovulation", "reproductive", "📌", 5),
    ("PMS Symptoms", "reproductive", "🌩️", 6),
    ("PMDD (Severe PMS)", "reproductive", "⛈️", 7),
    ("Painful Urination", "reproductive", "🔥", 8),
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
