# Phase D — P1: Data Layer, DB Batching & Network Over-Fetch

> **Source audit:** `current_condition_ofapp/08_017_2026.md` §5.1, §5.2, §9.1
> **Scope:** SQLite write batching/transactions, over-fetching reduction, ETag/304, backend `months_back` bug.
> **Gate:** `npm run typecheck && npm run lint && npm run test` + backend pytest for the touched module.

---

## D.1 SQLite write batching (transactions)

### D.1.1 `BaseLocalService.upsertMany` — N sequential statements, no batch

**File:** `mobile/src/services/localDb/BaseLocalService.ts:38-56` (verified)
- Loops N `INSERT ... ON CONFLICT DO UPDATE` statements sequentially, each an autocommit.
- Used by `backfillSqlite.ts:25-32` (8 entity types at startup), `cycle.ts:534` (day upserts), `wellness.ts:65,129` (journal/mood upserts), `DayLocalService`/`MoodLocalService` reads.
- **Fix:** batch with a single multi-row `INSERT ... ON CONFLICT DO UPDATE` (drizzle `values(records.map(...))` on a proxy `run`) OR wrap the loop in one transaction.
  - Constraint: `drizzle-orm/sqlite-proxy` — the `AsyncRemoteCallback` (`db/connection.ts:39-65`) forwards `method: 'run'`/`'get'`/`'all'` to the native DB via `runExclusive`. Verify whether a drizzle `db.transaction(cb)` on a proxy sends real `BEGIN`/`COMMIT` through the callback (audit claims the 3 existing `db.transaction` call sites — `DayMasterLocalService.ts:65`, `FeatureFlagLocalService.ts:54`, `runMigrations.ts:51` — hit a proxy that is a **no-op** for begin/commit).
  - **Plan:** add an explicit `withTransaction(fn)` helper in `db/connection.ts` that, inside one `runExclusive`, executes `BEGIN IMMEDIATE` → fn → `COMMIT` (with `ROLLBACK` on error) using `getNativeDb().execAsync`. Use it from `BaseLocalService.upsertMany`, `DayMasterLocalService.replaceAll`, `FeatureFlagLocalService.replaceAll`, and `runMigrations` (or convert those to it).
  - Fallback if multi-row drizzle insert is awkward with the proxy: keep per-row inserts but wrap them in `withTransaction` so they share one commit (still WAL-serialized, single fsync instead of N).

### D.1.2 `DayMasterLocalService.replaceAll` (`:59-96`)
- Deletes all symptoms+medications then inserts in a loop; wrap in `withTransaction` (it already calls `db.transaction` — re-point to the real helper).

### D.1.3 `DayLocalService` / `MoodLocalService` / other bulk paths
- Grep for other loops of `upsert`/`upsertMany` and batch them the same way. Keep `getByRange` reads unchanged.

**Files touched:** `db/connection.ts` (add `withTransaction`), `services/localDb/BaseLocalService.ts`, `services/localDb/DayMasterLocalService.ts`, `services/localDb/FeatureFlagLocalService.ts`, `db/runMigrations.ts` (re-point to real transaction).

**Risks:** do **not** hold a transaction across an `await` on another DB call that could deadlock the `runExclusive` queue. Keep `withTransaction` purely internal to one queue turn.

**Acceptance:** startup backfill issues ~1 write txn instead of N; no `SQLITE_BUSY` regressions (keep `busy_timeout=5000`).

---

## D.2 Over-fetching trim

### D.2.1 Analytics — 12 months / 50 entries
**File:** `mobile/src/screens/analytics/AnalyticsDashboardScreen.tsx:454` (verified)
- `useCycleEntries({ limit: 50, months_back: 12 })` but renders only the latest 6 (`:690`).
- **Fix:** `{ limit: 24, months_back: 6 }` (6 months ≈ 6 cycles ≈ enough for cycle-length std dev) — keep `limit` ≥ number of completed cycles needed by `computeCycleLengthStats` (needs ≥2; 6 months gives ~6). Update the chart labels accordingly.

### D.2.2 Calendar — 6 months, no limit
**File:** `mobile/src/screens/calendar/CalendarScreen.tsx:110` (verified)
- `useCycleEntries({ months_back: 6 })` — full history per month, no `limit`.
- **Fix:** add `limit: 60` and confirm the backend honors `limit` (see D.4 backend change). Only needed for `coveringEntry` lookups (period spanning the selected date) — a 6-month window is more than enough.

### D.2.3 Unify overlapping `useCycleEntries` cache keys
Three cache entries over overlapping data (verified):
- `CalendarScreen` `{months_back:6}` — `cycle.ts:78` key `[...entries, params]` → separate cache entry.
- `CycleHistoryScreen` `{limit:50}` (in `CycleHistoryScreen.tsx:42`).
- `useCatchUp` `{limit:1}` (`useCatchUp.ts:33`).
- **Fix:** don't merge the hooks (they intentionally differ), but add a shared constant for the base params and ensure each key includes its params so the cache is bounded. Optionally have Analytics reuse the Calendar entry by using the same `{months_back: 6, limit: 60}` param set so the cache hits. Document the keys in `getCycleKeys`.

### D.2.4 Bound `useCycleDays` reads
**File:** `mobile/src/services/queries/cycle.ts:519-544` (verified)
- `useCycleDays(undefined)` on mount reads ALL local day rows (`DayLocalService.getByRange(userId, undefined, undefined)`).
- **Fix:** when `range` is undefined, pass a bounded default `{ start: today-90d, end: today }` OR make `getByRange` require a range. CalendarScreen already passes a 1-day window when a date is selected — remove the always-on mount fetch (see Phase C.2). DailyLogScreen passes a month range already.

**Files touched:** `screens/analytics/AnalyticsDashboardScreen.tsx`, `screens/calendar/CalendarScreen.tsx`, `services/queries/cycle.ts`, `services/localDb/DayLocalService.ts` (require range or default bound), `screens/cycle/CycleHistoryScreen.tsx` (param constant).

---

## D.3 ETag / 304 revalidation (client)

**Files:** `mobile/src/services/api/client.ts`, `mobile/src/services/api/cycle.ts`

Findings (verified): backend routes emit ETag (`backend/.../cycle/routes.py:378` per audit) and support `If-None-Match`; the client never sends it (`api/cycle.ts:241-246` plain GET), so full payloads are re-downloaded on every refetch.

**Approach (safe, minimal):** a small ETag store in the API layer:
1. In `client.ts`, add a request interceptor that, for `GET` requests, attaches `If-None-Match` when a cached ETag exists for the URL (key = `method+url+params-string`).
2. Add a response interceptor: on `200`, store `response.headers.etag`; on `304`, axios returns a response with `response.status === 304` — normalize it to `data: undefined`-safe handling. Since `cycleService.getCalendar` unwraps `res.data`, a 304 with empty body must be handled — **return cached data**:
   - Simplest robust approach: attach `etag` to the cached payload in the React Query layer via `select`, or store `{ etag, body }` in a module cache in `api/cycle.ts` keyed by URL and serve it when `304`.
   - Keep scope small: implement the ETag cache **only** for `cycleService.getCalendar` and `getEntries` first (highest-frequency, largest payloads). Confirm axios in RN handles 304 without throwing (it does — 304 is a success status for axios unless `validateStatus` rejects; verify current `validateStatus` — default treats 2xx as success; add `status !== 304 ? true : false` handling).
3. Add `validateStatus: (s) => (s >= 200 && s < 300) || s === 304` to the `api` instance so 304 flows to the response handler.

**Files touched:** `services/api/client.ts`, `services/api/cycle.ts`.

**Risks:** 
- RN networking may strip some headers on 304 — verify on device/emulator that `etag` arrives.
- Don't cache POST bodies.

**Acceptance:** a second fetch of an unchanged calendar returns 304 and reuses the cached body — no full payload re-download (observable in network logs).

---

## D.4 Backend — fix `get_calendar` `months_back` lower bound

**File:** `backend/app/modules/cycle/services.py:620-627` (verified)
- `get_calendar` computes `end = today + months_forward*30` and `today_ref`/`today_str` (used for prediction window), but the entries query only filters `period_start_date <= end` — it **ignores `months_back`**, returning the user's full history (payload grows with account age).

**Fix:**
```python
start = today_ref - timedelta(days=months_back * 31)  # slightly over to be safe
entries_stmt = (
    select(CycleEntry)
    .where(CycleEntry.user_id == user_id)
    .where(CycleEntry.period_start_date <= end)
    .where(CycleEntry.period_start_date >= start)   # NEW lower bound
    .where(CycleEntry.is_active.is_(True))
    .order_by(CycleEntry.period_start_date.asc())
)
```
- Keep `today_str`/prediction-window logic unchanged.
- **Check the days/phase-encoding loop below (`:643-...`)** to ensure it doesn't need historical entries beyond the window for predictions (it uses `entries[:4]` for period lengths and `build_rolling_features` — confirm `build_rolling_features` gets enough history; if it needs >3 months, use a wider fetch for features only while returning the bounded window to the client, or keep months_back default ≥ 6).
- Add/adjust a backend test in `backend/tests/modules/cycle/` asserting that `get_calendar(months_back=1)` returns no entries older than ~1 month.

**Files touched:** `backend/app/modules/cycle/services.py`, `backend/tests/modules/cycle/test_*.py` (new assertion).

**Acceptance:** calendar response size is bounded by `months_back`; backend pytest green.

---

## D.5 API contract update

**File:** `plans/30-mobile-api-contract.md`
- Document that `GET /cycle/calendar` now honors `months_back` as a hard lower bound (request param semantics).
- Document ETag/`If-None-Match` support for `GET /cycle/calendar` and `GET /cycle/entries`.
- Record the Analytics/Calendar client param changes (no request-shape change, but note bounded params).

**Files touched:** `plans/30-mobile-api-contract.md`.

---

## Verification for Phase D
1. `npm run typecheck && npm run lint && npm run test` in `mobile/`.
2. Backend: `cd backend && pytest tests/modules/cycle/ -x -q` (and the module's own `conftest`).
3. Manual: cold start → check SQLite write counts via logs (single txn); navigate Analytics/Calendar → confirm bounded payload sizes; second calendar refetch → 304.

## Files touched (Phase D)
- `mobile/db/connection.ts`
- `mobile/services/localDb/BaseLocalService.ts`
- `mobile/services/localDb/DayMasterLocalService.ts`
- `mobile/services/localDb/FeatureFlagLocalService.ts`
- `mobile/db/runMigrations.ts`
- `mobile/services/api/client.ts`
- `mobile/services/api/cycle.ts`
- `mobile/services/queries/cycle.ts`
- `mobile/services/localDb/DayLocalService.ts`
- `mobile/screens/analytics/AnalyticsDashboardScreen.tsx`
- `mobile/screens/calendar/CalendarScreen.tsx`
- `mobile/screens/cycle/CycleHistoryScreen.tsx`
- `backend/app/modules/cycle/services.py`
- `backend/tests/modules/cycle/test_*.py`
- `plans/30-mobile-api-contract.md`
