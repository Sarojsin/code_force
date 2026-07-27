"""Seed 100+ static health tips. Run via Alembic data migration or CLI."""

SEED_TIPS: list[tuple[str, str]] = [
    # ── Sleep ──
    ("sleep", "Consistent sleep schedule improves your cycle regularity."),
    ("sleep", "Blue light before bed disrupts melatonin production."),
    ("sleep", "7-9 hours of sleep helps regulate stress hormones."),
    ("sleep", "A cool bedroom (18-20°C) promotes deeper sleep."),
    ("sleep", "Avoid caffeine 6 hours before bedtime."),
    ("sleep", "Sleep deprivation can worsen PMS symptoms."),
    ("sleep", "Create a bedtime ritual: read, stretch, or meditate."),
    ("sleep", "Your body repairs tissues while you sleep."),
    ("sleep", "Irregular sleep patterns can affect ovulation."),
    ("sleep", "Magnesium before bed can improve sleep quality."),
    ("sleep", "Limit screen time 30 minutes before bed."),
    ("sleep", "A warm bath before bed aids sleep onset."),
    ("sleep", "Sleep debt accumulates — catch up on weekends."),
    ("sleep", "Napping after 3 PM can disrupt night sleep."),
    ("sleep", "Exercise earlier in the day for better sleep."),
    # ── Water ──
    ("water", "Water helps reduce menstrual bloating."),
    ("water", "Staying hydrated reduces fatigue during periods."),
    ("water", "Drinking water before meals aids digestion."),
    ("water", "Aim for 8 glasses (2L) of water daily."),
    ("water", "Hydration improves skin elasticity and glow."),
    ("water", "Dehydration can trigger headaches."),
    ("water", "Herbal teas count toward your daily fluid intake."),
    ("water", "Drink a glass of water when you wake up."),
    ("water", "Water helps flush toxins from your body."),
    ("water", "Keep a water bottle on your desk as a reminder."),
    ("water", "Coconut water is great for electrolyte balance."),
    ("water", "Urine color is a good hydration indicator."),
    ("water", "Hydration supports kidney function."),
    ("water", "Drink more water on days you exercise."),
    ("water", "Set hourly water reminders during your cycle."),
    # ── Food ──
    ("food", "Iron-rich foods help combat period fatigue."),
    ("food", "Calcium supports bone health during menstrual cycles."),
    ("food", "Omega-3 fatty acids can reduce period pain."),
    ("food", "Eat protein with every meal for stable energy."),
    ("food", "Fiber helps regulate digestion during your cycle."),
    ("food", "Dark leafy greens are packed with iron and folate."),
    ("food", "Vitamin C helps absorb iron from plant sources."),
    ("food", "Avoid excessive salt to reduce bloating."),
    ("food", "Complex carbs provide steady energy release."),
    ("food", "Probiotics support gut health and immunity."),
    ("food", "Magnesium-rich foods (bananas, almonds) ease cramps."),
    ("food", "Eat smaller, more frequent meals during your period."),
    ("food", "B vitamin complex helps with energy metabolism."),
    ("food", "Reduce sugar intake to stabilize mood swings."),
    ("food", "Stay balanced: protein, healthy fats, complex carbs."),
    # ── Exercise ──
    ("exercise", "Gentle walking reduces period pain."),
    ("exercise", "Yoga helps relieve menstrual cramps."),
    ("exercise", "Exercise releases endorphins — natural mood lifters."),
    ("exercise", "Strength training builds bone density."),
    ("exercise", "Stretching improves flexibility and reduces tension."),
    ("exercise", "Swimming is a low-impact full-body workout."),
    ("exercise", "Pelvic floor exercises support reproductive health."),
    ("exercise", "Listen to your body — rest when you need to."),
    ("exercise", "Aim for 150 minutes of moderate exercise weekly."),
    ("exercise", "Exercise improves sleep quality."),
    ("exercise", "Morning exercise can boost metabolism all day."),
    ("exercise", "Dancing is a fun way to stay active."),
    ("exercise", "Cycling builds cardiovascular endurance."),
    ("exercise", "Tai chi combines movement with mindfulness."),
    ("exercise", "Consistency matters more than intensity."),
    # ── Medication ──
    ("medication", "Track your medication schedule for consistency."),
    ("medication", "Set daily reminders to never miss a dose."),
    ("medication", "Consult your doctor before starting supplements."),
    ("medication", "Store medications in a cool, dry place."),
    ("medication", "Check expiration dates regularly."),
    ("medication", "Iron supplements are best taken with vitamin C."),
    ("medication", "Some medications work best with food."),
    ("medication", "Keep a list of all medications you take."),
    ("medication", "Talk to your pharmacist about side effects."),
    ("medication", "Don't double up if you miss a dose — ask your doctor."),
    ("medication", "Use a pill organizer to track daily doses."),
    ("medication", "Refill prescriptions before you run out."),
    ("medication", "Travel with medications in your carry-on."),
    ("medication", "Share your medication list with emergency contacts."),
    ("medication", "Review your medications with your doctor annually."),
    # ── General / Motivational ──
    ("general", "Small consistent steps lead to big health changes."),
    ("general", "Self-care is not selfish — it's necessary."),
    ("general", "Your health journey is unique. Progress, not perfection."),
    ("general", "Celebrate every win, no matter how small."),
    ("general", "Rest is productive. Recovery matters."),
    ("general", "You are the CEO of your own health."),
    ("general", "Listen to your body — it knows what it needs."),
    ("general", "Every healthy choice adds up over time."),
    ("general", "Be kind to yourself on difficult days."),
    ("general", "You're doing better than you think."),
]


async def seed_health_tips(db_session):
    """Insert seed tips if the table is empty."""
    from sqlalchemy import func, select

    from app.modules.wellness.models import HealthTip

    existing = await db_session.execute(select(func.count()).select_from(HealthTip))
    if existing.scalar() > 0:
        return

    for metric_type, tip_text in SEED_TIPS:
        db_session.add(HealthTip(metric_type=metric_type, tip=tip_text))
    await db_session.commit()
