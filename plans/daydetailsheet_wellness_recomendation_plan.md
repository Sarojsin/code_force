# DayDetailSheet → Wellness Recommendation: Verification Plan

> Purpose: a verifiable, implementation-ready plan for the end-to-end pipeline
> that turns a daily log (mood / pain / sleep / water / symptoms / notes) captured
> in the **DayDetailSheet** into a **wellness recommendation** surfaced on the
> Wellness tab — plus the **SVG path hardening** that makes one of those
> recommendation cards safe on Android.

Scope eras represented:
- **A. Write-through bridge** — already IMPLEMENTED (status below).
- **B. Recommendation pipeline** — implemented; review-only.
- **C. SVG crash hardening** — APPROVED, not yet implemented; covered here so you can verify the full diff before it lands.

---

## A. Write-Through Bridge (DayDetailSheet → mood_logs)

### Status: IMPLEMENTED ✅

White a day observation is saved in `DayDetailSheet.tsx`, the backend mirrors the
mood into `mood_logs` so the Wellness tab stays consistent:

| Layer | File | What it does |
|-------|------|--------------|
| Mobile save | `mobile/src/components/ui/DayDetailSheet.tsx` | `useUpsertDay()` PUTs `/api/v1/cycle/days/{log_date}` with mood, pain, sleep, water, symptoms, notes |
| Cycle service | `backend/app/modules/cycle/services.py` | `upsert_day()` emits `day_logged` event on the event bus |
| Wellness subscriber | `backend/app/modules/wellness/routes.py` | subscribes to `day_logged`, opens fresh session, calls `upsert_mood_for_date()` |
| Wellness upsert | `backend/app/modules/wellness/services.py` | `upsert_mood_for_date()` — idempotent, one mood log per user per date |

### Mobile gaps (status: verified in plan, apply on approval)

1. **P0 — Invalidate wellness caches after save.** `mobile/src/services/queries/cycle.ts` `useUpsertDay.onSuccess` must also invalidate `wellnessKeys.all` so Mood History / Insights refresh when the user switches to the Wellness tab.
2. **P1 — User-scope `wellnessKeys`.** `mobile/src/services/queries/wellness.ts` converts the static `wellnessKeys` to `getWellnessKeys(userId)` across all 7 hooks.
3. **P1 — Local SQLite merge in `useMoodLogs`.** Follows the proven `mergeJournalEntries` pattern.

---

## B. Recommendation Pipeline (history → health_tips)

### Status: IMPLEMENTED ✅ (no changes planned — review only)

- Backend `GET /api/v1/wellness/health-tips` reads from the `health_tips` table. Verified returning HTTP 200 with seeded rows after applying + seeding migration `2026_08_05_0507-eb292784c924` (DB at alembic head `eb292784c924`).
- Algorithm = **phase-based tip filtering + day-observation pattern aggregation** (no ML). Today's phase + current observations select/rank tips.
- `cycle_days` table confirmed present; day observation reads are sourced from it via `dayInsights.ts` on the client.
- **Recommended follow-up (NOT in scope now):** move wellness recomputation to a Celery background task (on `day_logged`) so API responses stay fast at scale.

Verification for B (review-only, run now to confirm green):
- [ ] `/api/v1/wellness/health-tips` returns 200 + array of tips
- [ ] `mood_logs` contains a row for a date that was logged with a mood via DayDetailSheet
- [ ] WellnessHomeScreen recommendation card reflects the current phase + recent observations

---

## C. SVG Crash Hardening (APPROVED — this is the delta to implement)

### Root cause (confirmed)
Native Android `react-native-svg` `PathParser` throws
`IllegalArgumentException: Unexpected character 'L'` when a `<Path d>` contains non-finite
coordinates (e.g. `LNaN,130 LNaN,130 Z`).

The crash came from `mobile/src/components/ui/wellness/MoodAreaChart.tsx`:

```ts
const stepX = plotW / (last7.length - 1);   // exactly 1 log → divide by zero → Infinity
const x = PADDING.left + i * stepX;          // 0 * Infinity → NaN
```

It surfaced via the WellnessHomeScreen recommendation/insight card (which renders
`MoodAreaChart`) right after the DayDetailSheet bridge populated the first mood log.

### Fix rationale
Two other builders (`MiniLineChart` in `AnalyticsDashboardScreen.tsx`,
`MoodTrendChart` in `MoodLogScreen.tsx`) currently rely on static data or parent
guards and share the same risky pattern. Centralize the safety so it can't regress in
any of the three.

### 1. Create `mobile/src/utils/svg.ts` (pure, testable)
```ts
export interface Point { x: number; y: number }

// len > 1 ? plotW / (len - 1) : 0   → never divide by zero
export function safeStep(plotW: number, len: number): number;

// null unless both coords are finite
export function sanitizePoint(p: Point): Point | null;

// 'M x,y L x,y …' from finite points; '' if fewer than 1 valid point
export function buildLinePath(points: Point[]): string;

// `${linePath} L${last},${baseline} L${first},${baseline} Z`; '' if !linePath
export function buildAreaPath(linePath: string, last: number, first: number, baselineH: number): string;

// quadratic bezier smoothing (moved from MoodAreaChart); guards <2 pts, filters NaN
export function buildSmoothPath(points: Point[]): string;
```

No theme / RN imports — pure functions (unit-test friendly).

### 2. Register in barrel
Add `export * from './svg';` to `mobile/src/utils/index.ts`.

### 3. Refactor `MoodAreaChart.tsx`
- Replace `stepX = plotW / (last7.length - 1)` → `safeStep(plotW, last7.length)`.
- Keep existing `Number.isFinite(intensity) ? intensity : 5` clamp on intensity.
- Replace inline `buildSmoothPath` (local fn) + `areaPath` construction with utility calls; delete the local copy.

### 4. Refactor `AnalyticsDashboardScreen.tsx` (`MiniLineChart`)
- `stepX` → `safeStep`; `linePath`/`areaPath` → `buildLinePath`/`buildAreaPath`.
- Keep existing `if (cycleData.length < 2) return null` guard (now doubly safe).

### 5. Refactor `MoodLogScreen.tsx` (`MoodTrendChart`)
- `stepX` → `safeStep`; `linePath`/`areaPath` → utilities.
- (Note, out of SVG scope: this component also uses inline styles/hardcoded colors that violate theme rules — record as a follow-up only.)

### 6. Add `mobile/src/utils/__tests__/svg.test.ts`
Mirror existing `__tests__/` conventions:
- `safeStep`: len 0 → 0, len 1 → 0, len 2+ → correct quotient.
- `buildLinePath`: empty → `''`; NaN/Infinity coords dropped; valid single point → `'M x,y'`.
- `buildAreaPath`: empty linePath → `''`; valid → closes to baseline.
- `buildSmoothPath`: <2 points → `''`; NaN filtered.

---

## D. Files Changed

| File | Change | Est. lines |
|------|--------|-----------|
| `mobile/src/utils/svg.ts` | NEW — safe path utilities | +60 |
| `mobile/src/utils/index.ts` | barrel export | +1 |
| `mobile/src/utils/__tests__/svg.test.ts` | NEW — unit tests | +60 |
| `mobile/src/components/ui/wellness/MoodAreaChart.tsx` | use utils; drop local `buildSmoothPath` | ~-15 |
| `mobile/src/screens/analytics/AnalyticsDashboardScreen.tsx` | `safeStep` + utils for MiniLineChart | ~-8 |
| `mobile/src/screens/wellness/MoodLogScreen.tsx` | `safeStep` + utils for MoodTrendChart | ~-6 |
| *(optional, from plan A)* `mobile/src/services/queries/cycle.ts` | invalidate `wellnessKeys.all` in `useUpsertDay` | +4 |
| *(optional, from plan A)* `mobile/src/services/queries/wellness.ts` | `getWellnessKeys(userId)` + `mergeMoodLogs` | ~+55 |

---

## E. Verification Checklist

### SVG hardening (C)
- [ ] `stepX` computed via `safeStep` in all 3 builders — no `(len - 1)` denominator remains
- [ ] Every dynamic `Path d` goes through `buildLinePath` / `buildAreaPath` / `buildSmoothPath`
- [ ] `buildLinePath`/`buildSmoothPath` return `''` for <2 points; `buildAreaPath` returns `''` if `!linePath`
- [ ] `npx tsc --noEmit` green
- [ ] `npm run test -- svg` green
- [ ] `npm run lint` clean on changed files
- [ ] Manual: log first mood via DayDetailSheet → open Wellness tab → MoodAreaChart renders (no crash)

### Bridge + recommendations (A/B)
- [ ] Save a day WITH mood → Wellness Insights count updates on tab switch
- [ ] Save a day WITHOUT mood → Wellness tab unchanged
- [ ] Multi-user isolation: User B cannot see User A cached wellness
- [ ] `/wellness/health-tips` 200 with tips; recommendation card matches phase

---

## F. Architecture (end-to-end)

```
DayDetailSheet (mobile)  →  useUpsertDay()
        │  PUT /api/v1/cycle/days/{log_date}
        ▼
CycleService.upsert_day()  (writes cycle_days)
        │  emit "day_logged"
        ▼
Wellness subscriber → upsert_mood_for_date()  (writes mood_logs, idempotent)
        │
        ▼
WellnessHomeScreen
   ├─ useMoodLogs()  → MoodAreaChart  [SVG-hardened — section C]
   ├─ GET /wellness/health-tips → recommendation cards
   └─ Insights dashboard
```

---

## G. Design Decisions

1. **Event bus, not direct service import** — cycle never imports `WellnessService`; the wellness module owns `mood_logs` and subscribes (`AGENTS.md` module-isolation rule).
2. **Idempotent per-date mood upsert** — re-saving the same day overwrites, never duplicates.
3. **Shared SVG utility** — a single source of truth for safe path construction; prevents NaN regressions in all future chart components (DRY + defensive programming).
4. **User-scoped query keys** — `getWellnessKeys(userId)` + `getCycleKeys(userId)` prevent cross-user cache leakage.
5. **Journal sentiment kept separate** — short `cycle_days.notes` do NOT trigger Celery sentiment; only the dedicated Journal screen does (avoids queue spam).
6. **Celery recomputation is out of scope now** — noted as the scalability follow-up for section B.

---

## H. Approval Gate

Run `npx tsc --noEmit`, `npm run test -- svg`, `npm run lint` on sections C change set before merging. Sections A/B are already implemented; verify via the checklists in this doc and mark the plan APPROVED when all boxes are green.