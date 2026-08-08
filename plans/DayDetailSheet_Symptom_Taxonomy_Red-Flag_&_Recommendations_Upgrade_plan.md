# DayDetailSheet — Symptom Taxonomy, Red-Flag & Recommendations Upgrade (Verification Plan)

> Status: **Draft for review** — not yet implemented.
> Builds on the already-shipped `DayDetailShee_plan.md` (cycle_days data layer + DayDetailSheet UI).
> Review and confirm before implementation starts.

---

## 1. Objective

Upgrade the shipped `DayDetailSheet` (mobile) and its backing `cycle` module (backend) with three
interlocking features derived from the product brief:

1. **Physical symptom taxonomy** — re-seed the `symptoms` master into 4 clinically-grouped
   categories (~30 symptoms) replacing the current ad-hoc 5-category list.
2. **Red-flag safety engine** — detect when-to-seek-help patterns (severe pain, out-of-period pain)
   and surface gentle, compassionate guidance.
3. **Phase-locked expert recommendations** — a middle-range (non-emergent) recommendation engine
   delivering evidence-based, phase-aware, actionable cards with a "Mark done" interaction.

### Scope decisions (confirmed with the user)

| Decision | Value |
|---|---|
| Symptom master | **Replace + recategorize** — 4 new categories, drop old category scheme. |
| Severity capture | **Tap-to-cycle severity** on each symptom chip (Light→Moderate→Severe → `1/3/5`). |
| Emergency full-screen alert | **Deferred** (not in this plan). Classifier leaves a `seek_care` reserved hook. |
| 3-consecutive-cycle gynecologist rule | **Deferred** (needs history segmentation across cycles). |
| Luna / XP tie-in | **Not in this plan** — `recommendations_completed` stored only. |
| Tier naming | Internal key `seek_care` (replaces `emergency`); a separate `critical` key is **reserved** for true life-threatening events (future PR). |
| `seek_care` UI | **No UI this PR** — classifier logs it, sheet shows no visual change. |
| Delivery | **3 PRs** (§12) — never one massive PR. |

---

## 2. Reconciliation (what exists vs. what the spec wants)

| Spec asks | Current state | Gap |
|---|---|---|
| 4 symptom categories, ~30 physical symptoms | 21 symptoms in `pain/body/mood/energy/reproductive` (see `seed.py:16–42`) | Re-seed master + new category values |
| Per-symptom severity | `day_symptoms.severity 1–5` exists, but UI hardcodes `severity: 3` (`DayDetailSheet.tsx:181`) | Tap-to-cycle severity control |
| Red-flag rules (pain≥7, out-of-period pain) | Single-text `getInsightForDay` heuristic | New pure `symptomSafety.ts` rule engine |
| Phase-locked middle-range recommendations | Single `AIInsightCard` with one heuristic string | New rule engine + swipeable `RecommendationCarousel` |
| `recommendations_completed` field | not present | Add JSONB column to `cycle_days` |
| Sudden-onset flag (Rule 2) | not present | **Deferred** with the future `seek_care`/`critical` UI — no schema change now |

**Phase reconciliation:** app derives **5 phases** (`menstrual/follicular/fertile/ovulation/luteal`,
`derivePhaseForDate`); the brief uses 4. Recommendation engine keys on the app's *real* phase keys
and treats `fertile` as `follicular`-equivalent for content.

**Symptom wire contract:** backend resolves symptoms **by `name`** (`_get_symptom_by_name`
`services.py:1155` matches `Symptom.name`), and `day_symptoms` stores the UUID. Mobile sends names;
bundled JSON ids are *stable local slugs* only. Backend seed and mobile JSON must match **by name**
(§14.2).

---

## 3. New symptom taxonomy (PR-1 source of truth)

Slug = stable `id` in the bundled JSON / local SQLite. `display_order` resets within each category.

### 🔥 pain — Pain & Discomfort (10)
```
abdominal-cramps    "Abdominal Cramps"
upper-stomach-pain  "Upper Stomach Pain"
lower-back-pain     "Lower Back Pain"
leg-pain            "Leg / Thigh Pain"
joint-pain          "Joint Pain"
muscle-aches        "Muscle Aches"
headache            "Headache"
migraine            "Migraine"
breast-tenderness   "Breast Tenderness"
painful-sex         "Painful Sex"
```

### 🫧 digestive — Digestive & Bloating (7)
```
bloating       "Bloating"
constipation   "Constipation"
diarrhea       "Diarrhea"
nausea         "Nausea"
vomiting       "Vomiting"
appetite-up    "Increased Appetite"
food-cravings  "Food Cravings"
```

### ✨ skin — Skin & Appearance (3)
```
acne           "Acne / Pimples"
oily-skin      "Oily Skin"
greasy-hair    "Greasy Hair"
```

### 💫 general — General Physical (10)
```
fatigue        "Fatigue"
low-energy     "Low Energy"
discharge-up   "Increased Discharge"
fluid-retention "Fluid Retention"
weight-gain    "Weight Gain"
hot-flashes    "Hot Flashes"
chills         "Chills"
dizziness      "Dizziness"
trouble-sleep  "Trouble Sleeping"
sleep-too-much "Sleeping Too Much"
```

> **Design ok:** old rows that are superseded (`Cramps`, `Backache`, `Insomnia`, `Acne`,
> `Hot flashes`, `Dizziness`, `Diarrhea`, `Constipation`, `Nausea`, `Bloating`, `Breast tenderness`,
> `Fatigue`, `Muscle aches`, `Headache`) are **renamed in place** where they map 1:1, else
> soft-deactivated (`is_active = False`) — never hard-deleted (AGENTS §1.4). New rows added.

---

## 4. Backend (PR 1A — data layer)

### 4.1 Migrations (`backend/alembic/versions/`)

Current highest numeric prefixes: `0018`, `0019`, `0020` (diary). New:

- **`0021_cycle_resync_symptoms.py`** — re-seed/rename/deactivate symptom rows per §3 taxonomy.
  Idempotent by `name`; reversible (downgrade restores old rename mapping, deactivations reapplied).
  - `Symptom.category` values change to `pain|digestive|skin|general`.
  - `display_order` renumber per category.
- **`0023_cycle_add_day_recommendations.py`** — add `cycle_days.recommendations_completed JSONB
  DEFAULT '[]'` (NOT NULL). Reversible (drop column). Chains after `0022_nurse_content_add_media_fields`
  (nurse migration already held revision `0022`).

> No FK/cascade changes. `day_symptoms` rows referencing a renamed symptom keep working because the
> deactivated rows are soft-only; renamed rows preserve their UUID.

### 4.2 Models (`models.py`)
- `CycleDay` — add `recommendations_completed: Mapped[list] = mapped_column(JSONB, default=list,
  nullable=False)`.

### 4.3 Schemas (`schemas.py`)
- `DayUpsert` — add `recommendations_completed: list[str] = Field(default_factory=list)`.
- `DayResponse` — add `recommendations_completed: list[str] = Field(default_factory=list)` +
  populate in `from_day`.
- `DaySymptomIn.severity` already `1..5` — no change.

### 4.4 Services (`services.py`)
- `upsert_day` — persist `recommendations_completed` on the `CycleDay` row within the existing
  delta-touch transaction (ensure `client_updated_at` bump §14.1 applies for parent-field changes).
- `list_days` / `from_day` — return `recommendations_completed`.

### 4.5 Seed (`seed.py`)
- Replace `SYMPTOM_SEED` with §3 taxonomy (30 rows). Keep `MEDICATION_SEED` untouched.
- Update the parity test to assert mobile JSON ⇔ backend seed (by `name`), plus category/order.

---

## 5. Mobile — data + taxonomy (PR 1B)

- `src/assets/masters/symptoms.json` — rebuild to §3 taxonomy (30 entries, `<slug> → name → category
  → icon → display_order`). Must match backend seed exactly.
- `src/services/api/cycle.ts` — `DailyDay` gains `recommendations_completed: string[]`.
- `src/services/queryKeyMapper.ts` / sync registration — no change (day payload already syncs via
  `cycle/day`).
- Local DB `cycle_days` schema + `DayLocalService.ts` — persist `recommendations_completed`
  (round-trip in `toLocal`/`toServer`).

### 5.1 Icon strategy: hybrid custom-SVG + Lucide (NEW — decided)

Emoji strings fall flat at 22 px on low-end Android. Per design review, the symptom grid uses a
**hybrid icon set**: hand-authored custom SVG for the most expressive symptoms + abstract tokens
from a system icon library for the rest.

- **Author a small custom SVG set** (`react-native-svg` already a dependency, pin `15.15.4`) for the
  hero symptoms where a literal shape wins — these get bespoke glyphs (cramps/lower-abdomen flare,
  heat-pad therapy icon, breast tenderness, headache halo, bloating crescent, fatigue moon,
  nausea wave, back-pain curve, dizziness spiral, hot-flash sun). Storage:
  `src/components/ui/symptomIcons/CustomSymptomIcons.tsx`, Icons drawn 24×24 viewBox, currentColor.
- **Lucide for the rest** (`lucide-react-native`) with a name→token map; abstract/stroke icons for
  the remaining physical/general rows (e.g. `flame`, `droplet`, `wind`, `flower`, `utensils`).
- **`SymptomIcon` dispatcher** (`src/components/ui/symptomIcons/SymptomIcon.tsx`): keyed by
  `<name>` → custom SVG first, else Lucide token, else fallback emoji. All code-paths keep the
  `<Text>` emoji as a graceful degraded fallback.
- JSON bundle adds a `icon_kind: 'custom' | 'lucide'` value per row; the renderer never reads the
  emoji glyph into `<Text>` when an icon is available.
- Add dependency: `lucide-react-native` (added to `mobile/package.json` in PR 1B).
- Accessibility: decorative glyphs get `aria-hidden`-style treatment (`accessible={false}`);
  severity state announced via `AccessibilityValue` (§6).

> Custom SVG hero set is a fixed-size box; skip too-realistic organs — the design rule is
> "friendly, round, on-tone" (matches the mascot style of DayDetailShee_plan.md §-day-206).

The exact custom-SVG subset is frozen in §11 (open question #5) so designers ship only 10–14
glyphs, not 30.

---

## 6. Severity tap-to-cycle (PR 1C)

### `SymptomAccordion.tsx`
- Chip becomes **3-state severity chip** (normalized storage `1 | 3 | 5`):
  1. unselected →
  2. tap → Moderate (`3`) filled chip,
  3. tap → Severe (`5`) (visible "• • •"),
  4. tap → Light (`1`) (one dot),
  5. tap → unselected.
- Visual: filled pink accent with severity dots (1/3/5) under the icon; color shifts
  Light→Moderate→Severe.
- Accessibility: `accessibilityValue={{ now: severity, min: 1, max: 5 }}`, label `"<name>, severe"`.

### `DayDetailSheet.tsx`
- `obs.symptomSeverities: Record<string, number>` (maps name → 1/3/5, default `3`).
- Replace hardcoded `severity: 3` in `handleDone` with `obs.symptomSeverities[name] ?? 3`.
- `toggleSymptom(name)` → `cycleSymptomSeverity(name)`.
- `obs.recommendationsCompleted: string[]` for PR 3.

---

## 7. Red-flag safety engine (PR 2, client-side)

### `src/utils/symptomSafety.ts` (pure, unit-tested)
Input `{ painLevel, phaseKey, selectedSymptomNames, avgPeriodDays }` → output:

```
{ tier: 'seek_care' | 'recommendation' | 'maintenance' | 'motivation',
  flags: RedFlag[], }
```

**Four-tier pyramid (§ brief "Summary") — explicit UI mapping:**

| Tier (internal key) | Condition | UI Element | Behavior |
|---|---|---|---|
| `seek_care` | pain ≥ 7 OR out-of-period pain (Rule 1 / Rule 4) | **none this PR** | Reserved hook. `useUpsertDay.onSuccess` logs `tier='seek_care'`; **no visual change**. Future PR adds the nudge/full-screen alert. |
| `recommendation` | pain 4–6 OR (fatigue/bloating/digestive present) | `RecommendationCarousel` | Shows 2–3 actionable cards above the Save button (PR 3). |
| `maintenance` | pain 1–3 | `AIInsightCard` | Single "keep tracking" card. |
| `motivation` | pain 0, energy good | `AIInsightCard` | Encouraging, non-toxic phrasing. |

> **Naming rationale:** `seek_care` (doctor's-visit trigger) is intentionally distinct from a future
> `critical` tier reserved for life-threatening events (ectopic pregnancy, sudden severe pain + fever)
> which would power the deferred full-screen alert. `critical` is **not** returned by the classifier
> in this PR.

**Rule 1 (severe pain → gentle nudge, UI deferred):** `painLevel >= 7`
> "You've logged severe pain that's interfering with your daily life. Period pain shouldn't stop
> you. If this is regular, we recommend speaking to a gynecologist to explore underlying causes
> like endometriosis."

**Rule 4 (out-of-period pain — Window):** `painLevel >= 7 AND phaseKey !== 'menstrual'`
→ `seek_care` with contextual copy (rendered by the future PR):
> "You logged pelvic pain on Day N — outside your period window. Cycle-independent pain can be a
> sign of endometriosis or a hormonal imbalance. Worth discussing with your doctor for a clearer
> picture."

**Rule 2 (sudden escalation) & Rule 3B (3-cycle history):** deferred — classifier returns
`flags: []` today; the `seek_care` tier is surfaced via the classifier output only
(backwards-compatible).

### `dayInsights.ts` (upgrade)
- Return `{ tier, motivation, rules[] }` using `symptomSafety`.
- `dayInsights` renders only for `maintenance` / `motivation` tiers; `seek_care` and
  `recommendation` are handled by their own UI slots.
- Replace generic copy with §Step 5 "Motivational Layer" phrasing (no "just cheer up").

### UI (`DayDetailSheet.tsx`)
The `handleDone` flow evaluates the tier and renders **one** of the two slots:

```
const safety = getSafetyForDay({ painLevel, phaseKey, symptoms, ... });  // PR 2
const recs   = getRecommendations({ phaseKey, painLevel, symptoms });    // PR 3

// lower section:
{ tier === 'recommendation' && recs.length > 0 ? (
    <RecommendationCarousel cards={recs} ... />     // PR 3
  ) : (
    <AIInsightCard ... />                            // PR 2 — maintenance / motivation
  )}
```

- `seek_care` → no card, no carousel, no visual change; log to Sentry/metrics only.
- Rule 1 nudge shows as a **non-dismissible-but-gentle card** after save (`useUpsertDay.onSuccess`)
  in the future PR that adds `seek_care` UI.
- Tests: `src/utils/__tests__/symptomSafety.test.ts` + `dayInsights.test.ts` updated.

---

## 8. Expert recommendations engine (PR 3)

### `src/utils/expertRecommendations.ts` (pure)
Input `{ phaseKey, painLevel, selectedSymptoms, severities }` → `RecommendationCard[]`
(max 3):

```
interface RecommendationCard {
  id: string;            // stable slug, e.g. "menstrual-heat"
  icon: string;
  title: string;
  body: string;
  cta?: string | null;   // button label
  action?: 'water' | 'breathing' | 'days-stretch' | 'mark-done' | null;
}
```

**Phase-locked content matrix (from brief §Step 2/3):**

| Phase | Cramps (pain 4–6) | Fatigue | Bloating |
|---|---|---|---|
| Menstrual | Heat therapy 15–20 min + gentle Cat-Cow; magnesium (banana, pumpkin seeds) | Rest + iron-rich foods | Hydration, limit salt |
| follicular/fertile | Stretching | Light cardio (walking) | Increase fiber |
| ovulation | Light yoga | HIIT / moderate strength | Drink more water |
| Luteal | Magnesium + Omega-3 | Sleep hygiene, light strength training | Reduce carbs/sodium |

**Remedies & CTAs (from brief §Step 3):**
- Pain: `"Place a heat pack or warm water bottle on your lower abdomen for 15–20 minutes. Combine
  with gentle Cat-Cow stretches."` + cta "Log water intake".
- Bloating: potassium foods (banana/avocado) + `"A 10-minute gentle walk 1 hr after meals
  significantly reduces gas and bloating."`
- Fatigue: iron foods + green tea tip; cta `"Just 5 minutes of sunlight resets your circadian
  rhythm."`
- Mood/motivation framing (no toxic positivity): `"Your body is working hard right now. You don't
  need to be superhuman today."` Alternate cross-link to Breathe tab when anxiety present.

### `RecommendationCarousel` (`src/components/ui/dayDetail/RecommendationCarousel.tsx`)
- Horizontal `ScrollView` of cards, appended to `AIInsightCard`'s slot — rendered above the Save
  button per brief.
- Each card: `Mark done` checkbox → `expo-haptics` light on check; writes
  `obs.recommendationsCompleted` (persist via existing `useUpsertDay` on next Save).
- When `seek_care` tier is active, carousel is hidden (reserved for deferred full-screen).

---

## 9. Contract, docs & checks

- **`plans/30-mobile-api-contract.md`** — update **Daily Days** §: `recommendations_completed`
  (request/response), severity values, symptom categories.
- Backend: `ruff`, `mypy --strict`, `pytest tests/modules/cycle/test_days.py` (extended: severity
  round-trip, recommendations persistence, seed parity, category values).
- Mobile: `tsc --noEmit`, `jest` (`symptomSafety.test.ts`, `expertRecommendations.test.ts`,
  `dayInsights.test.ts`, updated `SymptomAccordion` tests).
- AGENTS checklist: master seeded idempotently ✓, `/api/v1 ✓`, per-row `current_user.id` ✓,
  service-layer encryption unchanged (`notes` probability ✓), reversible migrations ✓, offline
  bundle parity ✓, module-owned tables ✓.

---

## 10. Deferred (scoped out — documented, not blocked)

1. Emergency full-screen alert + **Rule 2** (sudden escalation). **When implemented, Rule 2 will
   require:** a new `cycle_days.pain_onset` column (`'sudden' | 'gradual' | null`) — **not** part
   of the current migrations `0021`/`0023` — plus a UI control below the Pain Slider
   ("Did this pain come on suddenly?"). A `critical` tier (true life-threatening events) may be
   added then as a distinct key from `seek_care`.
2. 3-consecutive-cycle gynecologist nudges (needs cycle_days history spanning ≥3 periods).
3. Luna XP award for marked-done recs (`recommendation_completed` event).
4. Per-category severity modal (long-press deepen detail) — tap-to-cycle is the MVP.

---

## 11. Open questions (for the reviewer)

- [ ] **Painful Sex** included in `pain` category — confirm inclusion + icon (custom-SVG candidate).
- [ ] "spotting" symptom is removed from the master because `FlowSelector` already handles flow;
  confirm no other screen depends on the `reproductive` category.
- [ ] Confirm the 4 category keys (`pain` / `digestive` / `skin` / `general`) can drive
  `SymptomAccordion` labels; drop old `mood`/`energy`/`reproductive` accordion sections.
- [ ] `display_order` values: per-category restart (recommended) vs global.
- [ ] **Custom-SVG hero subset (PR 1B):** freeze the 10–14 symptoms that get bespoke SVGs (candidate
  list in §5.1); everything else falls to Lucide. Needs design sign-off before icon work starts.

---

## 12. Delivery split (3 PRs — reviews before code)

| PR | Scope | Risk | Independent? |
|---|---|---|---|
| **PR 1 — Data layer + taxonomy** | Backend: `0021_cycle_resync_symptoms`, `0023_cycle_add_day_recommendations`, models/schemas/services/seed; Mobile: `symptoms.json`, `api/cycle.ts`, localDb round-trip. | **Low** — no UI; creates new column; re-seed idempotent. | Yes → deployable first. |
| **PR 2 — Rule engine + tier UI** | `symptomSafety.ts`, upgraded `dayInsights.ts`, `AIInsightCard` tier+motivation, Rule 1/3 nudges, tests. | **Medium** — visible in sheet; gated behind date tap + save. | Alone. |
| **PR 3 — Recommendations** | `expertRecommendations.ts`, `RecommendationCarousel`, severity tap-to-check, `obs.recommendationsCompleted`, persist. | **Medium** — new UI surface; revert alone keeps PR1-2. | Alone. |

**Rationale:** PR 1 ships first (schema + seed), PR 2/3 build on it. If the sheet UI misbehaves,
revert PR 3 → restore PR 2 independently without touching the data layer.

---

## 13. Implementation Checklist

| PR | Task | Owner | Status |
|---|---|---|---|
| PR 1 | Backend migrations `0021` (symptom reseed) + `0023` (`recommendations_completed`) | Backend | ✅ |
| PR 1 | Models, schemas, services (`upsert_day` + `list_days` + `from_day`) | Backend | ✅ |
| PR 1 | Mobile `symptoms.json` rebuild, `api/cycle.ts` types, localDb round‑trip | Mobile | ✅ |
| PR 1 | `lucide-react-native` dep + `SymptomIcon` dispatcher (custom-SVG ⨯ Lucide hybrid, §5.1) | Mobile | ✅ |
| PR 1 | Seed parity test (backend seed ⇔ mobile JSON) | Backend + Mobile | ✅ |
| PR 2 | `symptomSafety.ts` pure rule engine (Rule 1, Rule 4 → `seek_care`) | Mobile | ✅ |
| PR 2 | Upgraded `dayInsights.ts` + `AIInsightCard` tier/motivation | Mobile | ✅ |
| PR 2 | Unit tests: `symptomSafety.test.ts`, `dayInsights.test.ts` | Mobile | ✅ |
| PR 3 | `expertRecommendations.ts` phase-locked content matrix | Mobile | ✅ |
| PR 3 | `RecommendationCarousel` component + `SymptomAccordion` tap-to-cycle severity | Mobile | ✅ |
| PR 3 | `recommendations_completed` persistence via `useUpsertDay` | Mobile | ✅ |
| All | `npx tsc --noEmit`, `ruff`, `mypy --strict`, `pytest`, `jest` | All | ⬜ |

---

## 14. Critical gotchas

### 14.1 `client_updated_at` on the parent
`recommendations_completed` lives on `cycle_days` itself — the sync engine already compares the
parent row, so bumping `client_updated_at` on any day mutation (which `upsert_day` already does)
keeps these writes in sync. No new sync columns needed.

### 14.2 Master parity is a hard contract
Backend `seed.py` and `assets/masters/symptoms.json` must match by `name`; add a test (backend seed
⇔ mobile bundle) so they can't drift (AGENTS §1 + DayDetailShee_plan.md §13.2).

### 14.3 No deletes, ever
Use `is_active = False` for deprecated symptoms — never hard DELETE rows referenced by
`day_symptoms` (FKs + historical data).

### 14.4 Renamed symptom name
Renaming a symptom keeps the UUID (FK preserved). Mobile bundles may or may not have the old slug;
seeding on a fresh install picks the new bundle, and write-through must tolerate name drift
(service logs unknown symptom names: `services.py:1266`).