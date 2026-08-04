# DayDetailSheet — Premium Redesign & Day-Centric Data Layer (Verification Plan)

> Status: **Draft for review** — not yet implemented.
> Review this document and confirm before implementation starts.

---

## 1. Objective

Rebuild the calendar `DayDetailSheet` into a premium, iOS/Android-native bottom sheet
(HIG + Material 3 principles, calming/feminine/medical-grade aesthetic) and back it with a
**per-day canonical data model** so every logged observation (mood, symptoms+severity,
flow, pain, energy, sleep, water, medication, notes) is stored per-date and is SQL-queryable
for future AI features.

Scope decision: **UI-first + phased data layer.** The existing period lifecycle + prediction
engine (`cycle_entries`, `logCorrection`, check-in/end-date notifications) is **untouched**.

---

## 2. Confirmed design decisions

| Topic | Decision |
|---|---|
| Architecture pace | **Phased** — ship sheet + canonical `cycle_days` now; normalize `period_events`/`cycles`/`moods`-master/row-level-sync later. |
| Symptoms storage | **`symptoms` master + `day_symptoms` M2M with `severity 1–5`** (not JSONB). |
| Mood model | **Reuse existing 6-value vocabulary + intensity** (ML/analytics compatible). New `moods` master deferred. |
| Medication | **`medications` master + `day_medications` join** (`dose`, `taken_at`), seeded with 7 examples + categories. |
| Phase / cycle_day on day row | **NOT stored** — derived on read from existing prediction engine (avoids drift). |
| Day save semantics | **Replace** the day's symptoms/medications with current selection on Save. Parent `cycle_days` row's `updated_at` + `client_updated_at` are bumped on every replace so the sync engine sees the change. |
| Migration numbering | Numeric prefix `0018_` *(highest existing is `0017`)*. |
| Delivery | **Split across 3 PRs** (see §12) — never ship as one massive PR. |
| Period action buttons | **Not** part of the day Save transaction. They call the existing `logCorrection` / `useUpdateCycleEntry` mutations; day-save and period-save are orchestrated to avoid desync (§13.1). |
| Masters (symptoms/meds) | **Bundled static JSON + seeded local SQLite** queried via React Query — fully functional offline from day one, backend seed matches the bundle exactly (§13.2). |

---

## 3. Backend — Phase 1 (extend `cycle` module only)

### 3.1 New tables (`backend/app/modules/cycle/models.py`)

All tables inherit `Base` (database.py:38): `id` UUID PK, `created_at`, `updated_at`,
`client_updated_at`, `is_active`.

**`cycle_days`** — canonical per-user-per-day observation record.
```
id UUID PK
user_id UUID FK users.id (CASCADE, index)
log_date DATE (index)
mood VARCHAR(50) | null
mood_intensity SMALLINT | null (CHECK 1..10)
pain_level SMALLINT | null (CHECK 0..10)
energy_level SMALLINT | null (CHECK 1..3)
sleep_minutes INTEGER | null (CHECK 0..1440)
water_glasses SMALLINT | null (CHECK 0..32)
flow_level VARCHAR(10) | null        -- none|spotting|light|medium|heavy
notes TEXT | null                     -- encrypted (service layer)
UNIQUE(user_id, log_date)
```

**`symptoms`** — master table (never hardcoded).
```
id UUID PK
name VARCHAR(50) UNIQUE
category VARCHAR(30)                  -- pain|body|mood|energy|reproductive
icon VARCHAR(10) | null               -- emoji
display_order SMALLINT default 0
```

**`day_symptoms`** — M2M with severity.
```
id UUID PK
day_id UUID FK cycle_days.id (CASCADE, index)
symptom_id UUID FK symptoms.id (CASCADE, index)
severity SMALLINT default 3 (CHECK 1..5)
UNIQUE(day_id, symptom_id)
```

**`medications`** — master table.
```
id UUID PK
name VARCHAR(80) UNIQUE
category VARCHAR(30)                  -- painkiller|supplement|hormone|other
display_order SMALLINT default 0
```

**`day_medications`** — M2M with dose + timestamp.
```
id UUID PK
day_id UUID FK cycle_days.id (CASCADE, index)
medication_id UUID FK medications.id (CASCADE, index)
dose VARCHAR(40) | null
taken_at TIMESTAMPTZ | null
UNIQUE(day_id, medication_id)
```

**Indexes:** `(user_id, log_date)`, `(user_id, flow_level)`, `day_symptoms(day_id)`,
`day_symptoms(symptom_id)`, `day_medications(day_id)`, `day_medications(medication_id)`.

### 3.2 Schemas (`backend/app/modules/cycle/schemas.py`)

- `DayUpsert` — `mood`, `mood_intensity`, `pain_level`, `energy_level`, `sleep_minutes`,
  `water_glasses`, `flow_level`, `notes`, `symptoms: [{symptom, severity}]`,
  `medications: [{med_id?, name, dose?, taken_at?}]` (all optional; bounds enforced via `Field(ge/le)`).
- `DayResponse` (`from_attributes`) — day fields + resolved `symptoms[]` + `medications[]`.
- `SymptomResponse`, `MedicationResponse` (`from_attributes`) — master rows.

### 3.3 Services (`backend/app/modules/cycle/services.py`)

- `upsert_day(db, user_id, log_date, data)` — idempotent on `(user_id, log_date)`;
  **replace** that day's `day_symptoms` / `day_medications`; encrypt `notes` via
  `encryption_service` (service layer only, §1.12); row-scoped to `user_id` (§1.12).
  - **Gotcha §13.3:** whenever the joins are replaced, explicitly set the parent
    `cycle_days.updated_at` AND `client_updated_at = NOW()` in the same transaction.
    The join rows carry no `client_updated_at`; the sync engine compares the parent
    row, so a stale parent timestamp would cause the day change to be skipped.
- `list_days(db, user_id, start, end)` — range query for prefill + AI insight history.
- `list_symptoms()`, `list_medications()` — active masters ordered by `display_order`
  (source of truth mirrored by the bundled mobile JSON, §13.2).

### 3.4 Routes (`backend/app/modules/cycle/routes.py` — thin)

```
GET  /api/v1/cycle/days?start=&end=          → list[DayResponse]
PUT  /api/v1/cycle/days/{log_date}           → DayResponse (upsert)
GET  /api/v1/cycle/symptoms                  → list[SymptomResponse]
GET  /api/v1/cycle/medications               → list[MedicationResponse]
```
Auth via existing `CurrentUser`; responses via Pydantic `response_model` (existing pattern).

### 3.5 Migration + seed

- `backend/alembic/versions/0018_cycle_add_day_observations.py` — create 5 tables, FKs,
  CHECK/UNIQUE constraints, indexes. **Reversible** (downgrade drops tables).
- Seed `symptoms` master (grouped from `app/seed.py` SYMPTOM_DICTIONARY into
  Pain/Body/Mood/Energy/Reproductive) + `medications` master:
  - Painkiller: Ibuprofen, Paracetamol, Naproxen
  - Hormone: Birth Control Pill
  - Supplement: Iron Supplement, Magnesium, Vitamin D

### 3.6 Tests (`backend/tests/modules/cycle/test_days.py`)

- `upsert creates on first save, updates on second (idempotent).
- day_symptoms / day_medications replaced on re-save.
- **Parent `cycle_days.client_updated_at` bumped to NOW() whenever joins are replaced
  (§13.3).**
- Row isolation: user B cannot read or overwrite user A's day.
- Validation bounds: pain 11 → 422, energy 0/4 → 422, sleep > 1440 → 422.
- `notes` encrypted at rest (raw DB value ≠ plaintext).
- Masters endpoints return seeded rows ordered by `display_order`.

---

## 4. Mobile — Phase 2 (data layer)

- **`src/services/api/cycle.ts`** — `DailyDay`, `DaySymptomLog`, `DayMedicationLog` types +
  `cycleService.getDays(start,end)`, `upsertDay(logDate,data)`, `getSymptoms()`, `getMedications()`.
- **`src/services/queries/cycle.ts`** — add `days` / `symptoms` / `medications` keys to
  `getCycleKeys`; new hooks:
  - `useCycleDays(range)` — per-user React Query (never static keys).
  - `useUpsertDay()` — optimistic update + offline enqueue `cycle/day` +
    success invalidation (mirror `useUpdateCycleEntry`, cycle.ts:102).
  - `useSymptoms()`, `useMedications()` — **read from local SQLite masters**, seeded at
    first launch from bundled JSON (§13.2), with a background re-sync against the backend
    when online.
- **`src/services/sync/queryKeyMapper.ts`** + **`syncHydrate.ts`** — register `cycle/day`.
- **`src/services/localDb/schema.ts`** + local services — add `cycle_days` / `day_symptoms` /
  `day_medications` / `symptoms` / `medications` tables + write-through helper (offline reopen).
- **`src/assets/masters/symptoms.json`** + **`medications.json`** — static bundles shipped in
  the app; first-launch seeding into SQLite; must match backend seed exactly (§13.2).

---

## 5. Theme tokens — Phase 3 (`src/theme/tokens.ts`, additive)

New semantic tokens (mirrored in `darkColors`), no global color changes:

```
primaryDeep #FF4D8D    lightPink #FFE6EF    sheetBg #FFF8FA
card #FFFFFF           borderSubtle #EFEFEF textStrong #1C1C1E   textSoft #6C6C70
accentGreen #53C46A    accentPurple #8A5CF6 accentBlue #4DA8FF   accentOrange #FFA640

radius.sheet 28   radius.cardLg 20   radius.chip 14
typography.dayTitle   32 / 800 / Inter
typography.sectionTitle 19 / 600
typography.helper     12
```

---

## 6. UI components — Phase 4 (`src/components/ui/dayDetail/`)

New section components (theme-token driven, accessible, ≥44 pt touch targets):

| Component | Description |
|---|---|
| `DayHero` | Gradient hero: 64 px phase-icon circle, date title, phase emoji+label, "Cycle Day N", "Logged today" pill, inline-SVG minimal mascot. |
| `SelectedSymptomChips` | Pink filled chips with × + "Clear All". |
| `SymptomAccordion` | 5 categories (Pain/Body/Mood/Energy/Reproductive) from **local master (bundled JSON, synced)**; count badges; Reanimated expand/collapse; chips with checkmark. |
| `FlowSelector` | 4 icon cards (Spotting/Light/Medium/Heavy), **period-day only**. |
| `PainSlider` | `@react-native-community/slider` 0–10, pink active track, shadowed thumb, value bubble (`8 / 10`). |
| `EnergySegmented` | Low / Medium / High, green accent. |
| `MetricStepper` | Reusable −/+ stepper + presets: Sleep 🌙 lavender (`7h 20m`), Water 💧 blue (`6 / 8 glasses`). |
| `MedicationSection` | Multi-select chips from **local master (bundled JSON, synced)** + inline dose field. |
| `NotesSection` | Multiline + 300-char counter. |
| `AIInsightCard` | Gradient card, ✨ title, heuristic body, mini mascot. |

Modified existing:
- **`BottomSheet.tsx`** — add `footer?: ReactNode` (sticky below ScrollView → pinned Save),
  blurred backdrop (`expo-blur` BlurView + rgba overlay), default snap `[0.9]`, radius 28.
  Backward compatible (`PhaseDetailSheet`, override sheet unaffected).
- **`MoodPicker.tsx`** — add `variant="circular"`: emoji buttons, pink ring, scale 1.1,
  label below, emoji bounce. Reuses existing `MOOD_OPTIONS`.

---

## 7. DayDetailSheet rewrite — Phase 5

Layout (everything scrolls except sticky footer):

```
Drag handle
Hero header (gradient)
Period action buttons (56 px: Start / End)
Selected symptoms chips + Clear All
Symptoms categories (accordion)
Mood picker (circular)
Flow (period-only)
Pain slider (0–10)
Energy segmented
Sleep stepper
Water stepper
Medication chips + dose
Notes + counter
AI insight card
────────────────────────────
Sticky "Save Today's Entry" (56 px, pink gradient, disabled until input)
```

Animations: spring sheet (existing), ripple, chip scale, emoji bounce, thumb expansion,
save fade-in, success checkmark after save (reuse `CelebrationAnimation`), light haptics
(`expo-haptics`) on primary actions.

**`CalendarScreen.tsx` wiring:**
- New state: `pain`, `energy`, `sleep`, `water`, `flow`, `medications`, `symptomSeverities`.
- Fetch `useCycleDays` for the selected date + current-cycle history; **prefill from the
  day record** (not the covering entry).
- Flow shown only when the date is a period day.

**Save orchestration — the hidden transaction (§13.1):**
- **Day Save (`handleDone`)** → `useUpsertDay` (all day fields + symptoms + medications)
  **plus** existing `MoodLog` + `JournalEntry` writes (journal screen + sentiment pipeline
  preserved). These three run as independent mutations; each has its own
  offline-enqueue fallback, so a single failure never leaves the sheet half-saved.
- **Period action buttons (Start/End)** are a **separate concern** and are NOT bundled into
  `handleDone`. They call the existing `useLogCorrection` (start) / `useUpdateCycleEntry`
  (end) mutations as-is.
- **Ordering rule:** if the user taps Start Period and then Save in the same session, the
  period-start mutation is triggered on the button tap (existing behavior) and the day save
  is a chained follow-up — never `Promise.all` across two different resources without a
  single rollback path. On the rare `useUpsertDay` failure after a successful period start,
  show a toast + retry (data is already safe server-side; no desync is left because the
  day row is an independent observation, not part of the period record).

**AI insight** — `src/utils/dayInsights.ts` pure function over day history + covering
period + derived phase/cycle day; local rule-based for now (top symptoms by phase, avg pain,
sleep-in-luteal), unit-tested. Plugs into `AIInsightCard`. *(Real AI endpoint = later phase.)*

---

## 8. Contract, docs & checks — Phase 6

- **`plans/30-mobile-api-contract.md`** — add §Daily Days + masters: request/response
  shapes, error codes, ETag note (project invariant §1).
- Backend: `ruff`, `mypy --strict`, `pytest tests/modules/cycle/`.
- Mobile: `tsc --noEmit`, `jest` (dayInsights + component tests), lint.
- AGENTS.md checklist: schemas split Create/Update/Response ✓, `/api/v1` ✓, service-layer
  encryption ✓, row-level permission via `current_user.id` ✓, module-owned tables ✓,
  reversible migration ✓, offline queue ✓.

---

## 9. Deferred (later PRs — documented, not blocked)

1. `period_events` event sourcing (START/END) replacing direct `cycle_entries` date edits.
2. `cycles` normalization (period instance table).
3. `moods` master (emoji/name/score 1–5) + ML classifier / analytics vocab remap.
4. Row-level sync columns (`server_id` / `local_id` / `sync_status` / `deleted_at`).

---

## 10. Open items (confirmed)

- [x] Day Save = **replace** day's symptoms/medications; parent `client_updated_at` bumped (§13.3).
- [x] Migration prefix `0018_cycle_add_day_observations.py` (numeric style).
- [x] Medication section placement: between Water and Notes.
- [x] Delivery split into 3 PRs (§12).

## 11. Design spec reference (from brief)

- Palette: Primary `#FF4D8D`, Light pink `#FFE6EF`, BG `#FFF8FA`, Card `#FFFFFF`,
  Border `#EFEFEF`, Text `#1C1C1E` / `#6C6C70`, Green `#53C46A`, Purple `#8A5CF6`,
  Blue `#4DA8FF`, Orange `#FFA640`.
- Type: SF Pro Display / Inter — title 30–34 bold, section 18–20 semibold,
  label 14–16, helper 12–13, button 16–18 semibold.
- Radii: sheet 28, cards 18–20, chips 14, buttons 16–18, inputs 16.
- Gradients only on primary buttons + hero; cards flat white; soft shadows (elevation 2–4).

---

## 12. Delivery split (3 PRs — never one massive PR)

| PR | Scope | Risk | Can ship independently? |
|----|-------|------|------------------------|
| **PR 1 — Data Layer** | Backend: `models.py`, migration `0018_`, seed scripts (symptoms + medications), `upsert_day` / `list_days` / `list_symptoms` / `list_medications` services, `/cycle/days` + `/cycle/symptoms` + `/cycle/medications` routes, `test_days.py`. | **Low** — no UI, no breaking change to existing APIs. | Yes → deployable to staging immediately. |
| **PR 2 — Mobile Foundation** | `api/cycle.ts` types + service calls, React Query hooks (`useCycleDays` / `useUpsertDay` / `useSymptoms` / `useMedications`), local SQLite tables + write-through, sync registration (`queryKeyMapper` / `syncHydrate`), bundled `masters/*.json` + first-launch seed. | **Low** — behind the scenes, renders nothing new. | Yes → can develop in parallel with PR 3. |
| **PR 3 — UI/UX** | Theme tokens, `dayDetail/*` components, `BottomSheet` footer+blur, `MoodPicker` circular variant, `DayDetailSheet` rewrite, `CalendarScreen` wiring, `dayInsights.ts` + tests. | **Medium** — visible, gated behind date-tap. | Roll back alone without touching the data layer. |

**Rationale:** PR 1 merges and lands on staging first. PR 2 + PR 3 proceed in parallel.
If the UI misbehaves, revert PR 3 without reverting the data layer.

---

## 13. Critical implementation gotchas (watch-outs)

### 13.1 Period action buttons — the hidden transaction

- The "Start Period" / "End Period" buttons MUST call the existing `POST /cycle/corrections`
  (start) and `PUT /cycle/entries/{id}` (end) paths — i.e. `useLogCorrection` /
  `useUpdateCycleEntry`. They are **not** new endpoints.
- Do **not** wrap period-start + day-save in a naive `Promise.all` across two different
  resources with no single rollback path.
- Rule: period-start fires on the button tap (existing behavior); day-save is a chained,
  independent mutation. If the period-start succeeds and the day upsert fails, the day row
  is an independent observation — no desync is left; surface a retryable toast.
- The day upsert, `MoodLog`, and `JournalEntry` writes are also independent mutations, each
  with its own offline-enqueue fallback (existing `useCreateMoodLog` / `useCreateJournalEntry`
  patterns) so one failure never blocks the others.

### 13.2 Masters (symptoms / medications) must work offline from day one

- Bundle `src/assets/masters/symptoms.json` + `medications.json` **inside the app binary**.
- On first launch, seed the local SQLite `symptoms` / `medications` tables from these files
  (idempotent — only when empty/version < bundled).
- Query masters via React Query **against local SQLite** (long staleTime), not the network;
  trigger a background re-sync against `GET /cycle/symptoms` / `/cycle/medications` when
  online so the bundle can be patched server-side later.
- **Backend seed must match the bundled JSON exactly** (same `name`, `category`, `icon`,
  `display_order`, `id` strategy). Keep both in sync in the same PR (PR 1 = backend seed,
  PR 2 = bundled JSON), with a test asserting the mobile JSON matches the backend seed rows.
- Without this, a fresh offline install renders an empty accordion + medication section.

### 13.3 `client_updated_at` on the parent — join rows have no timestamp

- `day_symptoms` / `day_medications` carry only `id / day_id / *_id / severity|dose / taken_at` —
  **no `client_updated_at`**.
- The sync engine compares `client_updated_at` on the **parent `cycle_days`** row. If the
  parent timestamp stays stale while a join row changes, the sync engine can skip uploading
  the change.
- **Fix (mandatory, in `upsert_day`):** whenever you replace `day_symptoms` / `day_medications`,
  set `cycle_days.updated_at` **and** `client_updated_at = NOW()` in the same DB transaction.
  Covered by a backend test (§3.6).

### 13.4 Miscellaneous

- All `cycle_days` writes go through the service (row-scoped to `current_user.id`) — never
  trust `user_id` from the request body (§1.12).
- `notes` encryption happens in the service layer only.
- `cycle_days` has **no denormalized phase/cycle_day** — derive on read (existing
  `derivePhaseForDate`); storing them causes drift when predictions change.
