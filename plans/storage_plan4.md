# Storage Plan 4: Sync Engine SQLite Integration

**Priority:** High (2 days)
**Dependencies:** Plan 2 (DB connection), Plan 3 (localDb services)
**Phase:** Phase 2 (SQLite Integration)

---

## 1. Objective

Update `syncEngine.ts` to hydrate SQLite on every successful push and every pull. After this plan, SQLite is the permanent offline archive — React Query cache is the fast "speed bump" in front of it.

---

## 2. Deliverables

| Deliverable | Output | Acceptance Criteria |
|-------------|--------|---------------------|
| 4a. Push hydration | `syncEngine.ts` — `pushOperations()` updated | After each successful POST, upsert server response into SQLite |
| 4b. Pull hydration | `syncEngine.ts` — `pullChanges()` updated | After successful GET /sync/changes, upsert all records into SQLite |
| 4c. Conflict resolution | `syncEngine.ts` — 409 handler updated | Overwrite SQLite with server payload on conflict |
| 4d. Migration backfill | `scripts/backfillSqlite.ts` or service | On first launch after migration, backfill SQLite from React Query cache |
| 4e. Sync metrics tracking | `syncMetricsStore` updated | Track SQLite write count, latency, errors |

---

## 3. Sub-tasks

### 3.1 Task 4a: Push Hydration

In `syncEngine.ts`, after a pending operation succeeds against the server, upsert the server's response into SQLite.

**Current flow (Phase 1):**

```
syncEngine.pushOperations() reads queue from EncryptedStorage
  → POST /sync/batch (or individual POST)
  → on 200: offlineStore.remove(op.id) + invalidate React Query
  → on 409: overwrite React Query cache with server_data
  → on 4xx/5xx: retry or discard
```

**Updated flow (Phase 2):**

```
syncEngine.pushOperations() reads queue from EncryptedStorage
  → POST /sync/batch (or individual POST)
  → on 200:
      1. offlineStore.remove(op.id)
      2. Upsert server response into SQLite ← NEW
      3. Invalidate React Query cache
  → on 409:
      1. Overwrite SQLite with server_data ← NEW
      2. offlineStore.discard(op.id)
      3. Overwrite React Query cache with server_data
  → on 4xx/5xx: retry or discard (unchanged)
```

**Implementation:**

```typescript
// Inside syncEngine.ts push loop
async function processOperation(op: OfflineQueueItem): Promise<void> {
  try {
    const response = await apiClient.post(op.endpoint, op.payload, {
      headers: { 'Idempotency-Key': op.idempotencyKey },
    });

    if (response.status === 200 || response.status === 201) {
      // Phase 2: Hydrate SQLite with server response
      await hydrateSqlite(op.entityType, response.data);
      offlineStore.remove(op.id);
      invalidateRelatedQueries(op);
    } else if (response.status === 409) {
      const serverData = response.data.server_data;
      await hydrateSqlite(op.entityType, serverData);
      offlineStore.discard(op.id);
      overwriteQueryCache(op, serverData);
      showToast("Updated from another device");
    }
  } catch (error) {
    handlePushError(op, error);
  }
}

async function hydrateSqlite(
  entityType: string,
  data: Record<string, any>
): Promise<void> {
  try {
    switch (entityType) {
      case 'cycle/create':
      case 'cycle/update':
        await localDb.cycle.upsert(data);
        break;
      case 'journal/create':
      case 'journal/update':
        await localDb.journal.upsert(data);
        break;
      case 'mood/create':
        await localDb.mood.upsert(data);
        break;
      case 'symptom/create':
        await localDb.symptom.upsert(data);
        break;
      default:
        logger.warn('Unknown entity type for SQLite hydration', { entityType });
    }
  } catch (error) {
    // Non-fatal — log to Sentry and continue
    logger.error('SQLite hydration failed on push success', { entityType, error });
    Sentry.captureException(error, {
      tags: { context: 'sync_push_hydration', entityType },
    });
  }
}
```

**Important:** `hydrateSqlite` is wrapped in try-catch and NEVER throws. If SQLite write fails, the sync operation still succeeds — the React Query cache will fill the gap until the next pull populates SQLite.

---

### 3.2 Task 4b: Pull Hydration

After `POST /sync/changes` (or `GET /sync/changes?since={timestamp}`), upsert all returned records into SQLite.

**Implementation:**

```typescript
// Inside syncEngine.ts pullChanges()
async function pullChanges(since: string): Promise<void> {
  try {
    const response = await apiClient.get('/sync/changes', {
      params: { since, limit: 100 },
    });

    const { changes, cursor } = response.data;

    // Phase 2: Hydrate SQLite
    await hydratePullResults(changes);

    // Update lastPull timestamp
    await storage.setItem('shecare.sync.lastPull', new Date().toISOString());

    // If more pages, recurse
    if (cursor) {
      await pullChanges(cursor);
    }
  } catch (error) {
    logger.error('Pull failed', error);
    // Non-fatal — next pull attempt will retry
  }
}

async function hydratePullResults(changes: PullChange[]): Promise<void> {
  // Group changes by entity type for batch upserts
  const groups: Record<string, any[]> = {};

  for (const change of changes) {
    if (change.type === 'delete') {
      await softDeleteFromSqlite(change.entityType, change.id);
      continue;
    }
    if (!groups[change.entityType]) groups[change.entityType] = [];
    groups[change.entityType].push(change.data);
  }

  // Batch upsert per entity type
  const promises = Object.entries(groups).map(([entityType, records]) => {
    switch (entityType) {
      case 'cycle': return localDb.cycle.upsertMany(records);
      case 'journal': return localDb.journal.upsertMany(records);
      case 'mood': return localDb.mood.upsertMany(records);
      case 'symptom': return localDb.symptom.upsertMany(records);
      default: return Promise.resolve();
    }
  });

  await Promise.allSettled(promises);
}
```

**Edge cases:**

- **Delete from server:** When a pull includes a `delete` change type, soft-delete the record in SQLite.
- **Duplicate on pull:** If a record already exists in SQLite (because push already hydrated it), the upsert is a no-op on conflict.
- **Large pull sets:** If the initial pull has thousands of records, chunk `hydratePullResults` into batches of 100 with `Promise.allSettled` to avoid blocking the JS thread.

---

### 3.3 Task 4c: Conflict Resolution (409)

When the server returns `409 Conflict`, the server's data is truth. Update the conflict handler:

```typescript
// In syncEngine.ts 409 handler
async function handleConflict(op: OfflineQueueItem, serverData: any): Promise<void> {
  // 1. Overwrite SQLite with server data
  await hydrateSqlite(op.entityType, serverData);

  // 2. Discard local pending operation
  offlineStore.discard(op.id);

  // 3. Overwrite React Query cache
  overwriteQueryCache(op, serverData);

  // 4. Notify user
  showToast('Updated from another device.');
}
```

**Note:** The toast is shown only once per session for conflicts, not once per conflicted operation. Track in a `Set` or a flag:

```typescript
let conflictToastShown = false;
function showConflictToast() {
  if (!conflictToastShown) {
    Toast.show({ type: 'info', text1: 'Updated from another device.' });
    conflictToastShown = true;
  }
}
```

---

### 3.4 Task 4d: Migration Backfill

When a user upgrades from Phase 1 (no SQLite) to Phase 2 (SQLite), there may be data in the React Query cache that should be backfilled into SQLite. Run this once after migration.

```typescript
// src/services/localDb/backfillSqlite.ts
import { queryClient } from '../../app/providers';
import { localDb } from './index';
import { logger } from '../../utils/logger';
import * as Sentry from '@sentry/react-native';

const BACKFILLED_KEY = 'shecare.sqlite.backfilled';

export async function backfillSqliteIfNeeded(): Promise<void> {
  try {
    const storage = await import('expo-secure-store');
    const alreadyBackfilled = await storage.getItemAsync(BACKFILLED_KEY);
    if (alreadyBackfilled === 'true') return;

    // Extract data from React Query cache
    const cacheKeys = [
      ['cycle', 'entries'],
      ['journal', 'entries'],
      ['mood', 'logs'],
      ['symptom', 'logs'],
    ];

    let totalRecords = 0;
    for (const key of cacheKeys) {
      const data = queryClient.getQueryData(key);
      if (Array.isArray(data) && data.length > 0) {
        await backfillEntity(key[0], data);
        totalRecords += data.length;
      }
    }

    await storage.setItemAsync(BACKFILLED_KEY, 'true');
    logger.info('SQLite backfill complete', { records: totalRecords });
  } catch (error) {
    logger.error('SQLite backfill failed', error);
    // Non-fatal — do not block app. Next pull will populate SQLite.
  }
}

async function backfillEntity(entityType: string, records: any[]): Promise<void> {
  switch (entityType) {
    case 'cycle': await localDb.cycle.upsertMany(records); break;
    case 'journal': await localDb.journal.upsertMany(records); break;
    case 'mood': await localDb.mood.upsertMany(records); break;
    case 'symptom': await localDb.symptom.upsertMany(records); break;
  }
}
```

Call this function once after migrations run, before React Query hydrates:

```typescript
// In _layout.tsx or providers.tsx
useEffect(() => {
  if (migrationSuccess) {
    backfillSqliteIfNeeded();
  }
}, [migrationSuccess]);
```

---

### 3.5 Task 4e: Sync Metrics Tracking

Update `syncMetricsStore` to track SQLite operations:

```typescript
// Additional fields in syncMetricsStore
interface SyncMetricsStore {
  // ...existing fields...
  sqliteWriteCount: number;
  sqliteWriteLatencyMs: number;
  sqliteErrors: number;
}

// Increment in hydrateSqlite:
const start = performance.now();
await localDb.cycle.upsert(data);
syncMetricsStore.getState().incrementSqliteWrite(performance.now() - start);
```

---

## 4. Testing

| Test | Method | What to Verify |
|------|--------|----------------|
| Push success hydrates SQLite | Integration test | `pushOperations()` with mock API → verify SQLite has the record |
| Push failure does NOT hydrate | Integration test | Mock 500 → verify SQLite is unchanged |
| 409 overwrites SQLite | Integration test | Mock 409 with `server_data` → verify SQLite has server_data, not local |
| Pull populates SQLite | Integration test | `pullChanges()` → verify all returned records in SQLite |
| Delete on pull | Integration test | Pull returns `delete` type → verify record is soft-deleted in SQLite |
| Backfill idempotent | Unit test | Run twice → second run is no-op |
| Backfill from empty cache | Unit test | No error when query cache has no data |
| Sync metrics updated | Unit test | After push, `sqliteWriteCount` incremented |
| Large pull chunked | Manual / profile | 1000 records → no main thread blocking |

---

## 5. Rollback

1. Revert all changes in `syncEngine.ts` to the Phase 1 code.
2. Do NOT remove SQLite records (they're harmless stale data).
3. Increment React Query buster to `'v2'` to force clean state.
4. Remove `backfillSqlite.ts` call from startup.

---

## 6. Success Criteria

- [ ] `pushOperations()` upserts SQLite after every 200/201 response
- [ ] `pushOperations()` overwrites SQLite after every 409 response
- [ ] `pullChanges()` upserts SQLite after every successful pull
- [ ] Pull `delete` type soft-deletes from SQLite
- [ ] `backfillSqliteIfNeeded()` runs once and populates SQLite from React Query cache
- [ ] All SQLite operations in sync engine are wrapped in try-catch (never throw)
- [ ] Sync metrics track SQLite write count + latency + errors
- [ ] Integration tests pass for all flows
