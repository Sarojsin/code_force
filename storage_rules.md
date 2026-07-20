# Storage Rules — SheCare

> **Status:** Forward-looking design — Phase 2 (not yet implemented).  
> **Current architecture (Phase 1):** EncryptedStorage (`expo-secure-store`) for tokens + offline queue, AsyncStorage for React Query persist + Zustand persist, no SQLite.  
> **Audience:** AI assistants and developers designing the local persistence layer.
>
> *The rules below describe the ideal end-state. Where Phase 1 differs, it is noted in callout blocks.*

---

## 1. The Seven Golden Rules

> **Phase 1 state:** SQLite does not exist yet. Reads go React Query cache → API. Writes go EncryptedStorage queue → API → React Query invalidation. See [Current Architecture](#7-current-architecture-phase-1) for the live system.

### Rule 1: Strict Schema Alignment (Mirror the Server)

*Phase 2 — not yet implemented.*

The SQLite schema must exactly mirror the server API response shapes (`CycleEntry`, `JournalEntry`, `MoodLog`).

**Requirements:**
- All date fields must be stored as `TEXT` (ISO 8601 strings: `YYYY-MM-DD` or ISO datetime).
- Use `text('id').primaryKey()` to store server-issued UUIDs. Never use auto-incrementing integers for primary keys.
- Use `text(..., { mode: 'json' })` for arrays (e.g., `symptoms`, `mood_tags`).

```typescript
// ✅ CORRECT — Mirrors API contract
export const cycleEntries = sqliteTable('cycle_entries', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  period_start_date: text('period_start_date').notNull(), // ISO date
  period_end_date: text('period_end_date'), // nullable
  flow_intensity: text('flow_intensity'),
  symptoms: text('symptoms', { mode: 'json' }),
  mood_tags: text('mood_tags', { mode: 'json' }),
  energy_level: integer('energy_level'),
  notes: text('notes'),
  is_correction: integer('is_correction', { mode: 'boolean' }).default(false),
  corrected_prediction_id: text('corrected_prediction_id'),
  synced_at: text('synced_at'), // Timestamp of last local sync
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
});
```

---

### Rule 2: The Data Pipeline Separation

*Phase 2 — not yet implemented.*

SQLite is a **Read-Only Permanent Cache**.

- Writes (`CREATE`/`UPDATE`/`DELETE`) must NEVER go directly to SQLite.
- Writes go through the existing Offline Queue (EncryptedStorage) → Server.
- SQLite is updated ONLY AFTER the server returns a success (`200`/`201`) response.

> **Phase 1 current path:** Write → `offlineStore.enqueue()` → `syncEngine.pushOperations()` → `POST /sync/batch` → Server 200 → `offlineStore.remove()` + React Query invalidation. No SQLite step.

```typescript
// ✅ CORRECT — Write flow
// 1. User writes journal → enqueue to EncryptedStorage
// 2. Sync Engine sends to server
// 3. Server returns 200 with server-side data
// 4. **ONLY NOW** upsert into SQLite
await localDb.journals.upsert(serverResponse.data);
```

---

### Rule 3: Strict Typing (Drizzle ORM when implemented)

*Phase 2 — not yet implemented. The schema types below are aspirational.*

When SQLite is added, always use Drizzle's `inferSelectModel` and `inferInsertModel` for type safety. Never use raw SQL strings in app code.

```typescript
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { cycleEntries } from './schema';

export type CycleEntry = InferSelectModel<typeof cycleEntries>;
export type NewCycleEntry = InferInsertModel<typeof cycleEntries>;
```

> **Phase 1:** Types are inferred from the API response schemas (`src/types/`). No local database schema exists.

---

### Rule 4: Service Layer Abstraction (The "Repository" Pattern)

*Phase 2 — not yet implemented. The `src/services/localDb/` directory does not exist yet.*

Screens must never import `db` directly. All SQLite interactions must go through dedicated service classes in `src/services/localDb/`. This centralizes logic, makes mocking for tests trivial, and keeps the UI clean.

> **Phase 1:** Screens use TanStack Query hooks (`useCycleCalendar`, `useLogCorrection`) from `src/services/queries/`. Mutations go through `offlineStore.enqueue()` in mutation `onError` handlers.

**Directory structure:**

```
src/services/localDb/
├── CycleLocalService.ts      // Methods: getAll(), getById(), upsert(), delete()
├── JournalLocalService.ts
├── MoodLocalService.ts
└── index.ts                  // Exports singleton instances
```

```typescript
// ✅ CORRECT
// src/services/localDb/CycleLocalService.ts
export class CycleLocalService {
  async getHistory(userId: string, limit: number = 50) {
    return await db
      .select()
      .from(cycleEntries)
      .where(eq(cycleEntries.user_id, userId))
      .orderBy(desc(cycleEntries.period_start_date))
      .limit(limit);
  }

  async upsertMany(entries: CycleEntry[]) {
    // Drizzle's onConflictDoUpdate logic
  }
}
```

---

### Rule 5: Sync Engine Integration (The Bridge)

*Phase 2 — not yet implemented.*

The `syncEngine` must be updated to hydrate SQLite.

- **On Pull** (`GET /sync/changes`): Upsert all fetched records into SQLite.
- **On Push** (`POST /sync/batch`): Once a pending operation succeeds, update the corresponding record in SQLite with the server's returned data (to ensure consistency).

> **Phase 1 (`src/services/sync/syncEngine.ts`):** Push sends `POST /sync/batch` (gzip'd if >10 ops). On success → `offlineStore.remove()` (deletes from EncryptedStorage). On conflict (409) → overwrites local React Query cache with `server_data`. Pull does `GET /sync/changes?since={timestamp}` and invalidates React Query cache. No SQLite hydration step.

```typescript
// In syncEngine.ts
if (status === 'success') {
  await localDb.cycle.upsert(serverData);
  await localDb.journal.upsert(serverData);
}
```

---

### Rule 6: Migration Strategy (Drizzle-Kit — Phase 2)

*Phase 2 — not yet implemented.*

When SQLite is added, migrations will be handled by `drizzle-kit`. Never manually write SQL migrations.

**Workflow:**
1. Update the schema file.
2. Run `npx drizzle-kit generate` to generate the migration file.
3. Apply migrations on app launch (Splash screen blocks while migrations run).

> **Phase 1:** The React Query cache uses a buster string (`'v1'` in `providers.tsx`). Increment it when API response shapes change. Zustand stores persist to AsyncStorage via `persist` middleware and clear on schema changes via `version` field.

---

### Rule 7: Graceful Fallback & Error Handling

*Phase 2 — applies when SQLite is added.*

SQLite operations must never crash the app. Wrap all DB queries in `try-catch`. If SQLite is unavailable (corrupted file, disk full), fall back to the existing React Query cache (AsyncStorage) to ensure the app remains functional.

```typescript
async function getHistory(userId: string) {
  try {
    return await localDb.cycle.getHistory(userId);
  } catch (error) {
    logger.error('SQLite read failed, falling back to cache', error);
    return queryClient.getQueryData(['cycle', 'entries', userId]) || [];
  }
}
```

> **Phase 1:** No SQLite to fail. The existing error handling wraps all EncryptedStorage reads in try-catch (`storage.ts`, `authStore.ts`, `offlineStore.ts`). TanStack Query has `networkMode: 'offlineFirst'` — queries serve cached data on network error. Mutations in offline mode fall through to `offlineStore.enqueue()`. All storage operations are wrapped in individual try-catch blocks with Sentry logging.

---

## 2. Phase 1 vs Phase 2 Cheat Sheet

| Action | Phase 1 (Current) | Phase 2 (Planned) |
|--------|-------------------|-------------------|
| **Write data** | `offlineStore.enqueue()` → `syncEngine.pushOperations()` → Server 200 → `offlineStore.remove()` + React Query invalidation | Same write path, then upsert server response into SQLite |
| **Read data** | TanStack Query hook → React Query cache (AsyncStorage) → API fetch → cache update | React Query cache → **SQLite** → API fetch (SQLite as permanent layer between cache and API) |
| **Offline queue** | EncryptedStorage at key `shecare.offline.queue` (Zustand `offlineStore`) | Same queue; SQLite adds permanent offline read archive |
| **Sync push** | `POST /sync/batch` (gzip if >10 ops), idempotency keys, max 5 retries | Same, plus write to SQLite after success |
| **Sync pull** | `GET /sync/changes?since={timestamp}` → React Query invalidation | Same, plus upsert into SQLite |
| **Conflict resolution** | Server returns `conflict` → overwrite React Query cache with `server_data` | Same, plus overwrite SQLite with server payload |
| **Cache busting** | React Query buster `v1` in `providers.tsx` | Drizzle migrations + React Query buster |
| **SOS priority** | Separate `safetySyncQueue` (EncryptedStorage), priority-based, max 5 retries | Same |
| **Error fallback** | EncryptedStorage try-catch → Sentry → `networkMode: 'offlineFirst'` | EncryptedStorage try-catch → SQLite try-catch → React Query cache |

These rules define the exact "boundaries" so none of the storage layers step on each other's toes.

---

## 3. The Seven Architectural Rules

> **Phase 1 implements 3 layers (EncryptedStorage, AsyncStorage, Zustand). SQLite is Phase 2.**

### Rule 1: The Rule of "Single Responsibility" (The Hierarchy)

Each storage layer has one specific job, and they never overlap in function.

#### Phase 2 (Planned) Hierarchy:

| Layer | Job | What it Stores | TTL |
|-------|-----|----------------|-----|
| **EncryptedStorage** | Write Queue (Source of Truth for Pending) | Unsynced user actions (`journal/create`, `cycle/update`) | Until Synced |
| **PostgreSQL (Server)** | Absolute Source of Truth | All finalized user data | Forever |
| **SQLite** | Offline Historical Archive (Permanent Read Cache) | Read-only synced history (cycles, journals, moods) | Forever |
| **AsyncStorage** | Volatile UI Cache (React Query) | Temporary, recent data for instant UI rendering | 7 days (gcTime) |
| **Zustand** | UI Ephemeral State | Screen navigation, form drafts, auth state | Lost on app restart |

#### Phase 1 (Current) Hierarchy:

| Layer | Implementation | Key/Store | TTL |
|-------|---------------|-----------|-----|
| **EncryptedStorage** | `expo-secure-store` via `src/services/storage.ts` | `shecare.offline.queue`, `shecare.user`, `shecare.accessToken`, `shecare.refreshToken` | Until synced |
| **AsyncStorage** | `@react-native-async-storage/async-storage` | `REACT_QUERY_OFFLINE_CACHE`, `shecare.onboarding`, `shecare.end_date_pending`, `shecare.sync.metrics` | 7 days (RQ), Forever (Zustand persist) |
| **Zustand** | In-memory stores with optional persist | `authStore`, `offlineStore`, `cycleStore`, `endDateStore`, `onboardingStore`, `syncMetricsStore`, `safetyStore` | Persisted per-store config |
| **TanStack Query** | `persistQueryClient` with AsyncStorage persister | `REACT_QUERY_OFFLINE_CACHE` (key), `gcTime: 24h`, `maxAge: 7d`, `buster: 'v1'` | 7 days max |
| **No SQLite** | Not yet implemented | — | — |

---

### Rule 2: The Rule of "Read Path"

#### Phase 2 (Planned):

SQLite is the source of truth for offline mode. React Query is the "speed bump" in front of it.

```
UI Request: CycleHistoryScreen calls useCycleHistory (React Query).
│
├── Attempt 1: Check React Query Cache (AsyncStorage).
│   └── If fresh (< staleTime), return instantly.
│
├── Attempt 2: If no cache, query SQLite.
│   └── Return results, hydrate React Query cache.
│
└── Attempt 3: If no SQLite data, fetch from Server (API).
    └── Hydrate SQLite AND React Query.
```

#### Phase 1 (Current):

No SQLite. Reads go cache → API only. Offline reads rely solely on `persistQueryClient`.

```
UI Request → useQuery() (TanStack Query).
│
├── React Query in-memory cache hit (< staleTime: 5 min) → return instantly.
│
├── React Query persisted cache hit (AsyncStorage, < maxAge: 7d) → return + background refresh.
│
└── Cache miss → fetch from Server → cache in memory + persist to AsyncStorage.
```

---

### Rule 3: The Rule of "Write Path" (EncryptedStorage owns Writes)

User actions NEVER write directly to SQLite.

#### Phase 2 (Planned):

```
User taps "Save Journal"
│
├── Mutation writes operation to EncryptedStorage (Offline Queue).
├── Sync Engine attempts to send to Server.
└── On Server 200 OK:
    ├── Delete operation from EncryptedStorage.
    ├── Upsert server-returned data into SQLite.
    └── Invalidate React Query cache (AsyncStorage).
```

#### Phase 1 (Current):

```
Mutation fires → api.post()
│
├── On success (200): update React Query cache, invalidate queries.
│
├── On network error: offlineStore.enqueue() → EncryptedStorage.
│   └── syncEngine.pushOperations() on reconnect → POST /sync/batch.
│       ├── 200 → offlineStore.remove() → invalidate React Query cache.
│       ├── 409 → overwrite local React Query cache with server_data → discard local op.
│       └── 4xx/5xx non-retryable → offlineStore.discard() (max 5 retries).
│
└── States: normal → queued → syncing → success/conflict/discarded.
```

---

### Rule 4: The Rule of "Data Sovereignty" (Conflict Resolution)

The Server (PostgreSQL) is the ultimate arbiter of truth. The local cache must never override server data.

#### Phase 2 (Planned):

When the Sync Engine receives a `409 Conflict` response from the server:

1. Overwrite the local SQLite record with the server's payload.
2. Discard the pending operation from EncryptedStorage.
3. Update the React Query cache to reflect the server's truth.

#### Phase 1 (Current):

Same principle, no SQLite step:

1. EncryptedStorage op is discarded (`offlineStore.discard()`).
2. React Query cache is overwritten with `server_data` from the conflict response.
3. Toast: *"Updated from another device."* (via `syncEngine.ts`).

---

### Rule 5: The Rule of "Migration Independence"

*Phase 2 — Drizzle migrations not yet implemented.*

SQLite schema migrations are completely separate from the React Query cache (buster version).

| Type | Purpose | Trigger |
|------|---------|---------|
| **React Query Buster** (v1, v2) | Clears the AsyncStorage cache. Used when the shape of the API response changes. | API contract change |
| **Drizzle Migrations** (Phase 2) | Updates the SQLite table structure. | Schema change |

**Phase 1:** Only the React Query buster exists (`'v1'` in `providers.tsx`). Increment on API contract changes to force a full cache refresh. Zustand persist stores can use `version` field in the `persist` config for targeted clears.

---

### Rule 6: The Rule of "Graceful Degradation"

#### Phase 2 (Planned — SQLite fails):

If SQLite fails (corruption, full disk), the app continues using AsyncStorage cache and EncryptedStorage queue.

1. Log the error to Sentry.
2. Fall back to AsyncStorage (React Query cache) for reads.
3. For writes, rely solely on EncryptedStorage → Server sync.
4. Non-blocking toast: *"Local storage is unavailable..."*

#### Phase 1 (Current — EncryptedStorage fails):

All EncryptedStorage operations are wrapped in try-catch:
- `storage.ts` — safe fallback (returns `null` on failure).
- `offlineStore.ts` — logs to Sentry, continues in-memory.
- `authStore.ts` — falls back to cached user, forces re-auth if no cache.

---

### Rule 7: The Rule of "Separation of Concerns" (Repository Pattern)

#### Phase 2 (Planned):

UI screens must NOT interact with SQLite directly. They go through dedicated Service classes in `src/services/localDb/`.

- **Allowed:** `screens/cycle/CycleHistoryScreen.tsx` imports `CycleLocalService`.
- **Forbidden:** Direct imports of `db` or raw SQL strings inside screens.

#### Phase 1 (Current):

Screens interact with TanStack Query hooks (`src/services/queries/`). Mutations go through the API client (`src/services/api/`). The offline layer is accessed via `useOfflineStore()` Zustand hook. This same repository pattern applies to Phase 2 when SQLite is added.

---

### Rule 8: The Rule of "Permanent vs. Volatile"

*Phase 2 — SQLite adds permanent offline archive.*

| Storage | Phase 1 | Phase 2 |
|---------|---------|---------|
| **SQLite** | Not implemented | Permanent offline read cache, never pruned |
| **React Query (AsyncStorage)** | Persisted with `maxAge: 7d`, `gcTime: 24h` | Same, with SQLite as backing store |
| **EncryptedStorage** | Offline queue persisted until synced | Same |

**Goal:** Phase 1 provides 7-day offline read cache via persisted React Query. Phase 2 extends this to unlimited offline history via SQLite.

---

## 4. Summary Cheat Sheet

| Action | Phase 1 (Current) | Phase 2 (Planned) |
|--------|-------------------|-------------------|
| User saves data (online) | API → 200 → React Query invalidation | API → 200 → upsert SQLite → React Query invalidation |
| User saves data (offline) | `offlineStore.enqueue()` → EncryptedStorage | Same, plus optimistic SQLite insert |
| User views history (online) | React Query cache → API fetch | React Query → SQLite → API fetch |
| User views history (offline) | React Query persisted cache (AsyncStorage, 7d max) | SQLite full history (no limit) |
| User force-quits | EncryptedStorage + AsyncStorage persist | EncryptedStorage + AsyncStorage + SQLite persist |
| API response shape changes | Increment buster `'v1'` → `'v2'` in `providers.tsx` | Same + Drizzle migration for SQLite columns |
| Need to clear all local data | `offlineStore.clear()` + `QueryClient.clear()` + buster increment | Same + SQLite `DROP` |

---

## 5. Online vs. Offline Playbook

> **Note:** The tables below describe the Phase 2 end-state. Phase 1 omits SQLite steps (marked *).

### 5.1 The "Write" Path (User Creates a Journal / Logs a Period)

This is the most critical path. It uses the **"Optimistic UI + Reliable Queue"** pattern.

#### Scenario A: User is ONLINE (Has WiFi/Cellular)

| Step | Layer | Action | Duration |
|------|-------|--------|----------|
| 1. Optimistic UI | Zustand / React Query | The UI updates instantly (optimistic update). | < 50ms |
| 2. Local Persist | EncryptedStorage (Queue) | Operation written to `shecare.offline.queue` as safety net. | < 50ms |
| 3. Network Attempt | API Client | Sends mutation to Server (`POST /journal` or `POST /sync/batch`). | ~200-500ms |
| 4. Server Success | Server (PostgreSQL) | Saves data, returns `200 OK` with server-generated `id`. | ~100ms |
| 5. Final Commit | EncryptedStorage & React Query | Deletes operation from queue; invalidates React Query cache with server data. | ~100ms |
| | *Phase 2 only:* SQLite | Upserts server data into SQLite. | ~50ms |
| 6. UI Reconciliation | React Query | UI replaces optimistic temp ID with server ID. | < 50ms |

#### Scenario B: User is OFFLINE (Airplane mode / No signal)

| Step | Layer | Action | Duration |
|------|-------|--------|----------|
| 1. Optimistic UI | Zustand / React Query | The UI updates instantly (the entry appears with a gray "Syncing..." badge or a temporary local ID). | < 50ms |
| 2. Local Persist | EncryptedStorage (Queue) | The operation is immediately written to the Offline Queue (`shecare.offline.queue`). | < 50ms |
| 3. Network Attempt | API Client | The app attempts the POST request. It fails immediately (Network Error). | ~10ms |
| 4. Queue Persistence | EncryptedStorage | The operation stays in the encrypted queue. The user closes the app. Data is safe. | N/A |
| 5. UI State | React Query | The UI shows the data from the local cache (AsyncStorage) or the new optimistic entry. The user continues using the app. | N/A |

---

### 5.2 The "Sync" Path (The Bridge: Offline → Online)

This happens when the user walks into a WiFi zone after being offline.

| Step | Layer | Action |
|------|-------|--------|
| 1. Trigger | Network Listener | `NetInfo` fires an event: `isConnected = true`. The `syncEngine` wakes up. |
| 2. Read Queue | EncryptedStorage | Sync Engine reads all pending operations from the encrypted queue (FIFO order). |
| 3. Push to Server | API Client | Sends the oldest pending operation to the server. |
| 4. Server Processes | Server (PostgreSQL) | Server saves the data. If there is a conflict (`409`), the server returns its version. If success (`200`), it returns the server data. |
| 5. Local Finalization | EncryptedStorage / React Query | a) If success: Deletes the op from EncryptedStorage. Invalidates React Query cache. *Phase 2:* Upserts server data into SQLite. |
| | | b) If conflict: Overwrites local cache (and *Phase 2* SQLite) with server data. Deletes the op from EncryptedStorage. Shows toast: *"Updated from another device."* |
| 6. Next Operation | EncryptedStorage | Repeats Step 3-5 for the next item in the queue until the queue is empty. |

---

### 5.3 The "Read" Path (User opens "Cycle History")

This determines where the data comes from when the user navigates to a list.

#### Scenario A: App is ONLINE

| Step | Layer | Action |
|------|-------|--------|
| 1. UI Request | Screen | `CycleHistoryScreen` mounts and calls `useCycleHistory()`. |
| 2. Cache Check | React Query | Checks AsyncStorage for fresh data (`staleTime: 5 min`). If fresh, returns instantly. |
| 3. Background Fetch | API Client | React Query fires a background request to the Server for new data. |
| 4. Server Response | Server | Server returns the latest history. |
| 5. Cache Update | React Query | Updates React Query cache (AsyncStorage). |
| | *Phase 2:* SQLite | Upserts fetched data into SQLite (permanent archive). |
| 6. UI Render | Screen | The UI seamlessly merges the fresh data without a loading spinner (thanks to stale-while-revalidate). |

#### Scenario B: App is OFFLINE (or Server is down)

| Step | Layer | Action |
|------|-------|--------|
| 1. UI Request | Screen | `CycleHistoryScreen` mounts. |
| 2. Cache Miss/Stale | React Query | AsyncStorage has no cache (or expired). React Query attempts to fetch from Server, network fails. |
| 3. Fallback | React Query (Phase 1) or SQLite (Phase 2) | Phase 1: Returns persisted AsyncStorage cache (`persistQueryClient`, max 7d old). Phase 2: Queries SQLite for full history. |
| 4. UI Render | Screen | The user sees their complete history, even though they are offline. |
| 5. Queue Check | EncryptedStorage | The UI also checks the offline queue and displays a small *"1 item waiting to sync"* badge at the top of the list. |

---

### 5.4 Summary Matrix

| State | Action | Phase 1 Data | Phase 2 Data |
|-------|--------|-------------|-------------|
| **Online (Write)** | UI → Queue → Server → cache. | React Query cache. | React Query + SQLite. |
| **Online (Read)** | React Query → background API → cache. | React Query (AsyncStorage, 7d). | React Query + SQLite (permanent). |
| **Offline (Write)** | UI → Queue (EncryptedStorage). Server not reached. | EncryptedStorage (Queue). | Same. |
| **Offline (Read)** | React Query fails → fallback. | React Query persisted cache (7d max). | SQLite full history (no limit). |
| **Reconnect (Sync)** | Sync Engine drains Queue → Server → cache. | Clears EncryptedStorage, updates React Query. | Same + updates SQLite. |

---

## 6. The "Emergency SOS" Exception

SOS has its own dedicated offline queue that bypasses the standard sync engine.

**Implementation:** `src/services/safetySyncQueue.ts` — separate EncryptedStorage queue at key `shecare.safety.offlineQueue`. Priority-based (critical > normal > low), max 5 retries, auto-syncs on reconnect via NetInfo listener.

- **Online:** API call sends push notifications to emergency contacts.
- **Offline:** The SOS is stored in the safety queue with `priority: 'critical'`. If the queue is full or max retries exceeded, the app opens the native SMS app with a pre-filled emergency message as hardware fallback.
- **State:** The `safetyStore` (Zustand, in-memory only, no persistence) tracks SOS state during the session.

> **Note:** This is why SOS doesn't rely solely on the main sync engine — it has priority queuing and native SMS fallback.

---

## 7. Current Architecture (Phase 1)

This section documents the **live** storage architecture as implemented today. All rules above that reference SQLite/Drizzle are forward-looking; the following is what actually runs on device.

### 7.1 Storage Layer Map

| Technology | Package | Used For |
|-----------|---------|----------|
| **expo-secure-store** | `expo-secure-store` | Auth tokens (`shecare.accessToken`, `shecare.refreshToken`), user cache (`shecare.user`), offline queue (`shecare.offline.queue`), safety queue (`shecare.safety.offlineQueue`), sync state (`shecare.sync.lastPull`) |
| **AsyncStorage** | `@react-native-async-storage/async-storage` | React Query persist (`REACT_QUERY_OFFLINE_CACHE`), Zustand persist (`shecare.onboarding`, `shecare.end_date_pending`, `shecare.sync.metrics`) |
| **Zustand** | `zustand` | 7 stores (auth, offline, cycle, endDate, onboarding, syncMetrics, safety) |
| **TanStack Query** | `@tanstack/react-query` | Server state cache with `persistQueryClient` |

### 7.2 Key Implementation Files

| File | Purpose |
|------|---------|
| `src/services/storage.ts` | EncryptedStorage adapter (expo-secure-store, falls back to localStorage on web) |
| `src/services/api/client.ts` | Axios instance, token interceptor, refresh logic, offline detection |
| `src/stores/authStore.ts` | User state, `hydrate()`, token + user cache in EncryptedStorage |
| `src/stores/offlineStore.ts` | Offline queue (EncryptedStorage at `shecare.offline.queue`), enqueue/remove/discard |
| `src/services/sync/syncEngine.ts` | Push (`POST /sync/batch`, gzip, idempotency), pull (`GET /sync/changes`), conflict resolution |
| `src/app/providers.tsx` | `persistQueryClient` config (key `REACT_QUERY_OFFLINE_CACHE`, buster `'v1'`, maxAge 7d) |
| `src/services/safetySyncQueue.ts` | Priority-based SOS queue, separate from main queue |

### 7.3 Why SQLite? — Relational Queries Over Key-Value Scanning

AsyncStorage is a key-value store. It is sufficient for the UI cache (React Query) because React Query only performs simple key lookups (`queryKey` → JSON blob). However, for a historical archive we need efficient filtering, sorting, and aggregation — e.g., *"Show me the last 6 months of cycles where stress was high AND period_length > 5."* With AsyncStorage this would require loading every stored record into the JavaScript heap and filtering in pure JS, which becomes slow and memory-intensive as history grows.

SQLite runs these queries natively in C++ without transferring thousands of records across the JS bridge. This keeps the UI responsive and avoids jank when scrolling deep into history. The trade-off is a more complex setup (schema management, migrations, service layer), but the query capability is essential for the Cycle Analytics and Insights features planned post-MVP.

### 7.4 Phase 2 Migration Checklist

1. Add `expo-sqlite` and `drizzle-orm` + `drizzle-kit` to dependencies.
2. Create `src/db/schema.ts` mirroring API response shapes.
3. Create `src/services/localDb/` service classes.
4. Update `syncEngine.ts` to upsert SQLite on push success and pull.
5. Update the read path in query hooks to fall through to SQLite.
6. Add Drizzle migrations to app startup (blocking Splash screen).
7. Update the Zustand stores that currently persist to AsyncStorage.
8. Add `is_active` soft-delete awareness to all SQLite queries.
