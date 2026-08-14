# DayDetailSheet → VideoLibraryScreen Smart Recommendation Plan

Transform the outdated `VideoLibraryScreen` into a **"Smart Health Library"**: a
symptom-driven content recommendation screen that surfaces educational videos
based on the user's recently logged cycle symptoms — matching the DayDetailSheet
aesthetic and the existing `expertRecommendations` engine.

**Date:** 2026-08-14
**Status:** Pending approval
**Related plans:** `13-nurse-content.md`, `Mobile_Admin+Nurse_Content_Cleanup_plan.md`,
`Full _Symptom-Driven_Recommendation_Engine_for_DayDetailSheet+Wellness_plan3.md`

---

## 1. Objective

- Refresh the `VideoLibraryScreen` UI (modern, matches DayDetailSheet aesthetic).
- Introduce a **"For You"** toggle that, when active, prioritizes videos directly
  related to the user's recently logged symptoms (from `cycle_days`).
- Surface the right content at the right moment: a user logging
  `["Abdominal Cramps", "Headache"]` should see cramps/headache content, not
  generic "Hairfall" videos.
- Add a **global Settings master switch** (Content & Personalization) that
  enables/disables the "For You" feature app-wide.
- Follow the **"No Data, No Issue"** rule: no symptoms logged → friendly info
  banner + full general library, never an empty state.

## 2. Architecture Decision: Option A (client-side scoring, no backend)

> **Reality check — do NOT rely on local content cache.**
>
> The original proposal assumed "educational_contents cached locally in SQLite
> (`nurse_contents` table) via the existing sync". This is **NOT implemented**:
>
> - `nurse_contents` table exists (`src/db/schema.ts:309`) but is **never written** —
>   no local service touches it.
> - The sync engine (`src/services/sync/syncHydrate.ts`) has **no `nurse_content`
>   entity type** — it hydrates cycle/journal/mood/safety/pregnancy but not content.
> - `VideoLibraryScreen` is **network-only**: `useContents()` → `GET /contents` →
>   React Query cache.
>
> Building true offline content caching = new sync entity + local service +
> migration + backend changelog = **out of scope for this plan**.

**Chosen approach (Option A):**

| Data | Source | Layer |
|------|--------|-------|
| Content list | `useContents()` → `GET /contents` (existing) | Network (React Query) |
| Last-7-days symptoms | `localDb.cycleDay.getByRange()` (existing) | **Local SQLite (offline-first)** |
| Scoring engine | New pure utility | Client-side |

The recommendation *logic* is fully offline/testable; only the content list needs
network (unchanged from today). Scoring runs client-side, so it is instant and
requires zero backend changes.

## 3. Symptom data model (verified)

- `cycle_days.symptoms` is a JSON array `[{ name: string; severity: number }]`
  (`src/db/schema.ts:593`), `name` = **canonical display name** from
  `src/assets/masters/symptoms.json` (57 entries, e.g. `"Abdominal Cramps"`).
- Read path: `localDb.cycleDay.getByRange(userId, start, end)`
  (`src/services/localDb/DayLocalService.ts:68`).
  > **Sanity check #1 (verify during implementation):** the exact method name is
  > NOT confirmed — it may be `getByDateRange` or `listByDateRange`. Confirm the
  > real method signature in `DayLocalService.ts` and adjust the hook to match.
- Precedent alias map: `expertRecommendations.ts:27`
  (`Cramps → Abdominal Cramps`, `Low Energy → Fatigue`).
  > **Sanity check #2 (verify during implementation):** `videoRecommendations.ts`
  > must **import and reuse this same alias map** (not re-declare it) to keep
  > symptom-name resolution consistent across the app.

## 4. Files

| # | File | Action | Change |
|---|------|--------|--------|
| 1 | `mobile/src/utils/videoRecommendations.ts` | **NEW** | Pure scoring engine: symptom names → keywords → content score → `{ recommended, general }`. |
| 2 | `mobile/src/hooks/useVideoRecommendations.ts` | **NEW** | Reads last-7-days symptoms from localDb, pulls content via `useContents()`, runs the engine, re-runs on `day_logged`. |
| 3 | `mobile/src/hooks/useVideoLibrarySettings.ts` | **NEW** | Reads/writes the global "For You" master toggle from AsyncStorage. |
| 4 | `mobile/src/screens/wellness/VideoLibraryScreen.tsx` | MODIFY | UI overhaul: "For You" toggle pill (hidden when master switch OFF), "No Data, No Issue" fallback, dual-section layout when ON, refined skeleton, category chips retained. |
| 5 | `mobile/src/screens/profile/SettingsScreen.tsx` | MODIFY | Add **Content & Personalization** section with the "Smart recommendations" master switch. |
| 6 | `mobile/src/utils/__tests__/videoRecommendations.test.ts` | **NEW** | Unit tests for the scoring engine + the `hasData` / empty-symptom path. |
| 7 | `web-admin/src/pages/ContentLibrary.tsx` | MODIFY | Add keyword hint under Description field. *(Nice-to-have, may be separate PR.)* |

## 5. New file: `src/utils/videoRecommendations.ts` (pure engine)

```
SYMPTOM_KEYWORDS: Record<string, string[]>   // canonical name -> search keywords
  "Abdominal Cramps"  -> ["cramps","abdominal","period pain","menstrual"]
  "Lower Back Pain"   -> ["back pain","lumbar","spine"]
  "Headache"          -> ["headache","head pain","migraine"]
  ... curated subset ONLY (v1)

getKeywordsForSymptom(name): string[]         // curated map, else fallback word-split
  fallback: lowercase name split into words, remove generic stopwords
  ("Lower Back Pain" -> ["lower","back","pain"] — curated map preferred)

scoreContent(content, keywords): number        // case-insensitive substring match
  simple hit COUNT across title + description + tags + category
  (v1: NO weighting — no title>description, no video>article)

recommendContents(contents, symptomNames, opts?):
  -> { recommended: NurseContent[], general: NurseContent[] }
  recommended: score > 0, sorted by score desc, ties by published_at desc
  general: score === 0, sorted by published_at desc
```

> **Implementation notes (from review):**
> - **Sanity check #3 — keep SYMPTOM_KEYWORDS small.** No need to curate all 57
>   canonical symptoms up front. The fallback word-split covers missing entries.
>   Start with the most common ones: Cramps, Back Pain, Headache, Fatigue,
>   Bloating, Mood-related (Anxiety, Low Mood), Nausea, Insomnia. Expand over time
>   as new symptoms get logged. Keep the object at the top of
>   `videoRecommendations.ts` as a pure data object (or a separate JSON file) —
>   **mirroring the alias-map style of `expertRecommendations.ts`.**
> - **Sanity check #4 — scoring is a simple hit count for v1.** Case-insensitive
>   substring match across title + description + tags + category. Should a
>   `title`/`description`/tag encode match count, add 1 per hit. No weighting.
>   (Optional weighting: title hit > description hit, video/image > article — DEFER.)

- **Framework-free** (no RN imports) → unit-testable, mirrors
  `expertRecommendations.ts` (pure, engine-only, no UI).
- Respects the existing alias map so legacy names resolve to canonical ones.

## 6. New file: `src/hooks/useVideoRecommendations.ts`

Follows the `useTodayRecommendation` pattern (`src/hooks/useTodayRecommendation.ts`):

- `userId` from `useAuthStore`.
- **Master-switch gate:** if `useVideoLibrarySettings()` says recommendations are
  globally OFF, skip symptom reads and return plain `general` (identical to OFF
  mode) — no symptom data is touched.
- Fetch last-7-days symptoms:
  `localDb.cycleDay.getByRange(userId, format(addDays(today, -6), 'yyyy-MM-dd'), today)`
  → unique `symptoms[].name`. *(Confirm exact method name — see §3 sanity check #1.)*
- Content via `useContents({ limit: 100 })`.
- Re-read symptoms on `eventBus.on('day_logged', ...)` (cycle module already emits
  it after `upsertCycleDay`) so opening the library right after logging a symptom
  shows fresh recommendations.
- Returns `{ recommended, general, matchedSymptoms, hasData, isLoading }`
  where `hasData = matchedSymptoms.length > 0`.

**"No Data, No Issue" rule (from review):**
```
// 1. fetch last-7-days symptoms
symptoms = await getSymptomsLast7Days(userId)

// 2. no symptoms?
if (symptoms.length === 0) {
  return {
    recommended: [],        // empty
    general: allVideos,     // all videos, newest first
    matchedSymptoms: [],
    hasData: false,         // -> screen shows "No recent symptoms logged" banner
    isLoading: false,
  }
}

// 3. symptoms found?
const { recommended, general } = scoreContents(allVideos, symptoms)
return { recommended, general, matchedSymptoms: symptoms, hasData: true, isLoading: false }
```

- Errors → `{ recommended: [], general: [], matchedSymptoms: [], hasData: false, isLoading: false }`
  (never throws).

## 7. Modify: `src/screens/wellness/VideoLibraryScreen.tsx`

### 7.1 Header (matches DayDetailSheet aesthetic)

- "Health Library" title + subtitle.
- **For You toggle** — pill switch beside the title (lucide `Sparkles` icon;
  ON state = `theme.colors.primaryDeep` background + check). Uses `Switch`-style
  accessibility (`accessibilityRole="switch"`, `accessibilityState={{ checked }}`).
- When toggle ON and `matchedSymptoms.length > 0`, render an info banner:
  `"Based on your recent symptoms (Cramps, Back Pain, Fatigue)"` — symptom chips
  from `expertRecommendations.ts`'s `ICON_BY_SYMPTOM` for the matching icons.

### 7.2 Mode OFF (default — behaviour unchanged)

- Category chips (kept: `all, wellness, pregnancy, cycle, nutrition, mental_health`).
- Single FlatList of all content, server-side category filter (unchanged).

### 7.3 Mode ON ("For You")

- **Section 1** — "Based on your recent symptoms" → the `recommended` array.
  Horizontal-snap carousel mirroring `RecommendationCarousel` (card width ~280,
  thumbnail + title + matched-symptom chip). Category chips hidden while ON.
  > **Sanity check #5 (verify during implementation):** if
  > `RecommendationCarousel` is tightly coupled to recommendation cards, extract
  > a generic `HorizontalCardCarousel` component and reuse it for both.
- **Section 2** — "Browse all videos" → the `general` remainder as a FlatList,
  or `EmptyState` if everything matched.
- Tap → `ContentDetail` (existing navigation, unchanged).

### 7.4 "No Data, No Issue" — toggle ON but no symptoms (`hasData === false`)

| Scenario | Toggle state | What the user sees | Why |
|----------|--------------|--------------------|-----|
| No symptoms | OFF (default) | Standard general library, all videos newest-first | Default state, nothing changes |
| No symptoms | **ON** | "For You" section shows an info banner **"No recent symptoms logged. Explore our full library."** under the toggle; general library renders below (identical to OFF). Toggle stays ON. | No empty states, no sad face; library always populated |

- **No empty states:** the library is always populated — when `hasData === false`
  we render the *general* list, never a blank screen.
- **Toggle always available:** even if it does nothing today, it sets the
  expectation that logging symptoms unlocks personalized content.
- **Gentle encouragement (bonus CTA, recommended):** below the info banner add
  a CTA button — `"📝 Log Today's Symptoms"` with the message
  `"Start logging to get personalized recommendations."` — deep-links to the
  Calendar screen (opens today's DayDetailSheet), turning the empty state into a
  conversion opportunity.

### 7.5 Loading / empty / error states (retained)

- Skeleton cards on initial load (existing).
- `EmptyState` on error with Retry (existing).
- Toggle default OFF (no surprise for existing users).

## 8. Global master switch: `src/hooks/useVideoLibrarySettings.ts` + Settings

### 8.1 Behavior (master switch)

| Setting | `VideoLibraryScreen` "For You" toggle | Behavior |
|---------|----------------------------------------|----------|
| **ON** (default) | Visible & functional | Toggle appears; ON shows recommendations, OFF shows general library |
| **OFF** | **Hidden entirely** | Only general library. No symptom reads, no recommendations |

- Default: **ON** (new feature discoverable by default).
- Persisted in **plain AsyncStorage** (non-sensitive preference; does NOT require
  encrypted storage — no PII involved).
- `useVideoLibrarySettings()` returns `{ smartRecommendationsEnabled, setSmartRecommendationsEnabled }`.

### 8.2 Settings location

Add under **Settings → Content & Personalization** (new or existing section) in
`src/screens/profile/SettingsScreen.tsx`:
- Label: **"Smart recommendations"**
- Subtext: *"Show personalized videos based on your logged symptoms."*
- `Switch` bound to `smartRecommendationsEnabled`.

## 9. Tests: `src/utils/__tests__/videoRecommendations.test.ts`

| Case | Expectation |
|------|-------------|
| Title keyword hit | content scored & promoted to `recommended` |
| Description keyword hit | same (case-insensitive, substring) |
| Tag keyword hit | same |
| Synonym map (`Abdominal Cramps` → `cramps`) | matched via `SYMPTOM_KEYWORDS` |
| Empty symptoms | `{ recommended: [], general: all, hasData: false }` |
| Zero content list | `{ recommended: [], general: [] }` |
| Tie on score | broken by `published_at` desc |
| Legacy alias (`Cramps`) | resolves to canonical `Abdominal Cramps` |
| Curated map absent for a symptom | fallback word-split still yields keywords |

*(Test dir `src/utils/__tests__/` — confirm convention during implementation;
fall back to `src/hooks/__tests__/`.)*

## 10. Admin side (nice-to-have, separate PR)

`web-admin/src/pages/ContentLibrary.tsx` — add hint under the Description field:
> "For better recommendations, include symptom keywords (cramps, back pain, bloating)
> in your description."

## 11. Out of scope / deferred

- Local content caching in SQLite (`nurse_contents` write path, sync entity,
  migration, backend changelog). → future "true offline-first" plan.
- Backend search index for 500+ videos.
- "Continue Watching" / offline-state UI from `UI_UX/Video_Section.md` (still unimplemented).
- Scoring weighting (title>description, video>article) — deferred beyond v1.

## 12. Acceptance criteria

- [ ] Toggle renders, defaults OFF, accessible (`switch` role).
- [ ] Toggle ON shows `recommended` section (score > 0) + `general` section.
- [ ] Toggle ON with no symptoms → "No recent symptoms logged" banner + full general list, **no empty flash** (`hasData === false` path).
- [ ] Optional CTA "Log Today's Symptoms" deep-links to today's DayDetailSheet.
- [ ] Logging a symptom (`day_logged`) then opening library updates "For You".
- [ ] **Master switch OFF in Settings hides the "For You" toggle entirely**; general library only. Default ON.
- [ ] Scoring engine unit tests pass (incl. `hasData`, fallback word-split); existing backend + mobile tests still green.
- [ ] Category chips + skeleton + error/empty states retained.
- [ ] Sanity checks #1–#5 verified and reflected in the implementation.
