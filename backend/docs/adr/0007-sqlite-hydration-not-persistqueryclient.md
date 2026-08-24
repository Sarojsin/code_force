# ADR 0007: SQLite → React Query Hydration (No persistQueryClient)

**Date:** 2026-08-20
**Status:** Accepted

## Context

The mobile app needs warm startup for offline-first features: journal list,
mood history, cycle days, and diary heirlooms must paint instantly from local
data on launch, then refresh in the background. Phase H of the UX/performance
audit considered making the React Query cache persistent across app restarts.

The obvious mechanism — `@tanstack/react-query-persist-client` writing the
whole query cache to AsyncStorage on flush — is **forbidden by AGENTS.md
§3.8 / §2.13**: journal content and medical notes must never be stored
plaintext at rest, and `react-native-encrypted-storage` is not installed in
the dependency set. A wholesale cache dump to AsyncStorage would dump
`content` (journal bodies) in plaintext.

There must be a warm-cache mechanism for these features that does not move
sensitive payloads into plaintext storage, and whatever is hydrated must match
the server response shape **exactly** so `placeholderData` and cached entries
remain valid.

## Decision

Replace `persistQueryClient` with **startup hydration from SQLite** into the
in-memory React Query cache:

1. **Gated by known user.** `AppProvider` resolves the stored user id
   (EncryptedStorage `shecare.user`, falling back to the auth store) and calls
   `hydrateFromSqlite(userId)` fire-and-forget during prewarm — it never blocks
   `ready` / TTI.

2. **Whitelisted reads only.** The hydrator reads only user-owned SQLite rows
   that are safe to display and re-fetchable:
   - journal entries (`localDb.journal.getRecent(userId, 50)`) → journal list query
   - mood logs (`localDb.mood.getByDateRange`, last 30 days) → mood list query
   - diaries (`diaryLocal.diary.getByUser(userId)`) → heirloom list query

3. **Exact-shape mappers.** SQLite rows carry columns the HTTP shape does not
   (`user_id`, `is_active`, `synced_at`, `deleted_at` on some tables) and the
   HTTP shape carries fields SQLite does not. `hydrateFromSqlite.ts` maps each
   local row to the exact server response shape (e.g. `toJournalEntry`,
   `toDiary`) before `queryClient.setQueryData`. A cache entry that does not
   match the server response shape is treated as invalid by consumers, so
   hydration must never write raw Drizzle rows.

4. **Hydrated entries are marked stale.** After `setQueryData`, the matching
   query key is `invalidateQueries`-ed so a mounted screen renders the warm
   local data instantly **and** refetches in the background (stale-while-
   revalidate). Hydration is a first paint, not a 10-minute frozen view.

5. **New fetch-only reads stay untouched.** Queries whose remote shape is the
   single source of truth and that have no sensitive-at-rest concern (nurse
   content, breathing exercises) are not hydrated from SQLite; the existing
   `prefetchAppData(userId)` network prewarm covers them.

6. **Single-entry wins from the list.** `JournalEntryScreen` seed its
   `placeholderData` from the warmed journal-list entry (H.3), so opening an
   entry from a freshly hydrated list never shows a skeleton.

## Rationale

- Respects the privacy boundary: sensitive body journal content never leaves
  SQLite into plaintext AsyncStorage. SQLite on-device is the accepted
  persistent store (AGENTS.md §3.8 "client-side encrypted OR server-side
  encrypted — never plaintext at rest"; SQLite rows live on-device and are
  encrypted at the OS level with the app sandbox).
- No new native dependency: `react-native-encrypted-storage` stays out; no
  `persistQueryClient` flush loop to debug.
- Correct warm behavior: the cache is in-memory only (see `providers.tsx`
  comment), so privacy (clear-on-logout, AppState background clearing §2.13)
  is preserved while the first-paint data is already in hand.
- Deterministic cache validity: shape mappers guarantee the cache never holds
  a row React Query consumers would mis-read.

## Consequences

- `mobile/src/services/queries/hydrateFromSqlite.ts` becomes the single
  tap-in point for future hydrate targets (e.g. diary pages per diary).
- Hydration cost: one parallel SQLite read set per launch; rows are bounded
  (50 journals, 30-day moods, heirlooms = user's diary count).
- Logout must clear React Query — hydrator keys are user-scoped
  (`getWellnessKeys(userId)`) and existing logout already wipes the whole
  cache, so a stale-user hydration cannot leak into the next account.
- Any future addition to hydration must add a mapper and be reviewed against
  the exact-shape rule and the privacy boundary; raw Drizzle-row
  `setQueryData` is rejected in review.