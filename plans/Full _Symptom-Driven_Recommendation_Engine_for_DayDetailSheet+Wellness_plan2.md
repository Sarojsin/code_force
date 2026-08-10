# Full Symptom-Driven Recommendation Engine — PR 2 (Mobile Taxonomy + Catalog)

> Status: **Draft for review** — verify before any code.
> Parent plan: `Full_Symptom-Driven_Recommendation_Engine_for_DayDetailSheet+Wellness_plan0.md`.
> Depends on: PR 1 (backend master). Must land such that the PR-1 parity test (plan1 §6)
> passes un-guarded.

---

## 1. Objective

Mirror the PR-1 backend taxonomy into the mobile offline bundle
(`src/assets/masters/symptoms.json`) and make the UI render the two new categories
(`mood`, `reproductive`) alongside the existing four — without touching the phase model
or any recommendation logic yet (that's PR 3/5).

---

## 2. Current state (verified)

| Item | Path | Detail |
|---|---|---|
| Mobile bundle | `mobile/src/assets/masters/symptoms.json` | 30 rows; `id/name/category/icon/icon_kind/display_order` |
| Accordion categories | `mobile/src/components/ui/dayDetail/SymptomAccordion.tsx` | `CATEGORIES = ['pain','digestive','skin','general']` hardcoded + `CATEGORY_LABELS` |
| Icon dispatcher | `mobile/src/components/ui/symptomIcons/SymptomIcon.tsx` | `<name>` → custom SVG → Lucide token → emoji fallback |
| Custom SVGs | `mobile/src/components/ui/symptomIcons/CustomSymptomIcons.tsx` | ~13 hero glyphs |
| Master queries | `mobile/src/services/queries/cycle.ts` `useSymptoms()` | offline-first read from local SQLite (`DayMasterLocalService`), seeded from the JSON |
| Local seed | `mobile/src/services/localDb/DayMasterLocalService.ts` | `ensureSeeded()` imports `symptoms.json` via dynamic `import('../../assets/masters/symptoms.json')` |
| DB schema | `mobile/src/db/schema.ts` `symptoms` table | `id (pk)`, `name (unique)`, `category`, `icon`, `display_order`; migration `0000` + `0011` (`icon_kind`) |

---

## 3. Changes

### 3.1 `mobile/src/assets/masters/symptoms.json` — rebuild to 57 rows

Must equal `backend/app/modules/cycle/seed.py` `SYMPTOM_SEED` **by `name`**, and match
category + `display_order` **exactly** (parity test in plan1 §6 asserts set-equality at a
minimum, single-pass iteration order at best).

- Keep **all 30 existing `id`s** unchanged (`abdominal-cramps`, `headache`, …). This keeps
  `day_symptoms` FK resolution and any cached local master stable.
- **Add 27 new rows** (3 skin + 5 general + 11 mood + 8 reproductive) per plan1 §3:
  - skin: `hair-thinning`, `hirsutism`, `dry-skin`
  - general: `night-sweats`, `palpitations`, `unwell`, `uti`, `vision-changes`
  - mood: `mood-swings`, `irritability`, `anxiety`, `depressed-mood`, `tearfulness`,
    `brain-fog`, `concentration`, `overwhelmed`, `withdrawal`, `low-libido`,
    `severe-depression`
  - reproductive: `heavy-bleeding`, `irregular-cycle`, `spotting`, `absent-period`,
    `painful-ovulation`, `pms`, `pmdd`, `painful-urination`
- `icon` + `icon_kind`: reuse existing Lucide-compatible emoji where analogous, else a
  sensible fallback that resolves through `SymptomIcon` (Lucide token or emoji). Frozen
  list below (icons **approved** — "use icons ok").

**Icon/kind list (approved):**

| name | icon | icon_kind |
|---|---|---|
| Hair Thinning / Loss | 🪮 | lucide |
| Excess Facial / Body Hair | 🌿 | lucide |
| Dry / Itchy Skin | 🧴 | lucide |
| Night Sweats | 🌙 | lucide |
| Heart Palpitations | 💓 | lucide |
| Feeling Unwell / Weakness | 🥺 | custom |
| Frequent Urination / UTIs | 🚽 | lucide |
| Vision Changes | 👁️ | lucide |
| Mood Swings | 🎢 | lucide |
| Irritability | 😤 | custom |
| Anxiety / Nervousness | 😰 | custom |
| Depressed Mood / Sadness | 😔 | custom |
| Tearfulness / Crying Spells | 😢 | custom |
| Brain Fog | 🌫️ | lucide |
| Difficulty Concentrating | 🎯 | lucide |
| Feeling Overwhelmed | 🌊 | lucide |
| Social Withdrawal | 🐢 | lucide |
| Reduced Libido | 🦋 | lucide |
| Severe Depression / Self-Harm | 🆘 | lucide |
| Heavy / Prolonged Bleeding | 🩸 | custom |
| Irregular Cycles | 🔄 | lucide |
| Bleeding / Spotting Between Periods | 🩹 | lucide |
| Absent Period / Amenorrhea | ⭕ | lucide |
| Painful Ovulation | 📌 | lucide |
| PMS Symptoms | 🌩️ | lucide |
| PMDD (Severe PMS) | ⛈️ | lucide |
| Painful Urination | 🔥 | lucide |

> Custom SVG additions are **optional** — the dispatcher falls through to emoji. Frozen
> `CustomSymptomIcons` glyphs are scope-creep; prefer emoji/Lucide for new rows.

### 3.2 `SymptomAccordion.tsx` — add categories

```ts
const CATEGORIES = ['pain', 'digestive', 'skin', 'general', 'mood', 'reproductive'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  pain: 'Pain',
  digestive: 'Digestive',
  skin: 'Skin & Hair',
  general: 'General',
  mood: 'Mood & Mind',
  reproductive: 'Cycle & Hormones',
};
```

- No other component logic changes. Empty categories render nothing already (guard exists).

### 3.3 Local SQLite + seed

- **No schema change** — `symptoms` table already has `name/category/icon/display_order`
  (+ `icon_kind` in migration `0011`, which appears to already be in `schema.ts`).
  The new rows flow through `DayMasterLocalService.ensureSeeded()` automatically because
  it reads the whole JSON.
- **Verify** `schema.ts` actually lists `icon_kind`; if the column is missing, one small
  additive migration `0012_add_symptom_icon_kind` (already applied per `meta/_journal.json`
  showing tag `0011_add_symptom_icon_kind` — confirm current head) may be needed. **No new
  migration expected.**

### 3.4 Parity read test (mobile side, optional but cheap)

`mobile/src/services/localDb/__tests__/` — add a test reading `symptoms.json` and asserting:
no duplicate `id`, no duplicate `name`, every row has non-empty `category` in the 6 allowed
values, `display_order >= 1` per category.

---

## 4. Files changed (summary)

| File | Change | Risk |
|---|---|---|
| `mobile/src/assets/masters/symptoms.json` | Rebuild to 57 rows (mirror PR 1) | Low |
| `mobile/src/components/ui/dayDetail/SymptomAccordion.tsx` | +2 categories + labels | Low |
| `mobile/src/db/schema.ts` | Verify `icon_kind` present (else additive migration) | Low |
| `mobile/src/services/localDb/__tests__/` | New master-shape test (optional) | Low |

---

## 5. Mobile gates

```
cd mobile
npx tsc --noEmit
npx jest src/services/localDb/__tests__ src/components/ui/__tests__/symptomIcons.test.tsx
npx eslint src/components/ui/dayDetail/SymptomAccordion.tsx src/assets/masters/symptoms.json
```

---

## 6. AGENTS checklist (mobile)

- [ ] `symptoms.json` matches backend seed by name/category/order (parity test in PR 1 passes un-guarded)
- [ ] Existing 30 slugs/names/UUIDs untouched (no local-DB FK breakage)
- [ ] `SymptomAccordion` categories list updated; labels added
- [ ] Touch-target / a11y unchanged (no new interactive elements this PR)
- [ ] `tsc`, `jest`, eslint green
- [ ] Master parity test (backend seed ⇔ mobile bundle) green — coordinated with PR 1 §6