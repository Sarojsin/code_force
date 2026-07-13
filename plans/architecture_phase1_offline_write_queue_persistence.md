# Architecture Phase 1: Offline Write Queue + React Query Persistence

**Priority:** Critical (3 days)
**Dependencies:** None (foundational)
**Files touched:** 14 (11 query hooks, 1 provider, 1 store, 1 App entry)

---

## 1. Objective

Transform the app from "fails silently when offline" to "queues writes locally, persists cache across restarts." This is the foundation that all other phases depend on.

Two independent sub-tasks:

| Sub-task | Effort | Success Metric |
|----------|--------|----------------|
| 1a. Wire 11 mutation hooks to `offlineStore.enqueue()` | 2 days | Offline writes survive app restart and sync on reconnect |
| 1b. Enable `persistQueryClient` with AsyncStorage | 1 day | Calendar/data loads instantly after force-quit + relaunch |

---

## 2. Current State (Before)

### 2.1 Write Path (broken)

```
User taps Save → useMutation.mutate()
  → api.post() — NetworkError (offline)
  → onError — Toast "Failed to save"
  → Data LOST
```

`offlineStore.enqueue()` is defined and tested (`tests/`) but **zero screens or hooks call it**. The infrastructure (EncryptedStorage, Zustand store, `syncEngine.ts`, `pushOperations()`) is fully built but completely disconnected.

### 2.2 Read Path (in-memory only)

```
App loads → useQuery() → api.get()
  → data in React Query cache (RAM only)
  → App killed → cache GONE
  → App relaunch → FULL NETWORK REQUIRED
```

`@tanstack/react-query-persist-client` is in `package.json` but **never imported**. `gcTime` is 5 min in-memory only. No AsyncStorage persister is configured.

---

## 3. Phase 1a: Wire Offline Queue into 11 Mutation Hooks

### 3.1 Architecture Pattern

Every mutation hook follows this exact pattern:

```typescript
// AFTER
export function useCreateJournalEntry() {
  const qc = useQueryClient();
  const offlineStore = useOfflineStore();

  return useMutation({
    mutationFn: (data) => wellnessService.createJournalEntry(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wellnessKeys.journal });
    },
    onError: (error) => {
      // 1. Determine if network error (vs server validation error)
      if (isNetworkError(error)) {
        // 2. Enqueue to offline store
        offlineStore.enqueue({
          type: 'journal/create',
          endpoint: '/api/v1/wellness/journal',
          data,
          tempId: generateId(),
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        // 3. Show offline toast
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        // 4. Optimistically update UI (add to cache)
        qc.setQueryData(wellnessKeys.journal, (old: any) => [data, ...(old || [])]);
      } else {
        // Server validation error — show error
        Toast.show({ type: 'error', text1: getErrorMessage(error) });
      }
    },
  });
}
```

### 3.2 Helper: `isNetworkError()`

```typescript
// src/services/sync/isNetworkError.ts
import { AxiosError } from 'axios';

export function isNetworkError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    // No response = network failure (offline, timeout, DNS)
    if (!error.response) return true;
    // 5xx = server error, should retry later
    if (error.response.status >= 500) return true;
    return false;
  }
  if (error instanceof TypeError && error.message === 'Network request failed') {
    return true;
  }
  return false;
}
```

### 3.3 Files to Modify (11 hooks, 3 files)

All changes are in `src/services/queries/`:

| # | File | Hook | Endpoint | Type Label | Priority |
|---|------|------|----------|------------|----------|
| 1 | `cycle.ts` | `useCreateCycleEntry` | `POST /cycle/entries` | `cycle/create` | normal |
| 2 | `cycle.ts` | `useUpdateCycleEntry` | `PUT /cycle/entries/{id}` | `cycle/update` | normal |
| 3 | `cycle.ts` | `useLogCorrection` | `POST /cycle/corrections` | `cycle/correction` | normal |
| 4 | `cycle.ts` | `useLogSnooze` | `POST /cycle/snooze` | `cycle/snooze` | low |
| 5 | `wellness.ts` | `useCreateJournalEntry` | `POST /wellness/journal` | `journal/create` | normal |
| 6 | `wellness.ts` | `useCreateMoodLog` | `POST /wellness/mood` | `mood/create` | normal |
| 7 | `wellness.ts` | `useCompleteBreathingSession` | `POST /wellness/breathing/complete` | `breathing/complete` | low |
| 8 | `safety.ts` | `useCreateEmergencyContact` | `POST /safety/emergency-contacts` | `safety/contact/create` | normal |
| 9 | `safety.ts` | `useUpdateEmergencyContact` | `PUT /safety/emergency-contacts/{id}` | `safety/contact/update` | normal |
| 10 | `safety.ts` | `useDeleteEmergencyContact` | `DELETE /safety/emergency-contacts/{id}` | `safety/contact/delete` | normal |
| 11 | `safety.ts` | `useTriggerSos` | `POST /safety/sos/trigger` | `safety/sos/trigger` | **high** |

### 3.4 Key Contract for `enqueue()`

The `offlineStore.enqueue()` method expects:

```typescript
offlineStore.enqueue({
  type: string;           // e.g. 'journal/create'
  data: Record<string, unknown>;  // The full request body
  tempId?: string;        // Client-generated UUID for optimistic UI + cascading deletes
  idempotencyKey?: string; // UUID for server dedup
  clientUpdatedAt: string; // ISO timestamp of when user performed the action
  priority: 'high' | 'normal'; // Used by sync engine ordering
});
```

The store generates: `id` (UUID), `createdAt` (ISO), `retryCount` (0), `maxRetries` (5).

#### 🟡 Critical: `generateId()` must be cryptographically unique

**Bad:** Simple timestamps or `Math.random()` can collide under rapid offline writes.
```typescript
// ❌ DANGEROUS — collision when user creates 2 entries quickly
let counter = 0;
function generateId() { return `temp_${Date.now()}_${counter++}`; }
```

**Good:** Use `crypto.randomUUID()` with RFC 4122 fallback.
```typescript
// ✅ SAFE — cryptographically unique (1 in 2^122 collision chance)
// File: src/services/utils/generateId.ts
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older Hermes/jsc engines
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
```

**Why this matters:** An ID collision means two different journal entries share the same `tempId`. When the sync engine processes the first one and cascading-deletes by `tempId`, the second entry gets silently deleted too — user loses data. With `crypto.randomUUID()`, this risk is negligible.

### 3.5 Optimistic Update Strategy

For "create" mutations: prepend the new item to the React Query cache immediately so the UI shows it right away. For "update" mutations: patch the item in the cache. For "delete" mutations: remove from cache.

```typescript
// Create — prepend
qc.setQueryData(queryKey, (old: any) => {
  if (!old) return [data];
  if (Array.isArray(old)) return [{ ...data, id: tempId, _optimistic: true }, ...old];
  return old;
});

// Update — patch
qc.setQueryData(queryKey, (old: any) => {
  if (!Array.isArray(old)) return old;
  return old.map((item: any) => item.id === id ? { ...item, ...data } : item);
});

// Delete — remove
qc.setQueryData(queryKey, (old: any) => {
  if (!Array.isArray(old)) return old;
  return old.filter((item: any) => item.id !== id);
});
```

### 3.6 Validation: Offline Write Flow

```
User (offline)
  → Types journal entry, taps Save
  → useMutation fires → API fails (NetworkError)
  → onError → isNetworkError = true
  → offlineStore.enqueue({ type: 'journal/create', data: {...}, ... })
  → Toast: "Saved offline — will sync when online"
  → qc.setQueryData(...) → Entry appears in list immediately
  → User closes app

User (later, online)
  → Opens app
  → App.tsx: NetInfo listener fires → syncAll()
  → syncEngine.pushOperations() → POST /sync/batch
  → Server creates entry → returns success
  → offlineStore.remove(id) — queue cleared
  → pullServerData() → invalidateQueries → fresh data from server
  → Entry now has real server ID, persistent
```

---

## 4. Phase 1b: Enable React Query Cache Persistence

### 4.1 Implementation

**File:** `src/app/providers.tsx`

```typescript
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create persister
const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'REACT_QUERY_OFFLINE_CACHE',
  throttleTime: 1000, // Debounce writes to storage
});

// QueryClient config (modify existing)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        const status = error?.response?.status;
        if (status === 401 || status === 404) return false;
        return failureCount < 2;
      },
      staleTime: 1000 * 60 * 5,    // 5 minutes (increased from 30s)
      gcTime: 1000 * 60 * 60 * 24, // 24 hours (increased from 5 min)
      networkMode: 'offlineFirst',  // Try cache first, then network
    },
    mutations: {
      retry: 0,
      networkMode: 'offlineFirst',
    },
  },
});

// Call persistQueryClient AFTER queryClient is created
persistQueryClient({
  queryClient,
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  // Whitelist: only persist these query keys
  buster: 'v1', // Bump to invalidate all cached data on schema change
});
```

### 4.2 Cache Whitelist

Only persist the following keys (most important for offline-first):

```typescript
const PERSIST_WHITELIST = [
  ['cycle', 'calendar'],
  ['cycle', 'predictions'],
  ['cycle', 'entries'],
  ['wellness', 'journal'],
  ['wellness', 'moodLogs'],
  ['wellness', 'breathing'],
  ['wellness', 'insights'],
  ['safety', 'contacts'],
  ['safety', 'activeSos'],
  ['safety', 'sosHistory'],
  ['pregnancy', 'profile'],
  ['pregnancy', 'dailyLogs'],
  ['pregnancy', 'milestones'],
  ['pregnancy', 'recommendations'],
];
```

#### 🟡 Clarity: Cache Whitelist Complexity — Two Approaches

`persistQueryClient` does not natively support whitelisting. You have two options:

**Option A (Recommended — simpler):** Skip the whitelist wrapper entirely. Rely on `gcTime: 24h` and `maxAge: 7 days`. Unused query keys naturally expire. This adds ~50KB of AsyncStorage overhead for non-essential keys — acceptable for most apps.

```typescript
// Simple — no wrapper needed
persistQueryClient({
  queryClient,
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days — everything expires
  buster: 'v1',
});
```

**Option B (Explicit — more control):** Wrap the persister to filter on write:

```typescript
const wrappedPersister = {
  ...asyncStoragePersister,
  persistClient: async (client: PersistedClient) => {
    const filtered = filterToWhitelist(client, PERSIST_WHITELIST);
    return asyncStoragePersister.persistClient(filtered);
  },
};
```

The `filterToWhitelist` implementation:

```typescript
function filterToWhitelist(client: PersistedClient, whitelist: string[][]): PersistedClient {
  const filtered: Record<string, any> = {};
  for (const [clientStateKey, clientState] of Object.entries(client.clientState)) {
    const queryKey = clientState?.state?.data?.queryKey;
    if (queryKey && whitelist.some(w => w.every((k, i) => k === (queryKey as any[])[i]))) {
      filtered[clientStateKey] = clientState;
    }
  }
  return { ...client, clientState: filtered };
}
```

**Recommendation:** Start with **Option A** (simpler). If AsyncStorage usage exceeds 2MB, switch to Option B. Document which keys are persisted in a comment so future developers know the contract.

### 4.3 Change `staleTime` and `gcTime` by Data Type

Not all data should refresh at the same rate. After Phase 1b, adjust per-query `staleTime`:

| Query Key | staleTime | Rationale |
|-----------|-----------|-----------|
| `['cycle', 'calendar']` | 5 min | Calendar rarely changes locally |
| `['cycle', 'predictions']` | 30 min | Predictions are computed server-side daily |
| `['wellness', 'journal']` | 1 min | User may create entries offline, want fresh on sync |
| `['wellness', 'moodLogs']` | 1 min | Same as journal |
| `['safety', 'contacts']` | 30 min | Contacts change infrequently |
| `['safety', 'activeSos']` | 30s | SOS status must be fresh (keep existing) |

### 4.4 Bump Strategy

The `buster` parameter (`'v1'`) should be bumped whenever:
- Backend API contract changes (new fields, removed fields)
- React Query major version upgrade
- Schema migration that changes data shape locally

Store the buster in a constant so it's easy to bump:

```typescript
const CACHE_BUSTER = 'v1'; // Bump this to invalidate all cached data
```

---

## 5. Sync Engine Validation

After Phases 1a and 1b, verify `syncEngine.ts` handles the queued operations correctly:

### 5.1 `pushOperations` Sequence

```
1. App comes online (NetInfo event)
2. App.tsx calls syncAll()
3. syncEngine.pushOperations(offlineStore.getPendingOperations())
4. POST /sync/batch with array of operations
5. For each result:
   - success (created/updated/deleted): store.remove(id)
   - conflict (409): server_data wins → overwrite local cache (see §5.3)
   - non-retryable error (400/401/404): store.discard(id)
   - retryable error (429/5xx): store.incrementRetry(id)
6. After push: pullServerData() → invalidateQueries
```

### 🟡 5.3 Critical: 409 Conflict + Optimistic Update Handshake

**The Scenario:**
1. User edits journal entry offline → optimistic update applies changes locally with `tempId`
2. User goes online → sync engine pushes the update
3. Server returns `409 Conflict` because a newer version exists (e.g., user also edited on web)
4. Sync engine must **overwrite the stale optimistic data** in the local React Query cache

**The Fix (in `syncEngine.ts`):**

```typescript
// When processing batch results — conflict branch:
if (result.status === 'conflict') {
  // 1. Remove the pending op from queue
  offlineStore.remove(id);

  // 2. OVERWRITE local cache with server data (prevents stale optimistic UI)
  //    The server returns the authoritative entity in result.server_data
  if (result.server_data && result.entity_id) {
    // Extract the query key prefix from the operation type
    // e.g. 'journal/update' → ['wellness', 'journal']
    const queryKey = inferQueryKey(op.type, result.entity_id);

    // Replace the cached entity with server's version
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      if (Array.isArray(old)) {
        return old.map((item: any) =>
          item.id === result.entity_id || item.id === op.tempId
            ? { ...result.server_data, _conflict_resolved: true }
            : item
        );
      }
      return old;
    });

    // 3. Invalidate related queries to ensure UI consistency
    queryClient.invalidateQueries({ queryKey: inferBaseQueryKey(op.type) });
  }
}
```

**Helper to infer query keys from operation types:**

```typescript
// src/services/sync/queryKeyMapper.ts
const TYPE_TO_QUERY_KEY: Record<string, string[]> = {
  'journal/create': ['wellness', 'journal'],
  'journal/update': ['wellness', 'journal'],
  'mood/create':    ['wellness', 'moodLogs'],
  'cycle/create':   ['cycle', 'entries'],
  'cycle/update':   ['cycle', 'entries'],
  'cycle/correction': ['cycle', 'calendar', 'cycle', 'predictions'],
  'cycle/snooze':   ['cycle', 'calendar'],
  'breathing/complete': ['wellness', 'breathing'],
  'safety/contact/create': ['safety', 'contacts'],
  'safety/contact/update': ['safety', 'contacts'],
  'safety/contact/delete': ['safety', 'contacts'],
  'safety/sos/trigger': ['safety', 'activeSos', 'safety', 'sosHistory'],
};

export function inferBaseQueryKey(type: string): string[] {
  return TYPE_TO_QUERY_KEY[type] ?? [];
}

export function inferQueryKey(type: string, entityId: string): string[] {
  const base = TYPE_TO_QUERY_KEY[type];
  if (!base) return [];
  // For entity-specific queries (e.g. ['wellness', 'journal', entityId])
  return [...base, entityId];
}
```

**Why this matters:** Without overwriting the cache, the user sees their outdated optimistic edit **even after the conflict is resolved**, until they manually refresh or pull-to-refresh. Users will report "my edit disappeared" or "the app is showing old data." The `_conflict_resolved: true` flag lets the UI show a subtle indicator ("This was updated from another device").

### 5.2 Edge Cases

| Case | Behavior |
|------|----------|
| Queue has 50 ops | Batched in single POST, gzip-compressed if >=10 |
| Operation fails 5 times | `maxRetries` reached → discarded automatically |
| Create then Update same entity | Sync engine preserves order (FIFO) |
| Delete before Create syncs | Server returns 404 on delete → discard both |
| Conflict on correction | Server data wins, local correction discarded |
| Auth token expired during sync | Sync fails, queue preserved, retry on next syncAll() |

---

## 6. Testing Validation

### 6.1 Unit Tests

- `isNetworkError()` resolves correctly for: `AxiosError` with no response, `TypeError`, 5xx, 4xx (should NOT be network error for 4xx)
- Each mutation hook calls `offlineStore.enqueue()` with correct shape when `isNetworkError` is true
- Each mutation hook does NOT enqueue when error is a 4xx validation error
- Optimistic updates correctly prepend/patch/remove data in cache

### 6.2 Manual Validation Checklist

| # | Test | Expected |
|---|------|----------|
| 1 | Turn off Wi-Fi. Write a journal entry. | "Saved offline" toast. Entry appears in list. |
| 2 | Turn off Wi-Fi. Log a mood. | "Saved offline" toast. Mood appears in history. |
| 3 | Turn off Wi-Fi. Trigger SOS. | "Saved offline" toast. SOS shows as active. |
| 4 | Turn on Wi-Fi. Wait 5s. | Queue drains. Data appears on server. |
| 5 | Force-quit app. Reopen. | Calendar loads instantly (no spinner). |
| 6 | Go offline. Open app. | Previously fetched data visible (from cache). |
| 7 | Write entry offline. Force-quit. Reopen online. | Entry syncs on reconnect. |
| 8 | Rapidly create 20 entries offline. Come online. | All 20 sync in one batch. |

#### 🟡 Pre-Merge: Conflict Resolution Validation

| # | Test | Expected |
|---|------|----------|
| **9** | Edit a journal entry offline. Before syncing, edit the same entry on the server (via curl or web). Go online. Sync happens. | The entry updates to the server version. The app shows the server's data. No infinite loading or stale optimistic data. The conflict is resolved silently. |
| **10** | Create entry 'A' offline (tempId=abc). Create entry 'B' offline (verify tempId is different). Go online. | Both entries sync successfully. Neither is lost. Verify with `crypto.randomUUID()` that IDs are unique. |

---

## 7. Rollback Plan

If Phase 1 introduces instability:

1. **Revert query hooks**: `git revert` changes to `src/services/queries/*.ts`
2. **Revert provider**: `git revert` changes to `src/app/providers.tsx`
3. The `offlineStore` and `syncEngine` remain unchanged (they already work independently)
4. App falls back to pre-Phase 1 behavior (online-only writes, in-memory cache)

No data loss risk: offline store uses EncryptedStorage which is never cleared by these changes. Even if hooks are reverted, queued operations remain safe in storage.

---

## 8. Deploy Gate

Must pass before merging Phase 1:

```bash
cd mobile
npx tsc --noEmit                              # TypeScript strict
npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'  # Test coverage
npx eslint src/services/queries/ src/app/providers.tsx  # Lint new code
```

Plus manual verification of the 8 tests in §6.2.
