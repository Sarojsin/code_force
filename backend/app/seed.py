"""Seed reference data: breathing exercises, pregnancy milestones, symptom/mood dictionaries.

Run: python -m app.seed
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.modules.pregnancy.models import PregnancyMilestone
from app.modules.wellness.models import BreathingExercise

BREATHING_EXERCISES = [
    {"name": "4-7-8 Breathing", "duration_seconds": 120, "instructions": {"steps": ["Inhale through nose for 4 seconds", "Hold for 7 seconds", "Exhale through mouth for 8 seconds"], "tips": ["Keep tongue at roof of mouth"]}},
    {"name": "Box Breathing", "duration_seconds": 120, "instructions": {"steps": ["Inhale for 4 counts", "Hold for 4 counts", "Exhale for 4 counts", "Hold for 4 counts"], "tips": ["Visualize a square"]}},
    {"name": "Diaphragmatic Breathing", "duration_seconds": 180, "instructions": {"steps": ["Breathe deeply into your belly", "Exhale slowly through pursed lips"], "tips": ["Place hand on belly to feel rise and fall"]}},
    {"name": "Alternate Nostril Breathing", "duration_seconds": 180, "instructions": {"steps": ["Close right nostril, inhale left", "Close left nostril, exhale right"], "tips": ["Use thumb and ring finger"]}},
    {"name": "Progressive Relaxation", "duration_seconds": 300, "instructions": {"steps": ["Tense each muscle group for 5 seconds", "Release and relax for 10 seconds", "Move through body systematically"], "tips": ["Start at feet and work up"]}},
    {"name": "Lion's Breath", "duration_seconds": 60, "instructions": {"steps": ["Inhale deeply through nose", "Open mouth wide, stick out tongue", "Exhale forcefully with 'ha' sound"], "tips": ["Exaggerate the facial expression"]}},
]

SYMPTOM_DICTIONARY = [
    "cramps", "bloating", "headache", "fatigue", "nausea",
    "breast_tenderness", "backache", "acne", "cravings", "insomnia",
    "mood_swings", "anxiety", "diarrhea", "constipation", "dizziness",
    "hot_flashes", "spotting", "swelling", "muscle_aches", "brain_fog",
]

MOOD_DICTIONARY = [
    "happy", "sad", "anxious", "calm", "irritable",
    "energetic", "tired", "grateful", "overwhelmed", "peaceful",
    "hopeful", "frustrated", "loved", "lonely", "confident",
]


async def _seed_breathing(db: AsyncSession) -> int:
    count = 0
    for data in BREATHING_EXERCISES:
        existing = await db.execute(
            select(BreathingExercise).where(BreathingExercise.name == data["name"])
        )
        if existing.scalar_one_or_none() is None:
            db.add(BreathingExercise(**data))
            count += 1
    await db.commit()
    return count


async def _seed_milestones(db: AsyncSession) -> int:
    count = 0
    milestones = [
        # First trimester (weeks 1-13)
        {"week": 4, "baby_size_cm": 0.1, "baby_weight_g": 0.001, "development_tip": "The fertilized egg attaches to the uterine lining."},
        {"week": 5, "baby_size_cm": 0.2, "baby_weight_g": 0.01, "development_tip": "Baby's heart starts beating."},
        {"week": 6, "baby_size_cm": 0.4, "baby_weight_g": 0.02, "development_tip": "The foundation of brain and spinal cord develops."},
        {"week": 8, "baby_size_cm": 1.6, "baby_weight_g": 0.1, "development_tip": "All major organs have begun to form."},
        {"week": 12, "baby_size_cm": 5.4, "baby_weight_g": 14.0, "development_tip": "Baby is fully formed — now grows and matures."},
        {"week": 16, "baby_size_cm": 12.0, "baby_weight_g": 100.0, "development_tip": "External genitalia visible on ultrasound."},
        {"week": 20, "baby_size_cm": 16.0, "baby_weight_g": 300.0, "development_tip": "Midpoint of pregnancy — baby can hear your voice."},
        {"week": 24, "baby_size_cm": 21.0, "baby_weight_g": 600.0, "development_tip": "Baby has a chance of survival outside the womb with medical help."},
        {"week": 27, "baby_size_cm": 24.0, "baby_weight_g": 875.0, "development_tip": "Baby's senses are developing rapidly."},
        {"week": 32, "baby_size_cm": 29.0, "baby_weight_g": 1700.0, "development_tip": "Baby's lungs practice breathing movements."},
        {"week": 36, "baby_size_cm": 34.0, "baby_weight_g": 2600.0, "development_tip": "Baby may move into head-down position."},
        {"week": 40, "baby_size_cm": 37.0, "baby_weight_g": 3400.0, "development_tip": "Baby is ready to be born."},
    ]
    for entry in milestones:
        existing = await db.execute(
            select(PregnancyMilestone).where(PregnancyMilestone.week == entry["week"])
        )
        if existing.scalar_one_or_none() is None:
            db.add(PregnancyMilestone(**entry))
            count += 1
    await db.commit()
    return count


async def seed_all() -> dict[str, int]:
    async with AsyncSessionLocal() as db:
        exercises = await _seed_breathing(db)
        milestones = await _seed_milestones(db)
        return {"breathing_exercises": exercises, "pregnancy_milestones": milestones}


def main() -> None:
    result = asyncio.run(seed_all())
    print(f"Seeded: {result}")


if __name__ == "__main__":
    main()
