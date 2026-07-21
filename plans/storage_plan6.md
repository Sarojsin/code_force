# Storage Plan 6: Zustand Store Migration, Cleanup & Testing

**Priority:** Medium (2 days)
**Dependencies:** Plan 3 (localDb services), Plan 4 (sync engine), Plan 5 (read/write paths)
**Phase:** Phase 2 (SQLite Integration)

---

## 1. Objective

Migrate Zustand stores that currently persist large datasets to AsyncStorage so they instead read from SQLite. Clean up obsolete AsyncStorage keys. Add end-to-end integration tests that verify the full Phase 2 storage architecture works correctly across all layers.

---

## 2. Deliverables

| Deliverable | Output | Acceptance Criteria |
|-------------|--------|---------------------|
| 6a. Store audit | `docs/storage_store_audit.md` | Every Zustand store documented: persist strategy, data size, migration path |
| 6b. Migrated stores | Updated `src/stores/` | Stores that cache server data now read from SQLite instead of persisted AsyncStorage |
| 6c. Obsolete key cleanup | Migration script | Old AsyncStorage keys deleted after successful migration |
| 6d. Integration tests | `src/__tests__/storage_integration.test.ts` | Full round-trip: write → sync → SQLite → read, with offline scenarios |

---

## 3. Sub-tasks

### 3.1 Task 6a: Audit All Zustand Stores

**Current stores:**

| Store | File | Persist? | Key | Data Size | Holds Server Data? |
|-------|------|----------|-----|-----------|-------------------|
| `authStore` | `src/stores/authStore.ts` | Yes (EncryptedStorage) | `shecare.user`, `shecare.accessToken`, `shecare.refreshToken` | Small (< 5KB) | Yes (user profile + tokens) |
| `offlineStore` | `src/stores/offlineStore.ts` | Yes (EncryptedStorage) | `shecare.offline.queue` | Variable (queue items) | No (pending operations) |
| `cycleStore` | `src/stores/cycleStore.ts` | Yes (AsyncStorage) | `shecare.cycle` | Medium (cache of cycle data) | Yes |
| `endDateStore` | `src/stores/endDateStore.ts` | Yes (AsyncStorage) | `shecare.end_date_pending` | Small (< 1KB) | Yes |
| `onboardingStore` | `src/stores/onboardingStore.ts` | Yes (AsyncStorage) | `shecare.onboarding` | Small (< 5KB) | No (UI state only) |
| `syncMetricsStore` | `src/stores/syncMetricsStore.ts` | Yes (AsyncStorage) | `shecare.sync.metrics` | Small (< 1KB) | No (analytics) |
| `safetyStore` | `src/stores/safetyStore.ts` | No (in-memory only) | — | Small (< 1KB) | No (session state) |

**Migration decisions:**

| Store | Action | Rationale |
|-------|--------|-----------|
| `authStore` | KEEP EncryptedStorage persist | Auth tokens are sensitive — must stay in EncryptedStorage. User profile should be hydrated from SQLite on app launch. |
| `offlineStore` | KEEP EncryptedStorage persist | The write queue is the source of truth for pending operations — must survive app kill. |
| `cycleStore` | REMOVE AsyncStorage persist → read from SQLite | Cycle data is server data — SQLite is the permanent offline cache. The store becomes in-memory only (session caching of SQLite results). |
| `endDateStore` | REMOVE AsyncStorage persist → keep in-memory | End-date data is small and transient. Store in SQLite via the cycle entry itself (period_end_date is a field on cycle_entries). |
| `onboardingStore` | KEEP AsyncStorage persist (but reduce) | Onboarding UI state is small and should survive app kill. However, completed onboarding status is also on the server — hydrate from API on login. |
| `syncMetricsStore` | KEEP AsyncStorage persist | Sync metrics are small analytics values that should survive app kill. |
| `safetyStore` | KEEP in-memory only | SOS state is session-only. |

---

### 3.2 Task 6b: Migrate Stores

**Pattern for migrated stores** (e.g., `cycleStore`):

**Before (Phase 1):**

```typescript
// src/stores/cycleStore.ts
interface CycleStore {
  entries: CycleEntry[];
  lastFetch: string | null;
  setEntries: (entries: CycleEntry[]) => void;
  addEntry: (entry: CycleEntry) => void;
}

export const useCycleStore = create<CycleStore>()(
  persist(
    (set) => ({
      entries: [],
      lastFetch: null,
      setEntries: (entries) => set({ entries, lastFetch: new Date().toISOString() }),
      addEntry: (entry) =>
        set((s) => ({ entries: [...s.entries, entry] })),
    }),
    {
      name: 'shecare.cycle',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

**After (Phase 2):**

```typescript
// src/stores/cycleStore.ts — IN-MEMORY ONLY
import { localDb } from '../services/localDb';

interface CycleStore {
  // No persisted data — reads go through React Query → SQLite
  // Store is for UI ephemeral state only
  selectedEntryId: string | null;
  isCreatingEntry: boolean;
  setSelectedEntryId: (id: string | null) => void;
  setIsCreatingEntry: (value: boolean) => void;
}

export const useCycleStore = create<CycleStore>()((set) => ({
  selectedEntryId: null,
  isCreatingEntry: false,
  setSelectedEntryId: (id) => set({ selectedEntryId: id }),
  setIsCreatingEntry: (value) => set({ isCreatingEntry: value }),
}));
```

**Data migration for `cycleStore`:** Before removing the persist middleware, extract the persisted data and upsert it into SQLite:

```typescript
// src/services/localDb/migrateStoreData.ts
export async function migrateStoreDataToSqlite(): Promise<void> {
  try {
    // Migrate cycleStore
    const cycleData = await AsyncStorage.getItem('shecare.cycle');
    if (cycleData) {
      const parsed = JSON.parse(cycleData);
      if (parsed.state?.entries?.length > 0) {
        await localDb.cycle.upsertMany(parsed.state.entries);
      }
      await AsyncStorage.removeItem('shecare.cycle');
    }

    // Migrate endDateStore
    const endDateData = await AsyncStorage.getItem('shecare.end_date_pending');
    if (endDateData) {
      const parsed = JSON.parse(endDateData);
      if (parsed.state?.entry) {
        await localDb.cycle.upsert(parsed.state.entry);
      }
      await AsyncStorage.removeItem('shecare.end_date_pending');
    }

    logger.info('Migrated store data to SQLite');
  } catch (error) {
    logger.error('Store data migration failed', error);
    // Non-fatal — data is still in AsyncStorage, which React Query persist can still read
  }
}
```

Run this once at app startup, after the SQLite migration completes:

```typescript
// In _layout.tsx
if (migrationSuccess) {
  await migrateStoreDataToSqlite();
  await backfillSqliteIfNeeded(); // from Plan 4
}
```

---

### 3.3 Task 6c: Clean Up Obsolete AsyncStorage Keys

After all stores are migrated and data is safely in SQLite, purge the old keys.

```typescript
// src/services/localDb/cleanupObsoleteKeys.ts
const OBSOLETE_KEYS = [
  'shecare.cycle',          // Now in SQLite
  'shecare.end_date_pending', // Now in SQLite
  // Keep these:
  // 'shecare.onboarding'     — UI state, stays in AsyncStorage
  // 'shecare.sync.metrics'   — analytics, stays in AsyncStorage
  // 'REACT_QUERY_OFFLINE_CACHE' — RQ persist, stays until we move to SQLite-backed RQ
];

export async function cleanupObsoleteKeys(): Promise<void> {
  try {
    for (const key of OBSOLETE_KEYS) {
      await AsyncStorage.removeItem(key);
    }
    logger.info('Cleaned up obsolete AsyncStorage keys', { keys: OBSOLETE_KEYS });
  } catch (error) {
    logger.error('AsyncStorage cleanup failed', error);
    // Non-fatal
  }
}
```

Call after migration:

```typescript
if (migrationSuccess) {
  await migrateStoreDataToSqlite();
  await cleanupObsoleteKeys();
}
```

---

### 3.4 Task 6d: Integration Tests

Write a comprehensive integration test that validates the full Phase 2 storage architecture.

```typescript
// src/__tests__/storage_integration.test.ts

import { localDb } from '../services/localDb';
import { offlineStore } from '../stores/offlineStore';
import { syncEngine } from '../services/sync/syncEngine';
import { queryClient } from '../app/providers';
import { storage } from '../services/storage';

/**
 * Storage Integration Test Suite
 *
 * Tests the full stack:
 *   Write → Offline Queue → Server (mock) → SQLite → Read
 *
 * Each test starts with a fresh in-memory SQLite database
 * and a clean offline queue.
 */

describe('Phase 2 Storage Integration', () => {
  // Set up in-memory SQLite, mock API, clean stores
  // (fixture setup omitted for brevity — see test helpers)

  describe('Full write-sync-read round trip (online)', () => {
    it('writes to API → upserts SQLite → React Query can read from SQLite', async () => {
      // 1. User creates a journal entry (mutation hook)
      const entry = createMockJournalEntry();
      const serverResponse = { ...entry, id: 'server-uuid-123' };

      // 2. Mock API returns 200
      mockApi.post('/api/v1/journals').mockResolvedValue({
        status: 200,
        data: { data: serverResponse },
      });

      // 3. Execute mutation (simulating useCreateJournalEntry)
      const result = await apiClient.post('/api/v1/journals', entry);
      await localDb.journal.upsert(result.data.data);

      // 4. Verify SQLite has the record
      const sqliteRecord = await localDb.journal.getById('server-uuid-123');
      expect(sqliteRecord).toMatchObject(serverResponse);

      // 5. Verify React Query can read it (via refactored query hook)
      queryClient.setQueryData(['journal', 'entries', 'user-1'], [serverResponse]);
      const cachedData = queryClient.getQueryData(['journal', 'entries', 'user-1']);
      expect(cachedData).toHaveLength(1);
    });
  });

  describe('Offline write queue → sync → SQLite', () => {
    it('queues offline writes, syncs when online, hydrates SQLite', async () => {
      // 1. User creates entry while OFFLINE
      const entry = createMockJournalEntry();
      await offlineStore.enqueue({
        type: 'journal/create',
        endpoint: '/api/v1/journals',
        payload: entry,
        id: 'op-1',
        idempotencyKey: 'ik-1',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });

      // 2. Verify queue has the operation
      expect(await offlineStore.getAll()).toHaveLength(1);

      // 3. Mock server comes back online, sync engine runs
      const serverResponse = { ...entry, id: 'server-uuid-456' };
      mockApi.post('/api/v1/journals').mockResolvedValue({
        status: 200,
        data: { data: serverResponse },
      });

      await syncEngine.pushOperations();

      // 4. Verify queue is empty
      expect(await offlineStore.getAll()).toHaveLength(0);

      // 5. Verify SQLite has the record
      const sqliteRecord = await localDb.journal.getById('server-uuid-456');
      expect(sqliteRecord).toMatchObject(serverResponse);
    });
  });

  describe('Conflict resolution (409)', () => {
    it('overwrites SQLite with server data on conflict', async () => {
      // 1. Local SQLite has record A
      const localRecord = createMockCycleEntry({ id: 'cycle-1', period_start_date: '2026-01-15' });
      await localDb.cycle.upsert(localRecord);

      // 2. Sync engine tries to push local update, server returns 409 with server's version
      const serverRecord = createMockCycleEntry({ id: 'cycle-1', period_start_date: '2026-02-01' });
      mockApi.put('/api/v1/cycles/cycle-1').mockResolvedValue({
        status: 409,
        data: { server_data: serverRecord, conflict_reason: 'updated_by_other_device' },
      });

      await offlineStore.enqueue({
        type: 'cycle/update',
        endpoint: '/api/v1/cycles/cycle-1',
        payload: localRecord,
        id: 'op-2',
        idempotencyKey: 'ik-2',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });

      await syncEngine.pushOperations();

      // 3. Verify SQLite now has the server's version
      const sqliteRecord = await localDb.cycle.getById('cycle-1');
      expect(sqliteRecord?.period_start_date).toBe('2026-02-01');
    });
  });

  describe('Read path: SQLite hit vs. miss', () => {
    it('returns SQLite data when cache is empty', async () => {
      // 1. SQLite has data
      const entry = createMockCycleEntry({ id: 'cycle-2' });
      await localDb.cycle.upsert(entry);

      // 2. Clear React Query cache
      queryClient.clear();

      // 3. Execute query (simulating useCycleHistory)
      const result = await localDb.cycle.getHistory('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cycle-2');
    });

    it('returns empty array when SQLite has no data and API is offline', async () => {
      // 1. SQLite is empty
      // 2. Mock API returns network error
      mockApi.get('/api/v1/cycles').mockRejectedValue(new Error('Network error'));

      // 3. Execute query
      const result = await localDb.cycle.getHistory('user-1');
      expect(result).toEqual([]); // Graceful fallback
    });
  });

  describe('Soft delete awareness', () => {
    it('excludes soft-deleted records from queries', async () => {
      const entry = createMockCycleEntry({ id: 'cycle-3' });
      await localDb.cycle.upsert(entry);
      await localDb.cycle.softDelete('cycle-3');

      const result = await localDb.cycle.getHistory('user-1');
      expect(result).toHaveLength(0);
    });
  });
});
```

**Coverage target:** 85%+ across all storage integration paths.

---

## 4. Testing

| Test | Method | What to Verify |
|------|--------|----------------|
| Store data migration | Integration test | Old AsyncStorage `shecare.cycle` data → `migrateStoreDataToSqlite()` → SQLite has records → AsyncStorage key deleted |
| Obsolete key cleanup | Integration test | `cleanupObsoleteKeys()` → old keys removed, new keys preserved |
| Full round-trip online | Integration test | Write → API 200 → SQLite → read via query hook |
| Full round-trip offline then sync | Integration test | Write → queue → reconnect → sync → SQLite → read |
| Conflict resolution | Integration test | Local + server diverge → 409 → SQLite has server version |
| Store without persist | Unit test | `cycleStore` after migration — no persist middleware, in-memory only |
| Auth store unchanged | Unit test | `authStore` still persists to EncryptedStorage |
| SOS safety store unchanged | Unit test | `safetyStore` still in-memory only |

---

## 5. Rollback

1. Restore Zustand persist middleware in `cycleStore` and `endDateStore`.
2. Re-add AsyncStorage persist config.
3. Do NOT delete SQLite data (it's a read-only cache).
4. Increment React Query buster to `'v2'`.

---

## 6. Success Criteria

- [ ] All 7 Zustand stores audited in `docs/storage_store_audit.md`
- [ ] `cycleStore` migrated to in-memory only (no AsyncStorage persist)
- [ ] `endDateStore` migrated to in-memory only
- [ ] `authStore` unchanged (still EncryptedStorage)
- [ ] `offlineStore` unchanged (still EncryptedStorage)
- [ ] `safetyStore` unchanged (still in-memory only)
- [ ] `onboardingStore` unchanged (still AsyncStorage, but reviewed)
- [ ] `syncMetricsStore` unchanged (still AsyncStorage)
- [ ] `migrateStoreDataToSqlite()` extracts old AsyncStorage data into SQLite
- [ ] `cleanupObsoleteKeys()` removes `shecare.cycle` and `shecare.end_date_pending` from AsyncStorage
- [ ] SQLite pruning documented in `docs/storage_pruning_strategy.md`
- [ ] Integration tests pass for all flows (online, offline, conflict, soft-delete, migration)
- [ ] Coverage ≥ 85% on integration tests

---

## 7. Appendix: SQLite Pruning Strategy (Post-V1)

This is **not required for V1** — it's a future optimization. SQLite handles tens of thousands of rows without issue. Documented here so the architecture accounts for it.

### 7.1 Why Prune?

- Soft-deleted records accumulate in tables (`is_active = false`, `deleted_at` set). Over years of use, these outnumber active records.
- Journal entries contain large text bodies. A user who journals daily for 5 years will have ~1,825 journal entries averaging ~500 bytes each. Not a problem.
- However, if a daily mood log + symptom log + cycle entry + journal entry = ~4 rows/day, a 10-year user has ~14,600 rows. Still fine for SQLite.
- The real concern is **deleted records** — a user who bulk-deletes old cycles leaves soft-deleted records that are never cleaned up.

### 7.2 Pruning Rules (Post-V1)

| Action | Target | Criteria | Frequency |
|--------|--------|----------|-----------|
| **Hard-delete** | Soft-deleted records | `deleted_at < NOW() - 90 days` AND server confirmed deletion | Monthly |
| **Archive (optional)** | Old journal entries | `created_at < NOW() - 2 years` move to `journal_archive` table | Monthly |
| **Reindex** | All tables | `PRAGMA optimize` or `REINDEX` | Monthly |
| **Vacuum** | Database file | When `VACCUM` needed after large delete | After hard-delete batch |

### 7.3 Implementation Sketch

```typescript
// src/services/localDb/pruneSqlite.ts
export async function pruneSqlite(): Promise<void> {
  const db = getDb();

  // 1. Hard-delete soft-deleted records older than 90 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString();

  const tables = ['cycle_entries', 'journal_entries', 'mood_logs', 'symptom_logs'];
  for (const table of tables) {
    await db.delete(table)
      .where(and(
        eq(table.is_active, false),
        lt(table.deleted_at, cutoffStr)
      ));
  }

  // 2. Reindex
  await db.run(sql`PRAGMA optimize`);

  logger.info('SQLite pruning complete');
}
```

### 7.4 Trigger

Run pruning as part of the sync engine's periodic maintenance:

```typescript
// In syncEngine.ts, called once per month or on app launch if >30d since last prune
async function runMaintenance(): Promise<void> {
  const lastPrune = await AsyncStorage.getItem('shecare.sqlite.lastPrune');
  if (lastPrune && Date.now() - new Date(lastPrune).getTime() < 30 * 24 * 60 * 60 * 1000) {
    return; // Already pruned within 30 days
  }
  await pruneSqlite();
  await AsyncStorage.setItem('shecare.sqlite.lastPrune', new Date().toISOString());
}
```

### 7.5 What NOT to Prune

- **Active records** — never prune records where `is_active = true`.
- **Cycle entries less than 2 years old** — needed for ML prediction accuracy.
- **Mood logs** — keep indefinitely (tiny rows, high analytical value).
- **Symptom logs** — keep indefinitely (tiny rows, high analytical value).
