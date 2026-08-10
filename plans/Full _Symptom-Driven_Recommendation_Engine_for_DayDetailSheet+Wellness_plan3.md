# Full Symptom-Driven Recommendation Engine — PR 3 (Expert Recommendations Engine Rewrite)

> Status: **Draft for review** — verify before any code.
> PR 3 of 5. Depends on: PR 1 + PR 2 (taxonomy rows must exist for the matrix keys to be
> reachable). Replaces `mobile/src/utils/expertRecommendations.ts` entirely; no UI changes
> yet (PR 4).

---

## 1. Objective

Replace the current 3-group engine (`Cramps / Fatigue / Bloating`, only `phase-locked`
content) with a **full symptom-keyed matrix**:

- Phase-locked cards for each category × 5 app phases (`menstrual / follicular /
  fertile / ovulation / luteal`); `fertile` content reuses `follicular` (already the
  established convention in the shipped plan doc).
- A `general` (phase-agnostic) fallback bucket keyed by symptom name for cards that apply
  across all phases.
- Phase-locked motivation cards for normal days (no symptoms + pain < 2).
- Phase-locked gentle comfort card when pain ≥ 2 but no symptom matched.
- Keep the existing public contract surface **stable**: `getRecommendations(input)`,
  `RecommendationCard`, `RecommendationInput`, `MAX_CARDS`. Only `RecommendationAction`
  grows (`'walk' | 'journal' | 'doctor'` added for PR 4).

---

## 2. Current file (verified)

`mobile/src/utils/expertRecommendations.ts` (192 lines):

- `RecommendationAction = 'water' | 'breathing' | 'days-stretch' | 'mark-done' | null`
- `RecommendationCard { id, icon, title, body, cta?, action? }`
- `RecommendationInput { phaseKey, painLevel, selectedSymptoms, severities? }`
- `MATRIX: Record<PhaseKey, ContentRow>` where `ContentRow` = `{ cramps, fatigue, bloating }`
- `getRecommendations()`: gates cramps to pain 4–6, aliases `Cramps/Lower Back Pain`,
  `Fatigue/Low Energy`, `Bloating`; caps at 3; order cramps→fatigue→bloating.
- Tests: `src/utils/__tests__/expertRecommendations.test.ts` (existing).
- Phase type: `PhaseRange['key']` from `src/utils/cyclePhases`.

---

## 3. New module design

### 3.1 Type changes (additive)

```ts
export type RecommendationAction =
  | 'water' | 'breathing' | 'days-stretch' | 'walk' | 'journal' | 'doctor'
  | 'mark-done' | null;

export type PhaseKey = PhaseRange['key'];   // menstrual | follicular | fertile | ovulation | luteal
```

`RecommendationCard` unchanged fields. `RecommendationInput.severities` already exists —
the engine will now actually **read** it for severity-sensitive gates (e.g. heavy bleeding
card only when severity ≥ 5).

### 3.2 Content shape

```ts
type SymptomKey = string; // canonical master name, e.g. 'Abdominal Cramps'

interface PhaseContent {
  [symptom: string]: Pick<RecommendationCard, 'title'|'body'|'cta'|'action'>;
}

const PHASE_MATRIX: Record<PhaseKey, PhaseContent> = { ... };      // phase-locked
const GENERAL_MATRIX: PhaseContent = { ... };                       // phase-agnostic falls through
const MOTIVATION_CARDS: Record<PhaseKey, RecommendationCard> = { ... }; // normal-day
const COMFORT_CARDS: Record<PhaseKey, RecommendationCard> = { ... };    // pain≥2 no-match
```

**Alias map** (existing behavior preserved, now formalized):

```ts
const ALIAS_MAP: Record<string, string> = {
  'Cramps': 'Abdominal Cramps',
  'Lower Back Pain': 'Abdominal Cramps',   // cramps-alias for content (existing test)
  'Low Energy': 'Fatigue',
};
```

> Note: `Lower Back Pain` is a **distinct master row** — it should NOT be remapped to
> cramps card in the new engine. Reconcile: the existing test `matches "lower back pain"
> as a cramps alias` will be **updated** this PR to assert back-pain → its own
> `pain`-family card (lower back card) instead. This is an intentional behavioral fix;
> flag in review.

### 3.3 Selection algorithm

```ts
export function getRecommendations(input: RecommendationInput): RecommendationCard[] {
  const { phaseKey, painLevel, selectedSymptoms, severities = {} } = input;

  // 1. Safety owns thresholds ≥7.
  if (painLevel >= 7) return [];

  // 2. Normal day → motivation (per brief Rule 2).
  const noSymptoms = selectedSymptoms.length === 0 && painLevel < 2;
  if (noSymptoms && phaseKey) return [MOTIVATION_CARDS[phaseKey]];

  const cards: RecommendationCard[] = [];
  const phaseBucket = PHASE_MATRIX[phaseKey] ?? {};
  const seen = new Set<string>();

  const push = (card: Pick<RecommendationCard,'title'|'body'|'cta'|'action'>, id: string, icon: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    cards.push({ id, icon, ...card });
  };

  for (const raw of selectedSymptoms) {
    const name = ALIAS_MAP[raw] ?? raw;
    const phaseRow = phaseBucket[name];
    const generalRow = GENERAL_MATRIX[name];
    const row = phaseRow ?? generalRow ?? null;
    if (!row) continue;
    // severity gating, e.g. heavy-bleeding needs severity ≥ 5 OR pain ≥ 4 band for cramps
    if (isSeverityGated(name, row, severities[name], painLevel)) continue;
    push(row, `${phaseKey}-${slug(name)}`, iconFor(name));
    if (cards.length >= MAX_CARDS) break;
  }

  // 3. Pain ≥ 2 but no symptom matched → gentle comfort card.
  if (cards.length === 0 && painLevel >= 2 && phaseKey) {
    push(COMFORT_CARDS[phaseKey], `${phaseKey}-comfort`, '💫');
  }

  return cards.slice(0, MAX_CARDS);
}
```

**Severity gating rules (frozen):**
- Cramps family card ⇒ only when `painLevel ∈ [4,6]` (existing behavior).
- `Heavy / Prolonged Bleeding` ⇒ only when `severities['Heavy / Prolonged Bleeding'] >= 5`.
- All others ⇒ unconditional (any logged severity 1/3/5).

### 3.4 Content source — data-only, split across files

Pull **all** copy/CTA/action from the tables provided earlier (Physical, Mental/Emotional,
Reproductive, Motivation, Comfort fallback). The matrix is large:
**~50 symptom rows × 5 phases ≈ 250 cards**. Implementation Note 1 is mandatory:

- **Data-only objects, zero logic** in the matrix. No conditionals, no imports of
  `useState`/navigation — just plain typed objects.
- **Split into per-category data files** so no single file exceeds ~500 lines:
  ```
  mobile/src/utils/recommendations/
    data/pain.ts            // pain × phases
    data/digestive.ts       // digestive × phases
    data/skin.ts            // skin × phases
    data/general.ts         // general × phases (phase-agnostic, re-exported)
    data/mood.ts            // mood × phases
    data/reproductive.ts    // reproductive × phases
    data/motivation.ts      // MOTIVATION_CARDS + COMFORT_CARDS per phase
    index.ts                // combine → PHASE_MATRIX / GENERAL_MATRIX (composition only)
  ```
  If a category file still exceeds ~500 lines, drop that category's rows into a
  **JSON lookup** (`data/pain.json`) imported with `resolveJsonModule` — see Note 1.
- Every card must satisfy the existing invariant: `body.length > 10`, `id` matches
  `/^[a-z-]+$/`, `icon` non-empty. Enforce with a data-validation unit test (§4).

**Stable id scheme:** `${phaseKey}-${slug}` where `slug = name → kebab-case`
(e.g. `luteal-mood-swings`, `general-headache`). Keep the legacy ids
(`menstrual-cramps`, `luteal-fatigue`, `luteal-bloating`) **name-compatible** so existing
persisted `recommendations_completed` strings stay valid where possible — map source
symptoms exactly as before (Cramps→cramps, Fatigue→fatigue, Bloating→bloating).

---

## 4. Tests (`__tests__/expertRecommendations.test.ts`)

Rewrite + extend:

- [ ] **Pain bands:** cramps card only at pain 4–6 (keep).
- [ ] **Normal-day motivation** returns exactly one phase-locked motivation card (all 5 phases).
- [ ] **Empty selected + pain ≥2** → comfort card for the phase.
- [ ] **Phase-locked symptom match** for at least one row in each of the 6 categories
  (pain/digestive/skin/general/mood/reproductive).
- [ ] **General fallback:** a symptom present in `GENERAL_MATRIX` but not in the phase bucket
  still returns a card.
- [ ] **Severity gate:** heavy-bleeding appears only when severity ≥ 5.
- [ ] **Dedupe:** the same symptom (via alias) doesn't duplicate a card.
- [ ] **Cap at MAX_CARDS** with >3 matching symptoms.
- [ ] **`Lower Back Pain`** no longer maps to the cramps card (behavior fix, updated).
- [ ] Every returned card: `id` kebab, `body.length > 10`, title/icon/cta present.
- [ ] Legacy ids preserved: `menstrual-cramps`, `luteal-fatigue`, `luteal-bloating`.

---

## 5. Files changed (summary)

| File | Change | Risk |
|---|---|---|
| `mobile/src/utils/expertRecommendations.ts` | Full rewrite (matrix + algorithm) | Medium — pure function, unit testable |
| `mobile/src/utils/__tests__/expertRecommendations.test.ts` | Rewrite + extend | Medium |

> No UI file changes in this PR. `DayDetailSheet` still calls `getRecommendations(...)`
> unchanged; new actions are inert until PR 4.

---

## 6. Mobile gates

```
cd mobile
npx tsc --noEmit
npx jest src/utils/__tests__/expertRecommendations.test.ts
```

---

## 7. AGENTS checklist (mobile)

- [ ] Pure function, no I/O, no React (unit-testable)
- [ ] No inline UI changes this PR
- [ ] `RecommendationAction` additive only (no breaking removal)
- [ ] Legacy card ids preserved where the source symptom is unchanged
- [ ] `MAX_CARDS = 3` retained; dedupe via stable ids
- [ ] Severity gating implemented (heavy-bleeding)
- [ ] tsc + jest green