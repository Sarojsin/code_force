# Phase H — P1: Cache Warmth, SQLite Hydration & Navigation Consistency

> **Source audit:** `current_condition_ofapp/08_19_2026.md` §2.1, §2.2, §5.2, §5.3, PART 6 items #2(partial), #3, #5(hydration part)
> **Scope:** make visited screens paint instantly from the local SQLite layer (React Query stays in-memory — no plaintext persistence), convert `EditHealthScreen` to React Query, bound the diary list.
> **Gate:** `npm run typecheck && npm run lint && npm run test` must stay green.

---

## Already done (context — do not redo)
- `prefetchAppData()` runs at startup (`services/queries/prefetch.ts`, wired in `AppProvider.tsx:47`) covering cycle calendar(3,3), predictions, nurse content.
- Global query defaults: `staleTime 5min`, `gcTime 24h`, `networkMode: 'offlineFirst'` (`app/providers.tsx:27-29`).
- Lazy loading + `LazyScreen` singleton (Phase B.1) and `expo-image` (B.4) are complete.
- SQLite write batching (Phase D.1) and ETag/304 (D.3) are complete.

---

## H.1 `EditHealthScreen` → React Query (remove the `useEffect` fetch)

**File:** `screens/profile/EditHealthScreen.tsx:54-98`

Verified: fetch is `useEffect(() => { onboardingService.get() ... }, [])` into **local state** (`:71-75`), save is `onboardingService.updateLifestyle(...)` (`:98`). Not cached → reloads + spinner on every visit (audit §2.2).

**Changes:**
1. Replace the load with `useQuery` keyed `['onboarding','me']` (add a `getOnboardingKeys` to the onboarding queries module or reuse `pregnancyKeys.profile`-style namespace — check `services/queries/` for an existing onboarding/home key; create `onboardingKeys` if none), `staleTime: 5 * 60_000`, `queryFn: () => onboardingService.get()`.
2. Keep the save as a `useMutation` (`updateLifestyle`) with `onSuccess` → `queryClient.setQueryData` for the same key.
3. Loading → shared `ScreenSkeleton` (G.2) instead of the local spinner.

**Acceptance:** visiting EditHealth twice does not re-fetch; save updates the cached profile instantly.

---

## H.2 SQLite → React Query hydration (instant paint from the warm layer)

Goal (audit §2.1/§5.3): the SQLite layer is the permanent offline cache (`providers.tsx` comment). Give queries **`placeholderData` from localDb** reads so a visited screen paints from local data before the network resolution completes. Global `networkMode: 'offlineFirst'` already lets TL1 cached responses serve instantly — the missing piece is priming the cache for keys without a warm entry on cold start.

**Verified consumers to add `placeholderData`/`initialData` to:**

1. **Cycle calendar (`useCycleCalendar`)** — `services/queries/cycle.ts` (keys in `getCycleKeys`). On cold start the first Home paint waits on the network (audit §5.2). Read `DayLocalService`/`CycleLocalService` for the bounded 90-day window (Phase D added the default bound: `useCycleDays` falls back to `DEFAULT_DAYS_WINDOW_DAYS=90`, `DayLocalService.getByRange` has the same default) and expose it as `placeholderData` so the calendar grid renders day-statuses locally while the network fills phase ranges.
2. **Diary lists** — `DiaryLibraryScreen` / `DiaryScreen` / `DiaryTimelineScreen` (queries in `services/queries/diary.ts`). Add `placeholderData` from the local `DiaryLocalService`/`PageLocalService` read so the library paints instantly; network fill on top.
3. **Nurse content (`useContents`)** — `services/queries/nurse_content.ts:23`. `placeholderData` from the local content snapshot (if one exists — verify `nurseContentLocalService` or the bump from `getContents` write-through in `nurse_content.ts`; otherwise `keepPreviousData` only).
4. **Journal list** — `JournalListScreen` query; `placeholderData` from local journal rows (wellness write-through exists per Phase D).

**Notes:**
- Use `placeholderData` (type may not match server shape exactly, but rows are the same entities as local DB) — never `initialData` if the local shape can be stale/partial; pick the same key names so the cache entry is shared.
- Keep mutations/invalidation wiring unchanged; hydration must never double-persist.
- Do NOT add `React Query`-level SQLite write-through — the local DB is already written by services (`cycle.ts:531`, `wellness.ts:65,129`).

**Acceptance:** cold-start Home paints the calendar grid from SQLite instantly; diary/videos/journal screens show local data on first open with a silent network refresh.

---

## H.3 Journal entry — `placeholderData` from the cached list item

**File:** `screens/wellness/JournalEntryScreen.tsx:63-66`

**Changes:**
1. Add `placeholderData` that finds the already-cached entry from the journal **list** cache (`queryClient.getQueryData(wellnessKeys.journalList)`) and returns the matching item, so opening an entry from a visited list is instant.
2. Explicit `staleTime: 10 * 60_000` (G.1) on the single-entry query.
3. When placeholder is serving: label the editor "Loading draft…" → "Draft restored" once the server version lands (ties into G.4 skeleton).

**Acceptance:** opening an entry from the list shows the cached draft body immediately; no full round-trip gate.

---

## H.4 Bound the diary list (unpaginated full-list)

**File:** `services/queries/diary.ts` (list queries `useDiaryPages`, `useDiaryTimeline` etc.) — currently no `limit` (audit §2.1: "full list, unpaginated, no staleTime, no limit"). staleTime done in A.2; the missing piece is a bounded page size.

**Changes:**
1. Add a `limit` (e.g. `per_page: 50`) to the diary list query + service call; add cursor/offset support only if the backend supports it — verify the backend diary routes (if not, client-side slice + document in contract).
2. Update `plans/30-mobile-api-contract.md` with the diary list `per_page`/cursor semantics (project invariant §3.3: cursor for user-facing lists).
3. Keep search (`useDiarySearch`) debounced as-is.

**Acceptance:** diary responses are bounded; contract documents the params.

---

## H.5 `persistQueryClient` — architectural decision (document, don't revert)

**Context:** `providers.tsx:8` deliberately removed `persistQueryClient` ("SQLite replaces AsyncStorage as the permanent offline cache"). The audit's item #3 asks for persistence OR a warm equivalent. SQLite-as-initialData hydration (H.2) **is** the warm equivalent and is privacy-correct under AGENTS.md §3.8 (journal content / medical notes must not be plaintext at rest) and §2.13 (persistent local data encrypted; `react-native-encrypted-storage` is **not** installed).

**Decision (Phase H):**
- **Do NOT re-add `persistQueryClient`** to plain `AsyncStorage` — it would persist cached journal/diary/mood bodies in plaintext, violating §3.8. It requires an unowned native dep (`@tanstack/query-async-storage-persister` + storage adapter) for marginal gain on top of SQLite hydration.
- Optional (record as ADR if pursued): persist only **non-sensitive** keys (cycle calendar, nurse content, feature flags) via `persistQueryClient` filter (whitelist) + encrypted storage. Default: skip.
- Write ADR `backend/docs/adr/NNNN-sqlite-hydration-not-persistqueryclient.md` capturing this decision + the H.2 mechanism as the accepted design (AGENTS.md §4 "write an ADR if plans are silent").

**Acceptance:** ADR written; no plaintext query-cache persistence is introduced.

---

## Verification for Phase H
1. `npm run typecheck && npm run lint && npm run test`.
2. `rg "persistQueryClient" src` → only the ADR/comment (no re-add).
3. Manual: cold start on device → Home calendar paints from SQLite before network resolves; open Diary/Videos/Journal (local data first); open an entry from the list (cached draft, then server refresh label); EditHealth re-visit → no spinner.
4. `npx expo export --platform android` still bundles (no new native deps added).

## Files touched (Phase H)
- `screens/profile/EditHealthScreen.tsx` (+ onboarding queries key in `services/queries/`)
- `services/queries/cycle.ts` (calendar `placeholderData`)
- `services/queries/diary.ts` (list bounds + hydration; contract §diary)
- `services/queries/nurse_content.ts` (content `placeholderData`/list-key warm)
- `screens/wellness/JournalListScreen.tsx`, `screens/wellness/JournalEntryScreen.tsx`
- `plans/30-mobile-api-contract.md`
- `backend/docs/adr/NNNN-sqlite-hydration-not-persistqueryclient.md` (new)