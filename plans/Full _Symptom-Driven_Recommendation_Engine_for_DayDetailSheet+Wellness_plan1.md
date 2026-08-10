# Full Symptom-Driven Recommendation Engine — PR 1 (Backend Master Expansion)

> Status: **Draft for review** — verify before any code.
> PR 1 of 5 (`plan1`…`plan5` in this folder). This PR is **independent & deployable first**
> — schema + seed only, no UI. Plan2 mirrors the taxonomy on mobile.

---

## 1. Objective

Expand the `symptoms` master from 30 rows / 4 categories to the full
`pain / digestive / skin / general / mood / reproductive` taxonomy (**57 rows**)
so the recommendation engine (PR 3) and safety rules (PR 5) can key on
**every symptom a user can log**.

The full taxonomy (names, categories, display_order, icons) is defined in
§3 below
and must be mirrored **exactly** in `mobile/src/assets/masters/symptoms.json` (plan2)
— parity by `name` is a hard contract (AGENTS §1.4 / DayDetailShee_plan.md §13.2).

---

## 2. Current state (verified)

| Item | Path | Detail |
|---|---|---|
| Master seed | `backend/app/modules/cycle/seed.py` | `SYMPTOM_SEED` — 31 tuples `(name, category, icon, order)` |
| Table | `cycle.Symptom` (`models.py`) | `name`, `category`, `icon`, `display_order`, `is_active` |
| Migration example | `alembic/versions/0021_cycle_resync_symptoms.py` | Prior reseed/rename/deactivate pattern (idempotent-by-name, reversible) |
| Highest revisions | `0023_cycle_add_day_recommendations.py`, `2026_08_05_*` (health tips) | New migration must chain after these |
| API | `GET /api/v1/cycle/symptoms` | returns active masters ordered by `display_order` |

**Constraints**
- Existing 31 rows keep their **names & UUIDs** — never renamed/hard-deleted
  (FKs in `day_symptoms` + `cycle_days.symptoms` history depend on them).
- `Cramps`, `Low Energy`, `Lower Back Pain` remain aliases **handled in the engine**
  (PR 3), not as separate master rows.
- Category values change only by **adding new rows**; existing rows' categories stay
  (`pain|digestive|skin|general`).
- SQLAlchemy `2.x` async, Pydantic v2, one migration per change, reversible.

---

## 3. New taxonomy to seed (source: plan0 §3)

### 🔥 `pain` — Pain & Discomfort (existing 10, unchanged)
> `Abdominal Cramps, Upper Stomach Pain, Lower Back Pain, Leg / Thigh Pain, Joint Pain,
> Muscle Aches, Headache, Migraine, Breast Tenderness, Painful Sex`

### 🫧 `digestive` — Digestive & Bloating (existing 7, unchanged)
> `Bloating, Constipation, Diarrhea, Nausea, Vomiting, Increased Appetite, Food Cravings`

### ✨ `skin` — Skin & Hair (existing 3 + 3 new = 6)
```
acne            "Acne / Pimples"
oily-skin       "Oily Skin"
greasy-hair     "Greasy Hair"
hair-thinning   "Hair Thinning / Loss"
hirsutism       "Excess Facial / Body Hair"
dry-skin        "Dry / Itchy Skin"
```

### 💫 `general` — Energy, Sleep & General (existing 10 + 5 new = 15)
```
fatigue          "Fatigue"
low-energy       "Low Energy"
discharge-up     "Increased Discharge"
fluid-retention  "Fluid Retention"
weight-gain      "Weight Gain"
hot-flashes      "Hot Flashes"
chills           "Chills"
dizziness        "Dizziness"
trouble-sleep    "Trouble Sleeping"
sleep-too-much   "Sleeping Too Much"
night-sweats     "Night Sweats"
palpitations     "Heart Palpitations"
unwell           "Feeling Unwell / Weakness"
uti              "Frequent Urination / UTIs"
vision-changes   "Vision Changes"
```
> `vision-changes` added per Implementation Note 2 (PR 5 red-flag table references it).

### 🧠 `mood` — Mental & Emotional (NEW category, 11 rows)
```
mood-swings     "Mood Swings"
irritability    "Irritability"
anxiety         "Anxiety / Nervousness"
depressed-mood  "Depressed Mood / Sadness"
tearfulness     "Tearfulness / Crying Spells"
brain-fog       "Brain Fog"
concentration   "Difficulty Concentrating"
overwhelmed     "Feeling Overwhelmed"
withdrawal      "Social Withdrawal"
low-libido      "Reduced Libido"
severe-depression "Severe Depression / Self-Harm"
```
> `severe-depression` added per Implementation Note 2 (PR 5 red-flag table references it).

### 🩺 `reproductive` — Menstrual & Hormonal (NEW category, 8 rows)
```
heavy-bleeding   "Heavy / Prolonged Bleeding"
irregular-cycle  "Irregular Cycles"
spotting         "Bleeding / Spotting Between Periods"
absent-period    "Absent Period / Amenorrhea"
painful-ovulation "Painful Ovulation"
pms              "PMS Symptoms"
pmdd             "PMDD (Severe PMS)"
painful-urination "Painful Urination"
```

> **Design ok:** `dry-skin`, `night-sweats`, `palpitations`, `unwell`, `uti`,
> `painful-urination` land in `general`/`reproductive` as shown (three were in your
> "Other Physical" / red-flag columns; keeping them grouped here avoids a 7th category).

---

## 4. Migration `0024_cycle_add_mood_reproductive_symptoms.py`

Path: `backend/alembic/versions/0024_cycle_add_mood_reproductive_symptoms.py`

- Style: follow `0021` — explicit `op.bulk_insert` guarded by `SELECT` existence per name
  (idempotent). Do **not** alter existing rows.
- Adds **27 new rows** (3 skin + 5 general + 11 mood + 8 reproductive); existing 30 rows
  unchanged → **57 total**.
- `display_order` restarts within each category (per AGENTS + existing seed convention).
- **Downgrade (Implementation Note 5):** downgrade is a **no-op**. These are pure additions
  (no existing row touched, no FK history on the new rows), so keeping them on downgrade is
  harmless. Put this verbatim comment in the migration:
  ```python
  # downgrade is no-op — these are pure additions; keeping them is harmless.
  ```
- `revision` chains after `down_revision` of `0023_cycle_add_day_recommendations.py`
  (check its current `down_revision` and append `0024` as leaf; if `2026_08_05_*`
  already superseded, set `down_revision` to **the current alembic head**).

---

## 5. `seed.py` change

`backend/app/modules/cycle/seed.py`

- Extend `SYMPTOM_SEED` to the full §3 list (57 tuples).
- Keep `MEDICATION_SEED` untouched.
- `seed_day_masters()` stays idempotent by `name` — no logic change.
- Add a **parity guard** comment pointing to the mobile JSON path + the parity test (§6).

---

## 6. Parity test (backend seed ⇔ mobile bundle)

Extend the existing seed-parity test. Location: `backend/tests/modules/cycle/`
(search for the current one; planner expects a file like `test_master_parity.py`).

New assertions, executed **in the same PR as PR 2** (make this test read the actual
`mobile/src/assets/masters/symptoms.json` at `TEST_ROOT` via relative path):

```python
# expectations
expected_names = {name for (name, *_rest) in SYMPTOM_SEED}

# from mobile JSON (PR 2 must exist before this passes)
mobile_names = {row["name"] for row in mobile_json}

assert mobile_names == expected_names          # exact set equality
# category + display_order match per name (spot-check high-risk names)
# icons present on every row (string, non-empty)
```

> If mobile JSON hasn't landed yet when this PR merges, ship the backend test with a
> `pytest.mark.skipif(not mobile_json_exists)` guard and flip it in PR 2. Prefer not
> guarding — PR 1 + PR 2 in one release train anyway.

---

## 7. Files changed (summary)

| File | Change | Risk |
|---|---|---|
| `backend/alembic/versions/0024_cycle_add_mood_reproductive_symptoms.py` | New migration (adds 27 rows) | Low |
| `backend/app/modules/cycle/seed.py` | Extend `SYMPTOM_SEED` | Low |
| `backend/tests/modules/cycle/test_master_parity.py` | Extend parity assertions | Low |

---

## 8. Backend gates

```
cd backend
.venv\Scripts\python.exe -m ruff check app alembic tests
.venv\Scripts\python.exe -m mypy --strict app
.venv\Scripts\python.exe -m pytest tests/modules/cycle -x -q
alembic upgrade head          # on a scratch DB — verify 0024 applies clean
```

---

## 9. AGENTS checklist (backend)

- [ ] New migration is reversible (no-op + documented) or documented destructive
- [ ] Migration chains after current alembic head
- [ ] Seed idempotent by `name` (no dupes on re-run)
- [ ] No hard deletes of existing rows; existing UUIDs/names untouched
- [ ] Parity test updated (backend seed ⇔ mobile bundle by `name`)
- [ ] `ruff`, `mypy --strict`, `pytest` green
- [ ] API contract (§ Daily Days + masters) flagged for update in PR 5