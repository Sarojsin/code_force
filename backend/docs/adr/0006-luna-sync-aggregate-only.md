# ADR 0006: Luna Sync — Aggregate State Only

**Date:** 2026-08-06
**Status:** Accepted

## Context

Luna (the companion AI cat) needs cross-device continuity: XP, level, coins,
relationship level, achievements, mood/trend summaries, preferences, and habit
patterns must follow the user between devices. The product story is "100%
private" — journal content, dialogue history, and raw health data must never
leave the device (AGENTS.md §3.8). Luna2 Phase 4 defines the sync boundary and
merge semantics for this state.

## Decision

Sync **only aggregate companion state** to the backend via a single row per
user in a new `luna_state` table:

1. **Aggregate-only payload.** `LunaStateUpdate` carries scalars (xp, level,
   coins, relationship_level), `mood_trend` (typed `MoodSample` list + server
   computed trend), and JSONB collections (preferences, achievements,
   habit_patterns). Journal content, dialogue history, and raw health data are
   structurally absent — there is no field that can carry them.
2. **Per-field last-write-wins (LWW) merge.** Each field has an `updated_at`
   timestamp; the newest write wins per field, fields absent from an update
   stay untouched. `field_timestamps` JSONB backs the bookkeeping. The client
   supplies `client_updated_at`; the server never trusts a `user_id` from the
   body — row permission comes from the authenticated JWT only.
3. **Server-computed `trend`.** `mood_trend.trend` is derived by
   `compute_mood_trend` (sentiment slope over the last 7 samples, min 3,
   strong trend beats volatility). A client-supplied `trend` is discarded and
   overwritten.
4. **Typed samples with append → sort → trim.** `MoodSample` is a Pydantic
   model (`date`/`mood` Literal/`intensity` 1..5/`source` Literal/`created_at`),
   deduped by `(date, source)`, sorted ascending, capped at 30 most recent by
   `date`. Backdated logs never evict a newer sample.
5. **Loud size caps.** preferences ≤ 50 keys, achievements ≤ 100, habit_patterns
   ≤ 100 keys, `top_log_types` ≤ 20, samples ≤ 30 — enforced in Pydantic (422)
   and re-checked in the service layer (`LunaValidationError` → 422). Oversized
   uploads are rejected, never silently truncated.
6. **`day_logged` event bridge.** The cycle module's `day_logged` event feeds a
   subscriber in the luna module (subscriber lives in the subscriber's module,
   AGENTS.md §1.9) that refreshes `mood_trend` server-side, idempotently
   deduped by `(date, source="day_logged")`. Keeps the aggregate fresh even if
   the mobile device never PUTs.
7. **Client-side offline queue.** The mobile sync client queues offline writes
   in EncryptedStorage with a hard cap of 500 pending mutations, each carrying
   a UUID `idempotency_key`, replayed FIFO on reconnect, oldest dropped (with
   Sentry warning) when over cap. React Query reads via a user-scoped
   `getLunaKeys(userId)` factory with `staleTime: 5 * 60 * 1000`.
8. **Logout preserves server state.** Local state (Zustand, EncryptedStorage,
   AsyncStorage, SQLite, React Query) is cleared on sign-out, but the
   server-side `luna_state` row is never deleted — it exists for cross-device
   sync.

## Rationale

- A single aggregate row keeps the privacy boundary explicit and auditable:
  nothing sensitive exists in the schema to leak.
- Per-field LWW handles concurrent edits across devices without conflict
  resolution UI; `client_updated_at` makes the merge deterministic.
- Server-computed trend guarantees a consistent, tamper-resistant mood signal
  and lets the `day_logged` bridge populate it without client round-trips.
- Loud caps prevent unbounded JSONB growth (AGENTS.md §1.4) and fail in the
  PR review rather than silently at runtime.
- The 500-cap + idempotency_key queue gives at-least-once delivery with
  dedupe (AGENTS.md §3.5) bounded by the device, not the server.

## Consequences

- `luna_state` is a new table (migration `0019_luna_add_state_table.py`,
  reversible).
- GET/PUT `/api/v1/luna/state` endpoints with rate limiting
  (`luna:state:{user_id}`, 100/60s) and 429 `Retry-After` (AGENTS.md §3.6).
- The `day_logged` bridge writes `mood_trend` server-side; both the bridge and
  the PUT path share the same typed merge — no drift.
- Cross-device consistency is eventually consistent via LWW; a device that has
  been offline too long may briefly see server state merged over its local
  copy at launch reconciliation.
- Future richer aggregates (weekly trend rollup) go through the same service
  merge, not new endpoints.
