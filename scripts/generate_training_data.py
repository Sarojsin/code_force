"""Generate synthetic journal entries with wellness labels for training.

Produces a JSONL file with mood_score (1-10), sentiment, symptom_mentions,
crisis_flags, and journal text synced from on-device ML pipeline labels.

Usage:
    python scripts/generate_training_data.py --count 10000 --output data/training_data.jsonl
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys

PROMPT_TEMPLATE = """Generate a realistic women's health journal entry. The entry should reflect the following parameters:
- mood_score: {mood_score}/10
- sentiment: {sentiment}
- symptom_mentions: {symptom_mentions}
- crisis_flags: {crisis_flags}

Write in first person, 1-3 sentences, as if written by someone tracking their wellness.
Respond with only the journal text, no labels."""


SYMPTOM_POOL = [
    "cramps", "bloating", "headache", "fatigue", "nausea",
    "backache", "breast_tenderness", "acne", "mood_swings",
    "insomnia", "cravings", "dizziness", "hot_flashes",
    "spotting", "constipation", "diarrhea", "anxiety",
    "irritability", "low_libido", "pelvic_pain",
]

TEMPLATES_NEGATIVE = [
    "Really struggling today. The {symptoms} are unbearable and I can't focus on anything.",
    "Woke up feeling terrible. {symptoms} again. Nothing seems to help.",
    "This is the worst day of my cycle. {symptoms}. I just want to sleep through it.",
    "Can't take this anymore. The {symptoms} are too much to handle.",
    "Feeling really down today. {symptoms} and my mood is just awful.",
    "Another rough day. {symptoms}. When will this end?",
    "I hate this. {symptoms} and I can't do anything right.",
    "Exhausted and in pain. {symptoms}. Need this phase to be over.",
    "Everything hurts. {symptoms}. Cried three times today for no reason.",
    "My body feels like it's betraying me. {symptoms} again.",
]

TEMPLATES_NEUTRAL = [
    "Had a regular day. {symptoms} are present but manageable.",
    "Not great, not terrible. {symptoms} as expected for this time of the month.",
    "Usual symptoms today: {symptoms}. Nothing out of the ordinary.",
    "Day {day} of my cycle. {symptoms}. Just tracking as usual.",
    "Pretty standard day. {symptoms} but I've had worse.",
    "Just another day. {symptoms} are there in the background.",
    "Okayish day. {symptoms} but I managed to get through my to-do list.",
    "Nothing special to report. {symptoms} as expected.",
    "Average day with {symptoms}. Kept myself busy so it wasn't too bad.",
    "Getting through it. {symptoms} but I'm handling it okay.",
]

TEMPLATES_POSITIVE = [
    "Amazing day today! {symptoms} are finally easing up and I feel like myself again.",
    "Feeling so much better! The {symptoms} have subsided and I have so much energy.",
    "Best day in weeks! No {symptoms} to speak of and my mood is soaring.",
    "Finally feeling good again. Minimal {symptoms} and lots of positive energy.",
    "Great day! Managed to exercise despite mild {symptoms} and I'm proud of myself.",
    "Really productive day. {symptoms} are barely noticeable and I feel optimistic.",
    "Wonderful day! {symptoms} are gone and I feel so much lighter and happier.",
    "Having a fantastic day. {symptoms} are completely gone and I'm so grateful.",
    "Energy is back! No more {symptoms} and I feel like I can conquer the world.",
    "Best I've felt all month. No {symptoms} and I'm in such a good headspace.",
]

CRISIS_LINES = [
    "I feel like hurting myself tonight.",
    "I don't want to be here anymore.",
    "He hit me again and I don't know what to do.",
    "I feel so unsafe in my own home.",
    "I'm having thoughts of ending it all.",
    "The abuse is getting worse and I'm scared.",
    "I need help but I don't know who to call.",
    "I'm bleeding and I think I need to go to the hospital.",
    "Please someone help me, I'm in danger.",
    "I can't take this abuse anymore, I want it to stop.",
]


def _pick_symptoms(min_count: int = 1, max_count: int = 4) -> list[str]:
    count = random.randint(min_count, max_count)
    return random.sample(SYMPTOM_POOL, min(count, len(SYMPTOM_POOL)))


def _generate_entry(mood_score: int) -> dict:
    if mood_score <= 3:
        sentiment = "negative"
        template_pool = TEMPLATES_NEGATIVE
    elif mood_score <= 6:
        sentiment = "neutral"
        template_pool = TEMPLATES_NEUTRAL
    else:
        sentiment = "positive"
        template_pool = TEMPLATES_POSITIVE

    symptoms = _pick_symptoms(1, 3) if random.random() < 0.7 else []
    template = random.choice(template_pool)
    text = template.format(symptoms=", ".join(symptoms) if symptoms else "nothing specific", day=random.randint(5, 28))

    crisis_flags = {"self_harm_mention": False, "abuse_mention": False, "emergency_keyword": False}

    if random.random() < 0.02:
        crisis_line = random.choice(CRISIS_LINES)
        text = crisis_line + " " + text
        if any(kw in crisis_line.lower() for kw in ["hurt myself", "self harm", "suicide", "die", "end it", "cutting"]):
            crisis_flags["self_harm_mention"] = True
        if any(kw in crisis_line.lower() for kw in ["abuse", "hit", "violence", "assaulted", "unsafe", "forced"]):
            crisis_flags["abuse_mention"] = True
        if any(kw in crisis_line.lower() for kw in ["emergency", "hospital", "ambulance", "bleeding", "help"]):
            crisis_flags["emergency_keyword"] = True

    return {
        "text": text,
        "mood_score": mood_score,
        "sentiment": sentiment,
        "symptom_mentions": symptoms,
        "crisis_flags": crisis_flags,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic journal training data")
    parser.add_argument("--count", type=int, default=10000, help="Number of entries to generate")
    parser.add_argument("--output", type=str, default="data/training_data.jsonl", help="Output JSONL path")
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)

    with open(args.output, "w", encoding="utf-8") as f:
        for i in range(args.count):
            mood_score = random.choices(
                population=range(1, 11),
                weights=[5, 5, 10, 10, 15, 15, 15, 10, 10, 5],
                k=1,
            )[0]
            entry = _generate_entry(mood_score)
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

            if (i + 1) % 1000 == 0:
                print(f"Generated {i + 1}/{args.count} entries", file=sys.stderr)

    print(f"Done. {args.count} entries written to {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
