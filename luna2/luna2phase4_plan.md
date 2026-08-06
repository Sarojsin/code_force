# Luna2 Phase 4 — Backend Sync (aggregate state only)

> Phase 4 adds cross-device continuity: Luna's **aggregate state** (XP, level,
> coins, relationship level, achievements, mood/trend summaries, preferences,
> habit patterns) syncs to the backend so progress follows the user.
>
> **Privacy boundary (decided):** ONLY aggregate state crosses the wire.
> NEVER journal content, dialogue history, or raw health data. Aligns with
> AGENTS.md §3.8 (privacy) and the "100% private" product story.

---

## 1. Backend — grow `app/modules/luna/` into a full module

Per AGENTS.md §1.1 package-by-feature, the luna module currently only has
`routes.py` + assets. Add the standard files.

### 1.1 `models.py`

```py
class LunaState(Base):
    __tablename__ = "luna_state"
    id: UUID pk
    user_id: FK -> users.id, unique, index
    xp: int = 0
    level: int = 1
    coins: int = 0
    relationship_level: int = 1
    mood_trend: JSONB  # {"trend": "improving|declining|stable|volatile", "samples": [...], "updated_at": ts}
    preferences: JSONB # {"speechEnabled": bool, "speechRate": float, "muteSounds": bool, ...}
    achievements: JSONB # {"id": "sleep_streak_7", "unlocked_at": ts, ...}[]
    habit_patterns: JSONB # {"sleep_avg_hour": 23.1, "top_log_types": [...], ...}
    updated_at: timestamptz
    created_at: timestamptz
```

- JSONB + GIN index on the jsonb columns (AGENTS.md §1.4).
- Migration `luna_add_state_table.py` — reversible (`downgrade` drops table).

### 1.2 `schemas.py`

- `LunaStateUpdate` — all fields optional (PUT/PATCH semantics).
- `LunaStateResponse` — includes `id`, `created_at`, `updated_at`
  (AGENTS.md §1.7 schema split: Update vs Response).
- **Size limits (mandatory — prevent unbounded JSONB growth):** validate with
  Pydantic constraints, not just trust the client:
  - `mood_trend.samples` → list capped at **30** entries (oldest dropped).
  - `achievements` → list capped at **100** entries.
  - `habit_patterns` → object capped at **100** keys; `top_log_types` capped
    at **20**.
  - `preferences` → object capped at **50** keys.
  - Enforce with `Field(..., max_length=...)` / list-length validators, plus a
    service-layer guard that rejects oversized payloads with
    `LunaValidationError` → HTTP 422. Uploads over the cap fail loudly, never
    silently truncate.

### 1.2a `mood_trend.samples` shape (explicit — prevent drift)

Each sample is a **typed object**, never a free-form dict:

```py
{
  "date": "2026-08-06",          # ISO date (local, YYYY-MM-DD)
  "mood": "happy",               # one of: happy|sad|anxious|angry|neutral
  "intensity": 5,                # int 1..5
  "source": "day_logged",        # one of: day_logged|manual|journal_analysis
  "created_at": "2026-08-06T18:00:00Z",  # ISO timestamp (event time)
}
```

Rules:
- **`trend` is server-computed**, not client-supplied: derived by comparing
  recent samples (e.g. mean intensity / mood-sentiment slope over the last
  5–7 samples) → `improving | declining | stable | volatile`. If the client
  sends a `trend`, the server recomputes and overwrites it.
- `source` lets the backend weight/bucket samples (e.g. `day_logged` bridge vs
  manual mood log) without guessing.
- Enforce via a Pydantic model (`MoodSample`) with `Literal` enums for
  `mood` and `source`, `ge=1/le=5` for `intensity`, and a `date` pattern
  check. Invalid samples → 422.
- Sorted by `date` ascending; capped at 30 samples (§1.2).
- **Append → sort → trim order (correct cap enforcement):** in `upsert_state`,
  the cap is enforced **after** insertion, never by pre-dropping oldest:
  1. Append the new `MoodSample` to `samples`.
  2. Sort by `date` ascending (then `created_at` as tiebreak for stability).
  3. If `len(samples) > 30`, slice to the **last 30** (keep the newest by
     `date`).
  4. Recompute `trend` from the resulting samples.
  5. Write back to JSONB.
  > Why: backdated logs (e.g. a manually logged mood with an old `date`) are
  > rare but possible. Dropping the oldest sample *before* insertion could
  > evict the wrong sample when the new one is older than some existing
  > entries. Insert-then-trim guarantees the 30 kept samples are the most
  > recent by `date`.

### 1.3 `services.py`

- `get_state(user_id) -> LunaState` (create default row if missing).
- `upsert_state(user_id, update) -> LunaState`
  - **LWW merge:** compare per-field `updated_at` timestamps; the newest write
    wins per field. Fields not in the update stay untouched.
  - Row-level permission via `current_user.id` only (AGENTS.md §1.12) —
    never trust `user_id` from the request body.
  - Cap enforcement before persistence (§1.2) — reject or clamp per policy.

### 1.4 `routes.py` (add, keep asset endpoints)

- `GET /api/v1/luna/state` → `LunaStateResponse`
- `PUT /api/v1/luna/state` → body `LunaStateUpdate` → `LunaStateResponse`
- Apply `@rate_limit(limit=..., window=60)` from `dependencies.py`.
- Thin: parse → call service → format response (AGENTS.md §1.2).

### 1.5 `dependencies.py`

- `get_luna_service`, rate-limit decorator, auth dependency.

### 1.6 `exceptions.py`

- `LunaError` base + `LunaNotFoundError` / `LunaConflictError`.

### 1.7 tasks.py

- None initially (sync merge is synchronous). Reserve file for future
  background consolidation (e.g. weekly trend rollup).

---

## 2. Event bridge — `day_logged` → Luna mood refresh (MANDATORY)

> This is **required**, not optional. Without it the server-side
> `mood_trend` aggregate goes stale whenever the user logs mood only on the
> mobile device and sync happens to lag or be skipped. The wellness module
> already upserts `MoodLog` from `day_logged` (`wellness/routes.py:272`);
> Luna does the same for `mood_trend`.

Mirror the wellness pattern:
1. Subscribe to `day_logged` in `backend/app/modules/luna/` (subscriber lives
   in the subscriber's module — AGENTS.md §1.9).
2. On event: refresh `LunaState.mood_trend` aggregate server-side from the
   stored mood samples (idempotent — recompute from stored samples, no
   double-count; guard with the `day_logged` business key / unique constraint
   on processed events). Each bridged event appends a `MoodSample` with
   `source: "day_logged"` and recomputes `trend` (§1.2a).
3. Falls back to the client-side sync as the transport of last resort; the
   bridge keeps state fresh even when the client never PUTs.
4. Test: emit `day_logged` twice → aggregate computed once, no drift.

---

## 3. Mobile — sync client

### 3.1 `mobile/src/services/companion/lunaSyncClient.ts`

- **Key Scoping (Rules §1.1):** implement a `getLunaKeys(userId)` factory.
  `useLunaState` queryKey: `[...getLunaKeys(userId).state]`. Every Luna React
  Query key is user-scoped — prevents cross-user leakage (structural
  isolation > runtime deletion).
- **Stale Time (Rules §1.3):** set `staleTime: 5 * 60 * 1000` for
  `useLunaState` (mutable user data). Never `Infinity`.
- **Invalidation (Rules §1.2):** on mutation success (PUT), invalidate
  `getLunaKeys(userId).all` to refresh all Luna-related caches together.
- **Offline Queue Hard Cap & Idempotency (Rules §2.2, §2.3):**
  - Offline writes are queued in AsyncStorage (encrypted via
    `react-native-encrypted-storage`) with a hard cap of **500 pending
    mutations**.
  - Each entry carries an `idempotency_key` (UUID v4) to prevent duplicate
    processing on reconnect.
  - On reconnect, the queue is replayed in **FIFO order**.
  - If the cap is exceeded, the **oldest** entries are dropped and a warning
    is logged to Sentry.
- **LWW:** each queued write carries `updated_at`; merge on server side
  (see services).
- **ETag revalidation:** use the envelope + `If-None-Match` for cheap
  revalidation (AGENTS.md §3.7).

### 3.2 Local ↔ server reconciliation

- On login/launch: fetch server state; merge into `companion_metadata`
  where server `updated_at` > local.
- Keep local store as source of truth for realtime feel; server is the backup
  for cross-device.

### 3.3 Sign-out cleanup

Per `plans/signin_signout_flow_logic.md` and Rules §2.4, on sign-out the sync
client must execute the following **synchronous cleanup before navigation
resets**:

1. **Reset in-memory Zustand stores** (including setting `isCompleted: false`).
2. **Clear all EncryptedStorage keys** (tokens, preferences, draft metadata,
   offline queue).
3. **Clear all AsyncStorage keys** (onboarding flag, pregnancy mode, etc.).
4. **Purge the SQLite database** (`deleteDatabaseAsync` → fallback
   `DELETE FROM` all tables — removes `companion_memory` and
   `companion_metadata`).
5. **Clear the React Query cache** (`queryClient.clear()`).

> **Important:** Do NOT delete the server-side Luna state (`luna_state` table)
> on logout. It must persist for cross-device sync.

---

## 4. API contract

Update `plans/30-mobile-api-contract.md` in the same PR (AGENTS.md §3.1):

- `GET /api/v1/luna/state`
- `PUT /api/v1/luna/state`
- Envelope: `{ "data": ..., "message": "ok" }` / error envelope (AGENTS.md §3.2).
- Auth: `Authorization: Bearer <access_token>`.

---

## 5. Tests & verification

### Backend (`tests/modules/luna/`)
- `test_state.py`:
  - GET creates default row on first access.
  - PUT upsert + LWW merge (older field write does not clobber newer).
  - Row-level permission: user A cannot read/write user B's state.
  - **Size limits:** oversized `mood_trend.samples` (>30) / `achievements`
    (>100) / `habit_patterns` (>100 keys) → 422, row unchanged.
  - **Sample validation:** invalid `mood`/`source` enum, `intensity` out of
    `1..5`, malformed `date` → 422; client-supplied `trend` is recomputed and
    overwritten by the server.
  - **Cap enforcement order:** with 30 samples present, appending a new sample
    → sort → trim keeps the 30 most recent by `date`.
  - **Backdated-log regression:** inserting a sample with an old `date` into a
    full list does NOT evict a newer sample; the trimmed list is correct by
    `date` (append → sort → trim, not pre-drop).
  - 429 rate-limit response includes `Retry-After`.
- `test_event_bridge.py`:
  - `day_logged` emitted → `mood_trend` refreshed server-side.
  - Idempotency: duplicate `day_logged` does not double-count.
  - Bridged samples carry `source: "day_logged"` and `trend` is recomputed
    from typed `MoodSample`s, not raw dicts.

### Mobile
- `lunaSyncClient.test.ts`:
  - queue + retry on reconnect; LWW timestamp attach.
  - **Queue cap enforcement:** exceeds 500 → oldest entries dropped + Sentry
    warning logged.
  - **idempotency_key generation** and deduplication on replay.
  - **FIFO replay order** verified.
- **Integration (mocked network):** `lunaSyncIntegration.test.ts` — simulate
  offline → enqueue multiple writes → reconnect → replay in FIFO order →
  assert server state merges correctly (LWW) and duplicate keys (same
  `idempotency_key`) are ignored. Also assert nothing but aggregate state is
  ever serialized (grep payload keys).
- React Query hooks tested with mocked client — query keys user-scoped via
  `getLunaKeys(userId)`, `.all` invalidated on mutation success.
- `tsc --noEmit` clean; existing companion suites pass.

---

## 6. Files touched

- `backend/app/modules/luna/{models,schemas,services,routes,dependencies,exceptions}.py`
- `backend/app/modules/luna/assets/` (unchanged)
- `backend/plans` migration file
- `backend/app/main.py` (register `init_module` — already done; add deps)
- `mobile/src/services/companion/lunaSyncClient.ts` (new)
- `mobile/src/services/api/` (add endpoints)
- `plans/30-mobile-api-contract.md`
- ADR: `backend/docs/adr/NNNN-luna-sync-aggregate-only.md`

---

## 7. Exit criteria (Phase 4)

- Backend serves `GET/PUT /api/v1/luna/state` with LWW merge + row-level
  permission + rate limiting + **JSONB size limits (422 on oversize)** +
  **typed `mood_trend.samples` (`MoodSample`: date/mood/intensity/source) with
  server-computed `trend`**; migration reversible; tests green
  (`ruff`, `mypy --strict`, `pytest`, coverage >= 80%).
- `day_logged` → `mood_trend` bridge is **mandatory, implemented, idempotent**
  and tested.
- Mobile sync client (React Query reads + offline queue + reconnect replay +
  integration test) in place; no journal/dialogue content ever sent.
- **`getLunaKeys(userId)` factory implemented; all Luna React Query keys are
  user-scoped** (Rules §1.1), `staleTime: 5 * 60 * 1000` (Rules §1.3), `.all`
  prefix invalidated on mutation (Rules §1.2).
- **Offline queue enforces 500-mutation cap and FIFO replay with
  `idempotency_key`** (Rules §2.2, §2.3).
- **Logout routine fully clears local state (Zustand, EncryptedStorage,
  AsyncStorage, SQLite, React Query) while preserving server state** (Rules
  §2.4).
- API contract updated in the same PR.
- Sign-out clears local + queue, preserves server state.

---

## 8. Execution status

| Item | Status |
|------|--------|
| Backend module `app/modules/luna/` (models/schemas/services/routes/deps/exceptions) | ✅ Done |
| `luna_state` table + reversible migration (head, GIN index) | ✅ Done |
| `GET/PUT /api/v1/luna/state` — LWW merge, row-level permission, rate limit + `Retry-After`, ETag/304 | ✅ Done |
| JSONB size caps → 422 (30 samples / 100 achievements / 50 prefs / 100 habit keys / 20 top_log_types) | ✅ Done |
| Typed `MoodSample` + server-computed `trend` (append → sort → trim, backdated-log safe) | ✅ Done |
| `day_logged` → `mood_trend` bridge (idempotent, `source: "day_logged"`) | ✅ Done |
| Backend tests `tests/modules/luna/` (40 passing) + `conftest.py` event_loop fix | ✅ Done |
| `ruff` / `mypy --strict` clean on luna + core; single alembic head | ✅ Done |
| ADR `backend/docs/adr/0006-luna-sync-aggregate-only.md` | ✅ Done |
| Mobile `lunaSyncClient.ts` — `getLunaKeys`, `useLunaState` (5 min stale), `.all` invalidation | ✅ Done |
| Offline queue: 500 cap, `idempotency_key`, FIFO replay, oldest-drop + Sentry warning | ✅ Done |
| ETag revalidation (`If-None-Match` / 304) + module-level state cache | ✅ Done |
| Launch/reconnect `syncLunaState` wired into `App.tsx` debounced sync | ✅ Done |
| Sign-out: `clearLunaSync(userId)` added to `sessionReset.ts` (server row preserved) | ✅ Done |
| Mobile tests: `lunaSyncClient.test.ts` (15) + `lunaSyncIntegration.test.ts` (12) — 144 companion tests green, `tsc --noEmit` clean | ✅ Done |
| API contract `plans/30-mobile-api-contract.md` §12 | ✅ Done |
