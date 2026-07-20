"""Seed two test users with cycle data within the past 6-month window."""
from __future__ import annotations

import sys
from datetime import date, timedelta

import httpx

API_BASE = "http://localhost:8000/api/v1"
PASSWORD = "Test@1234"
TODAY = date.today()
CUTOFF = TODAY - timedelta(days=180)  # service uses ~180 days

# ── Priya: 28-day regular cycles ──
# All 6 entries must fall within the 180-day window.
# Last entry ~3 weeks ago, each 28 days apart.
P_LAST = TODAY - timedelta(days=21)
P_DATES = [P_LAST - timedelta(days=28 * (5 - i)) for i in range(6)]
# Ensure first entry is after cutoff
if P_DATES[0] < CUTOFF:
    shift = CUTOFF - P_DATES[0] + timedelta(days=1)
    P_DATES = [d + shift for d in P_DATES]

PRIYA = {"email": "priya.sharma@test.shecare", "password": PASSWORD, "display_name": "Priya Sharma"}

PRIYA_ONBOARDING = {
    "age": 25, "height_cm": 162.0, "weight_kg": 58.0,
    "stress_level": "moderate", "exercise_frequency": "moderate",
    "sleep_hours": 7.5, "diet": "balanced",
    "current_cycle_start": P_DATES[5].isoformat(),
    "current_cycle_length": 28, "current_period_length": 5,
    "current_symptoms": ["cramps"],
    "past_cycles": [
        {"cycle_start": d.isoformat(), "cycle_length": 28, "period_length": 5,
         "symptoms": s}
        for d, s in zip(P_DATES[2:5], [
            ["bloating", "fatigue"],
            ["headache", "cramps"],
            ["bloating", "breast_tenderness"],
        ])
    ],
}

PRIYA_CYCLES = [
    {"period_start_date": d.isoformat(), "period_end_date": (d + timedelta(days=5)).isoformat(),
     "symptoms": s, "mood_tags": m}
    for d, s, m in zip(P_DATES, [
        ["cramps", "bloating"], ["cramps", "backache"], ["bloating", "fatigue"],
        ["headache", "cramps"], ["bloating", "breast_tenderness"], ["cramps"],
    ], [
        ["irritable", "tired"], ["anxious"], ["calm"],
        ["irritable"], ["tired"], ["happy"],
    ])
]

# ── Ananya: irregular cycles (33-43 day gaps) ──
# Scale gaps to fit within window while keeping irregular pattern
ORIG_GAPS = [37, 36, 43, 33, 43]
TOTAL_SPAN = sum(ORIG_GAPS)  # 192 days
# Scale to fit within ~160 days so all entries fit past cutoff with margin
SCALE = 160 / TOTAL_SPAN
GAPS = [max(round(g * SCALE), 24) for g in ORIG_GAPS]  # min 24 days

A_LAST = TODAY - timedelta(days=14)
A_DATES = [A_LAST]
for g in reversed(GAPS):
    A_DATES.insert(0, A_DATES[0] - timedelta(days=g))
# Ensure first entry is after cutoff
if A_DATES[0] < CUTOFF:
    shift = CUTOFF - A_DATES[0] + timedelta(days=1)
    A_DATES = [d + shift for d in A_DATES]

ANANYA = {"email": "ananya.verma@test.shecare", "password": PASSWORD, "display_name": "Ananya Verma"}

ANANYA_ONBOARDING = {
    "age": 32, "height_cm": 158.0, "weight_kg": 72.0,
    "stress_level": "high", "exercise_frequency": "low",
    "sleep_hours": 5.5, "diet": "normal",
    "current_cycle_start": A_DATES[5].isoformat(),
    "current_cycle_length": GAPS[-1], "current_period_length": 6,
    "current_symptoms": ["severe_cramps", "nausea", "backache", "fatigue", "bloating"],
    "past_cycles": [
        {"cycle_start": d.isoformat(), "cycle_length": gl, "period_length": pl,
         "symptoms": s}
        for d, gl, pl, s in zip(A_DATES[2:5], GAPS[1:4], [7, 6, 6], [
            ["severe_cramps", "nausea", "bloating", "migraine", "spotting"],
            ["cramps", "backache", "fatigue", "dizziness", "cravings"],
            ["bloating", "headache", "cramps", "breast_tenderness"],
        ])
    ],
}

ANANYA_SYMPTOMS = [
    ["severe_cramps", "headache", "nausea", "bloating", "backache"],
    ["cramps", "fatigue", "breast_tenderness", "acne"],
    ["severe_cramps", "nausea", "bloating", "migraine", "spotting"],
    ["cramps", "backache", "fatigue", "dizziness", "cravings"],
    ["bloating", "headache", "cramps", "breast_tenderness"],
    ["severe_cramps", "nausea", "backache", "fatigue", "bloating"],
]
ANANYA_MOODS = [
    ["anxious"], ["depressed"], ["anxious"],
    ["overwhelmed"], ["tired"], ["anxious"],
]
ANANYA_LENGTHS = [6, 6, 7, 6, 6, 6]

ANANYA_CYCLES = [
    {"period_start_date": d.isoformat(), "period_end_date": (d + timedelta(days=pl)).isoformat(),
     "symptoms": s, "mood_tags": m}
    for d, pl, s, m in zip(A_DATES, ANANYA_LENGTHS, ANANYA_SYMPTOMS, ANANYA_MOODS)
]


def register_or_login(client, data):
    resp = client.post(f"{API_BASE}/auth/register", json=data)
    if resp.status_code == 201:
        body = resp.json()
        print(f"  [OK] Registered: {data['display_name']} ({data['email']})")
        return body["tokens"]["access_token"], body["user"]["id"]
    elif resp.status_code == 409:
        print(f"  [..] {data['display_name']} already exists - logging in")
        login_resp = client.post(f"{API_BASE}/auth/login",
                                 json={"email": data["email"], "password": data["password"]})
        if login_resp.status_code == 200:
            body = login_resp.json()
            return body["tokens"]["access_token"], body["user"]["id"]
        else:
            print(f"  [FAIL] Login failed ({login_resp.status_code}): {login_resp.text[:200]}")
            sys.exit(1)
    else:
        print(f"  [FAIL] Register failed ({resp.status_code}): {resp.text[:200]}")
        sys.exit(1)


def create_onboarding(client, token, data):
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.put(f"{API_BASE}/onboarding", json=data, headers=headers)
    if resp.status_code == 200:
        print(f"  [OK] Onboarding created")
    else:
        print(f"  [FAIL] Onboarding ({resp.status_code}): {resp.text[:100]}")


def delete_all_entries(client, token):
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get(f"{API_BASE}/cycle/entries?months_back=36&limit=200", headers=headers)
    if resp.status_code == 200:
        for e in resp.json():
            client.delete(f"{API_BASE}/cycle/entries/{e['id']}", headers=headers)
            print(f"  [OK] Deleted entry: {e['period_start_date']}")


def create_cycle_entries(client, token, entries):
    headers = {"Authorization": f"Bearer {token}"}
    for i, entry in enumerate(entries, 1):
        resp = client.post(f"{API_BASE}/cycle/entries", json=entry, headers=headers)
        if resp.status_code == 201:
            print(f"  [OK] Cycle entry {i}: {entry['period_start_date']}")
        elif resp.status_code == 409:
            print(f"  [..] Cycle entry {i}: {entry['period_start_date']} already exists")
        else:
            print(f"  [FAIL] Cycle entry {i} ({resp.status_code}): {resp.text[:100]}")


def verify_user(client, token, name):
    headers = {"Authorization": f"Bearer {token}"}
    r = httpx.get(f"{API_BASE}/cycle/entries", headers=headers)
    entries = r.json()
    print(f"\n  [{name}] Cycle entries visible: {len(entries)}/6")
    for e in entries:
        print(f"    {e['period_start_date']} -> {e.get('period_end_date','?')}")
    if len(entries) < 6:
        print(f"  [WARN] Only {len(entries)} of 6 entries visible!")
    return len(entries)


def main():
    print("=" * 60)
    print("  SheCare Test User Seeder")
    print(f"  Today: {TODAY} | Cutoff: {CUTOFF}")
    print("=" * 60)

    try:
        httpx.get(f"{API_BASE}/auth/login", timeout=5)
    except Exception as e:
        print(f"[FAIL] Cannot connect: {e}")
        sys.exit(1)

    all_ok = True
    with httpx.Client(timeout=30.0) as client:
        for label, user_data, onboarding_data, cycle_entries in [
            ("Priya Sharma (Regular 28-day)", PRIYA, PRIYA_ONBOARDING, PRIYA_CYCLES),
            ("Ananya Verma (Irregular/PCOS)", ANANYA, ANANYA_ONBOARDING, ANANYA_CYCLES),
        ]:
            print(f"\n{'='*60}")
            print(f"  Creating: {label}")
            print(f"  Dates: {cycle_entries[0]['period_start_date']} .. {cycle_entries[-1]['period_start_date']}")
            print(f"{'='*60}")
            token, uid = register_or_login(client, user_data)
            print(f"  User ID: {uid}")
            delete_all_entries(client, token)
            create_onboarding(client, token, onboarding_data)
            create_cycle_entries(client, token, cycle_entries)
            n = verify_user(client, token, label.split()[0])
            if n < 6:
                all_ok = False

    print(f"\n{'='*60}")
    print(f"  {'Done! Test users ready.' if all_ok else 'WARN: Some entries not visible!'}")
    print("=" * 60)
    print("""
  Credentials:
    Priya Sharma   -> priya.sharma@test.shecare / Test@1234
    Ananya Verma   -> ananya.verma@test.shecare / Test@1234
    """)


if __name__ == "__main__":
    main()
