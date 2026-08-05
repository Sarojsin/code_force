# DayDetailSheet → Wellness Write-Through Bridge: Mobile Integration Plan

## Status: IMPLEMENTED ✅

---

## 1. Context

The DayDetailSheet writes daily observations (mood, pain, sleep, water, symptoms, notes) to the new `cycle_days` table. The Wellness tab reads from `mood_logs`. The **backend write-through bridge** is already fully implemented:

| Layer | File | What it does |
|-------|------|--------------|
| Cycle service | `backend/app/modules/cycle/services.py:1241-1249` | Emits `day_logged` event on the event bus when `upsert_day()` saves a mood |
| Wellness subscriber | `backend/app/modules/wellness/routes.py:241-263` | Subscribes to `day_logged`, opens a fresh DB session, calls `upsert_mood_for_date()` |
| Wellness upsert | `backend/app/modules/wellness/services.py:25-67` | `upsert_mood_for_date()` — idempotent per-date, one mood log per user per day |

**The mobile side has two gaps** that prevent the bridge from working end-to-end.

---

## 2. Gap Analysis

### Gap 1 (P0): Wellness caches not invalidated after DayDetailSheet save

**File:** `mobile/src/services/queries/cycle.ts` — `useUpsertDay()` (line 469-471)

**Current behavior:** On successful `upsertDay`, only `keys.days` is invalidated. The Wellness tab's mood history and insights caches remain stale until the user navigates away and back, or pulls to refresh.

**Impact:** User saves mood in DayDetailSheet → switches to Wellness tab → mood doesn't appear in Mood History or Insights dashboard.

### Gap 2 (P1): `wellnessKeys` not user-scoped

**File:** `mobile/src/services/queries/wellness.ts` (line 16-22)

**Current behavior:** `wellnessKeys` uses static keys like `['wellness', 'journal']`. Unlike `getCycleKeys(userId)` in `cycle.ts`, there is no user isolation.

**Impact:** In multi-account scenarios, cached data from User A could leak to User B.

### Gap 3 (P1): `useMoodLogs` doesn't merge local SQLite data

**File:** `mobile/src/services/queries/wellness.ts` (line 94-101)

**Current behavior:** `useMoodLogs` only fetches from the API. `useJournalEntries` (line 37-59) already merges server + local SQLite via `mergeJournalEntries()`. Mood logs written offline via the cycle-day bridge won't appear in the Wellness tab until the server responds.

**Impact:** Offline mood logs from DayDetailSheet are invisible in the Wellness tab until sync completes.

---

## 3. Implementation Plan

### Change 1 (P0): Invalidate wellness caches in `useUpsertDay`

**File:** `mobile/src/services/queries/cycle.ts`

**What to change:**

1. Add import for `getWellnessKeys` from `./wellness`
2. In `useUpsertDay`'s `onSuccess` handler, after the existing `qc.invalidateQueries({ queryKey: keys.days })` on line 471, add one invalidation call using `wellnessKeys.all`

**Optimization:** Instead of invalidating `moodLogs` and `insights` separately, invalidate `wellnessKeys.all`. Since insights depends on mood data, and there may be other wellness queries we haven't considered, invalidating the root key guarantees the entire Wellness tab refreshes holistically with a single cache invalidation call.

**Before:**
```typescript
onSuccess: (result) => {
  upsertCycleDay(result as unknown as Record<string, unknown>);
  qc.invalidateQueries({ queryKey: keys.days });
},
```

**After:**
```typescript
onSuccess: (result) => {
  upsertCycleDay(result as unknown as Record<string, unknown>);
  qc.invalidateQueries({ queryKey: keys.days });

  // BRIDGE: The backend wrote to mood_logs via day_logged event.
  // Invalidate ALL wellness caches so the entire tab refreshes holistically.
  const wellnessKeys = getWellnessKeys(userId);
  qc.invalidateQueries({ queryKey: wellnessKeys.all });
},
```

**Also:** The `onError` offline fallback (line 504-517) does NOT need changes — when the offline queue replays the `cycle/day` operation, the backend will emit `day_logged` and bridge the mood server-side. The next natural refetch of wellness data will pick it up.

**Lines changed:** ~4 lines added
**Risk:** Very low — cache invalidation only, triggers re-fetch from server

---

### Change 2 (P1): User-scope `wellnessKeys`

**File:** `mobile/src/services/queries/wellness.ts`

**What to change:**

1. Convert the exported `wellnessKeys` constant to a `getWellnessKeys(userId?)` function
2. Update all 11 internal references to use the new function with `userId` from `useAuthStore`
3. Update `useMoodLogs`, `useCreateMoodLog`, `useBreathingExercises`, `useCompleteBreathingSession`, `useInsights` to get `userId` from the auth store and use `getWellnessKeys(userId)`
4. Update the `useJournalEntries` hook (already has `userId`) to use the new function

**Before:**
```typescript
export const wellnessKeys = {
  all: ['wellness'] as const,
  journal: ['wellness', 'journal'] as const,
  moodLogs: ['wellness', 'moodLogs'] as const,
  breathing: ['wellness', 'breathing'] as const,
  insights: ['wellness', 'insights'] as const,
};
```

**After:**
```typescript
export function getWellnessKeys(userId?: string) {
  const id = userId ?? 'anonymous';
  return {
    all: ['wellness', id] as const,
    journal: ['wellness', id, 'journal'] as const,
    moodLogs: ['wellness', id, 'moodLogs'] as const,
    breathing: ['wellness', id, 'breathing'] as const,
    insights: ['wellness', id, 'insights'] as const,
  };
}
```

**Updated hook pattern (example for `useMoodLogs`):**
```typescript
export function useMoodLogs(params?: { page?: number; per_page?: number }) {
  const userId = useAuthStore((s) => s.user?.id);
  const keys = getWellnessKeys(userId);
  return useQuery({
    queryKey: [...keys.moodLogs, params],
    // ...
  });
}
```

**All hooks to update:**
- `useJournalEntries` (line 37) — already has `userId`, just change key reference
- `useCreateJournalEntry` (line 61) — add `userId`, use in `invalidateQueries` and `setQueryData`
- `useMoodLogs` (line 94) — add `userId`, use in query key
- `useCreateMoodLog` (line 103) — add `userId`, use in `invalidateQueries` and `setQueryData`
- `useBreathingExercises` (line 136) — add `userId`, use in query key
- `useCompleteBreathingSession` (line 143) — add `userId`, use in `invalidateQueries` and `setQueryData`
- `useInsights` (line 172) — add `userId`, use in query key

**Lines changed:** ~30 lines modified (mechanical find/replace)
**Risk:** Low — cache key change means old cached data is a cache miss on first load (forces fresh fetch, which is correct)

---

### Change 3 (P1): Add local merge for `useMoodLogs`

**File:** `mobile/src/services/queries/wellness.ts`

**What to change:**

1. Add import for `localDb` from `src/services/localDb`
2. Add a `mergeMoodLogs` helper function (following the `mergeJournalEntries` pattern)
3. Rewrite `useMoodLogs` queryFn to merge server + local SQLite data

**Signature verified:** `MoodLocalService.getByDateRange(userId: string, startDate: string, endDate: string): Promise<MoodLog[]>` — confirmed in `MoodLocalService.ts:22`.

**New helper:**
```typescript
function mergeMoodLogs(server: MoodLog[], local: MoodLog[]): MoodLog[] {
  const byId = new Map<string, MoodLog>();
  for (const l of local) byId.set(l.id, l);
  for (const s of server) byId.set(s.id, s);
  return [...byId.values()].sort(
    (a, b) => b.logged_at.localeCompare(a.logged_at),
  );
}
```

**Updated `useMoodLogs`:**
```typescript
export function useMoodLogs(params?: { page?: number; per_page?: number }) {
  const userId = useAuthStore((s) => s.user?.id);
  const keys = getWellnessKeys(userId);
  return useQuery({
    queryKey: [...keys.moodLogs, params],
    queryFn: async (): Promise<MoodLog[]> => {
      let server: MoodLog[] = [];
      try {
        server = await wellnessService.getMoodLogs(params?.per_page);
      } catch {
        server = [];
      }
      const local = userId
        ? (await localDb.mood.getByDateRange(
            userId,
            new Date(Date.now() - 30 * 86400000).toISOString(),
            new Date().toISOString(),
          )) as unknown as MoodLog[]
        : [];
      if (server.length > 0) {
        localDb.mood.upsertMany(server as any);
      }
      return mergeMoodLogs(server, local);
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
```

**Lines changed:** ~25 lines modified
**Risk:** Low — follows the exact pattern already proven in `useJournalEntries`

---

## 4. Files Changed Summary

| File | Change | Lines affected |
|------|--------|----------------|
| `mobile/src/services/queries/cycle.ts` | Add `getWellnessKeys` import + 1 `invalidateQueries({ queryKey: wellnessKeys.all })` call in `useUpsertDay.onSuccess` | ~4 lines added |
| `mobile/src/services/queries/wellness.ts` | Convert `wellnessKeys` → `getWellnessKeys(userId)`, add `mergeMoodLogs`, rewrite `useMoodLogs`, update all 7 hooks to use user-scoped keys | ~55 lines modified |
| `mobile/src/services/queries/__tests__\wellness.test.ts` | Update import from `wellnessKeys` to `getWellnessKeys`, adjust mock/setup | ~10 lines modified |

---

## 5. What is NOT Changed

| Item | Reason |
|------|--------|
| Backend `upsert_day()` | Already emits `day_logged` event — working correctly |
| Backend `upsert_mood_for_date()` | Already idempotent per-date — working correctly |
| Backend wellness subscriber | Already subscribes to `day_logged` — working correctly |
| `useUpsertDay` offline handler | Backend handles the bridge on replay — no mobile changes needed |
| Journal sentiment analysis | Kept separate per design (cycle_days.notes ≠ journal content) |
| `useCreateMoodLog` offline handler | Unaffected — this is the direct wellness mood path, not the bridge path |
| Pain / Sleep / Water data | Not surfaced in Wellness tab yet (future scope) |

---

## 6. Verification Checklist

### Manual Testing

- [ ] Save a day observation with mood via DayDetailSheet
- [ ] Navigate to Wellness tab → Insights dashboard shows updated mood count
- [ ] Navigate to Mood History → new entry appears
- [ ] Save a day observation WITHOUT mood → Wellness tab unchanged
- [ ] Put device in airplane mode → save day with mood → reconnect → mood appears in Wellness tab
- [ ] Log in as User A, save mood → log in as User B → User B does not see User A's mood

### Automated Testing

- [ ] Run `npx jest --testPathPattern=wellness` — all existing tests pass
- [ ] Run `npx jest --testPathPattern=cycle` — all existing tests pass
- [ ] Add test: `useUpsertDay` invalidates `wellnessKeys.all` on success
- [ ] Add test: `useMoodLogs` merges local + server data
- [ ] Run `npx tsc --noEmit` — no type errors

### Lint

- [ ] Run linter — no new warnings or errors

---

## 7. Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  DayDetailSheet (Mobile)                                │
│  User saves mood + pain + sleep + notes                  │
│         │                                               │
│         ▼                                               │
│  useUpsertDay()                                         │
│  ├─ PUT /api/v1/cycle/days/{log_date}                   │
│  ├─ Optimistic update: cycle_days cache                  │
│  └─ [P0] Invalidate wellnessKeys.all                    │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Backend: CycleService.upsert_day()                     │
│  ├─ Write to cycle_days table                           │
│  ├─ Emit "day_logged" event ───────────────────────┐    │
│  └─ Return day record                              │    │
└─────────────────────────────────────────────────────│────┘
                                                      │
                                                      ▼
┌─────────────────────────────────────────────────────────┐
│  Backend: Wellness subscriber (_on_day_logged)          │
│  ├─ Open fresh DB session                              │
│  └─ Call upsert_mood_for_date()                        │
│     └─ Upsert into mood_logs (idempotent per-date)     │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Mobile: Wellness Tab                                   │
│  ├─ useMoodLogs() → GET /wellness/mood/history          │
│  │   └─ [P1] Merges server + local SQLite               │
│  ├─ useInsights() → GET /wellness/insights              │
│  └─ Mood History screen + Insights dashboard refresh    │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Design Decisions

1. **Backend bridge via event bus (not direct service call):** The cycle module does NOT import `WellnessService` directly. Instead, it emits `day_logged` on the event bus. The wellness module (owner of `mood_logs`) subscribes and handles the write. This respects the module isolation rule — cycle never touches wellness tables.

2. **Idempotent per-date mood upsert:** `upsert_mood_for_date()` checks for an existing mood log on the same date and updates it rather than inserting a duplicate. Re-saving the same day overwrites the previous mood, which matches user expectation.

3. **Journal sentiment analysis kept separate:** `cycle_days.notes` are short check-ins ("feeling bloated"). They do NOT trigger Celery sentiment analysis. Only the dedicated Journal screen (with title + content + mood picker) triggers `analyze_journal_sentiment`. This avoids spamming the Celery queue with low-quality short text.

4. **Pain / Sleep / Water not in Wellness tab (yet):** These metrics live only in `cycle_days`. The Wellness tab currently only reads `mood_logs`. A future enhancement could extend `GET /wellness/insights` with an optional `scope=cycle` parameter to return a holistic view, but Phase 1 keeps it client-side via `dayInsights.ts`.

5. **User-scoped query keys:** Both `getCycleKeys(userId)` and `getWellnessKeys(userId)` scope all cached data by user ID. This prevents cross-user data leakage in multi-account scenarios and ensures cache invalidation is targeted.
