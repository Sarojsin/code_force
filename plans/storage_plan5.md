# Storage Plan 5: Read & Write Path Migration

**Priority:** High (2.5 days)
**Dependencies:** Plan 3 (localDb services), Plan 4 (sync engine hydration)
**Phase:** Phase 2 (SQLite Integration)

---

## 1. Objective

Update the TanStack Query hooks to use SQLite as an intermediate read layer, and update mutation hooks to upsert SQLite on server success. After this plan, every read path falls through to SQLite when the React Query cache is stale or missing, and every write path populates SQLite after server confirmation.

---

## 2. Deliverables

| Deliverable | Output | Acceptance Criteria |
|-------------|--------|---------------------|
| 5a. Read-through pattern | Refactored query hooks | Each hook checks RQ cache → SQLite → API |
| 5b. Write-through pattern | Refactored mutation hooks | Each mutation upserts SQLite after server 200 |
| 5c. Offline read fallback | Updated fallback logic | When SQLite returns empty and network is offline, show cached RQ data |
| 5d. Manual pull-to-refresh | Updated query hooks | Pull-to-refresh forces API fetch → SQLite upsert |

---

## 3. Sub-tasks

### 3.1 Task 5a: Read-Through Pattern

Every TanStack Query hook follows this pattern:

```
UI calls useQuery({ queryKey, queryFn })
  │
  ├── React Query cache (in-memory + AsyncStorage persist)
  │   └── if fresh (< staleTime: 5 min) → return instantly
  │
  ├── queryFn executes:
  │   ├── 1. Try SQLite first (localDb.cycle.getHistory())
  │   │   └── if data found → return it (React Query caches this return)
  │   │
  │   └── 2. If SQLite empty → fetch from API
  │       └── on success → upsert to SQLite + return
```

**Implementation pattern:**

```typescript
// src/services/queries/useCycleHistory.ts — REFACTORED

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { localDb } from '../localDb';
import { useAuthStore } from '../../stores/authStore';
import { logger } from '../../utils/logger';

export function useCycleHistory(options?: { months?: number; limit?: number }) {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ['cycle', 'entries', userId, options],
    queryFn: async () => {
      if (!userId) return [];

      // Step 1: Try SQLite first
      const local = await localDb.cycle.getHistory(userId, options);
      if (local.length > 0) {
        logger.debug('useCycleHistory: served from SQLite', { count: local.length });
        return local;
      }

      // Step 2: Fall through to API
      try {
        const response = await apiClient.get('/api/v1/cycles', {
          params: { user_id: userId, ...options },
        });
        const data = response.data.data ?? response.data;

        // Upsert to SQLite for next time
        await localDb.cycle.upsertMany(data);

        return data;
      } catch (error) {
        logger.error('useCycleHistory: API fetch failed', error);
        // Return empty — the UI shows skeleton/empty state
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    networkMode: 'offlineFirst',
    enabled: !!userId,
  });
}
```

**Key design decisions:**

- **SQLite is checked first** in the `queryFn`, not as a separate `placeholderData`. This means React Query's cache is populated FROM SQLite, keeping the cache as the fast path and SQLite as the backing store.
- **API fetch only happens if SQLite returns empty.** This means on a fresh install with no server data, the first load is slow (API). Every subsequent load (even after force-quit) is instant from SQLite.
- **`networkMode: 'offlineFirst'`** ensures that if the API call fails (network error), React Query does NOT mark the query as error — it keeps serving the stale data from the cache (which was populated from SQLite in step 1).

**Hooks to refactor:**

| Hook | SQLite Service Method | API Endpoint |
|------|----------------------|--------------|
| `useCycleCalendar` | `localDb.cycle.getByDateRange()` | `GET /api/v1/cycles` |
| `useCycleHistory` | `localDb.cycle.getHistory()` | `GET /api/v1/cycles` |
| `useJournalEntries` | `localDb.journal.getRecent()` | `GET /api/v1/journals` |
| `useMoodLogs` | `localDb.mood.getByDateRange()` | `GET /api/v1/moods` |
| `useSymptoms` | `localDb.symptom.getByCycleId()` | `GET /api/v1/symptoms` |
| `usePregnancyTimeline` | `localDb.pregnancy.getTimeline()` | `GET /api/v1/pregnancy/milestones` |
| `useHealthInsights` | `localDb.insight.getByUser()` | `GET /api/v1/insights` |
| `useFamilyMembers` | `localDb.family.getByUser()` | `GET /api/v1/family` |
| `useNotifications` | `localDb.notification.getByUser()` | `GET /api/v1/notifications` |
| `useUserProfile` | `localDb.userProfile.getById()` | `GET /api/v1/users/me` |
| `useFeatureFlags` | `localDb.featureFlag.getAll()` | `GET /api/v1/features` |

**Optimization:** For list hooks, the `queryKey` must include all filter params (months, limit, date range) because SQLite queries are parameterized. React Query's cache key ensures we don't re-query SQLite for the same params.

---

### 3.2 Task 5b: Write-Through Pattern

Every mutation hook follows this pattern:

```
User action → useMutation.mutate(data)
  │
  ├── 1. Optimistic update (React Query cache)
  │
  ├── 2. Enqueue to offlineStore (EncryptedStorage)
  │
  ├── 3. API POST/PUT (online) or queue (offline)
  │
  └── 4. On server SUCCESS:
       ├── offlineStore.remove()
       ├── Upsert SQLite ← NEW
       └── Invalidate React Query cache
```

**Implementation pattern:**

```typescript
// src/services/queries/useCreateJournalEntry.ts — REFACTORED

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  const offlineStore = useOfflineStore();
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (data: CreateJournalEntry) => {
      // Try API first
      try {
        const response = await apiClient.post('/api/v1/journals', data);
        return response.data.data ?? response.data;
      } catch (error) {
        if (isNetworkError(error)) {
          // If offline, queue it
          const op: OfflineQueueItem = {
            id: generateId(),
            type: 'journal/create',
            endpoint: '/api/v1/journals',
            payload: data,
            idempotencyKey: generateIdempotencyKey(),
            createdAt: new Date().toISOString(),
            retryCount: 0,
          };
          await offlineStore.enqueue(op);
          // Return optimistic data so UI updates
          return { ...data, id: `local_${op.id}`, synced: false };
        }
        throw error; // Real error, let RQ handle
      }
    },
    onSuccess: async (serverData) => {
      // Phase 2: Upsert to SQLite
      if (serverData.id && !serverData.id.startsWith('local_')) {
        await localDb.journal.upsert(serverData);
      }
      qc.invalidateQueries({ queryKey: ['journal', 'entries', userId] });
    },
    onError: (error) => {
      logger.error('useCreateJournalEntry failed', error);
      Toast.show({ type: 'error', text1: 'Failed to save journal entry' });
    },
  });
}
```

**Mutations to refactor:**

| Mutation | SQLite Action | API Endpoint |
|----------|--------------|--------------|
| `useCreateCycleEntry` | `localDb.cycle.upsert()` | `POST /api/v1/cycles` |
| `useUpdateCycleEntry` | `localDb.cycle.upsert()` | `PUT /api/v1/cycles/:id` |
| `useDeleteCycleEntry` | `localDb.cycle.softDelete()` | `DELETE /api/v1/cycles/:id` |
| `useCreateJournalEntry` | `localDb.journal.upsert()` | `POST /api/v1/journals` |
| `useUpdateJournalEntry` | `localDb.journal.upsert()` | `PUT /api/v1/journals/:id` |
| `useDeleteJournalEntry` | `localDb.journal.softDelete()` | `DELETE /api/v1/journals/:id` |
| `useCreateMoodLog` | `localDb.mood.upsert()` | `POST /api/v1/moods` |
| `useCreateSymptomLog` | `localDb.symptom.upsert()` | `POST /api/v1/symptoms` |
| `useUpdateProfile` | `localDb.userProfile.upsert()` | `PUT /api/v1/users/me` |
| `useMarkNotificationRead` | `localDb.notification.markRead()` | `PUT /api/v1/notifications/:id/read` |

**Optimistic data handling:** When offline, the created record has a local temp ID (`local_<uuid>`). The sync engine (Plan 4) replaces it with the server ID when it syncs. The `onSuccess` handler must handle both cases:

```typescript
onSuccess: (serverData) => {
  if (serverData.id && !serverData.id.startsWith('local_')) {
    // Real server data — upsert to SQLite
    await localDb.journal.upsert(serverData);
    // Replace temp ID in React Query cache with real ID
    updateTempIdInCache(tempId, serverData.id);
  }
  // If serverData has local_ prefix, it means it was queued offline.
  // SQLite will be populated when sync engine processes it.
}
```

---

### 3.3 Task 5c: Offline Read Fallback

Since `persistQueryClient` is removed (Plan 2), React Query's cache is purely in-memory and lost on app kill. This is intentional — SQLite is the permanent cache.

**Offline read flow:**

```
App launch → queryFn fires for mounted screens
  → Step 1: localDb queries SQLite
  │   └── If data found → return instantly. UI renders immediately.
  │
  └── Step 2: If SQLite empty → API fetch (will fail if offline)
      └── `networkMode: 'offlineFirst'` → React Query returns stale
           in-memory cache (if any from this session)
           OR returns empty → UI shows empty state
```

**Why this is safe:** SQLite is hydrated on every successful pull (Plan 4) and every successful push (Plan 4). On first install, SQLite is empty — the first load requires network. Every subsequent launch hits SQLite instantly. The only case where the user sees empty offline is:

1. Fresh install (no data anywhere) → expected, nothing to show.
2. SQLite corruption (logged to Sentry, toast shown) → fallback to React Query in-memory cache (current session only).

The "React Query persist cache" (AsyncStorage) no longer exists — removed in Plan 2 to eliminate the dual-cache conflict.

---

### 3.4 Task 5d: Pull-to-Refresh

Pull-to-refresh must bypass the cache and force an API fetch, then upsert to SQLite:

```typescript
// In useCycleHistory.ts
export function useCycleHistory(options?: { months?: number; limit?: number }) {
  const userId = useAuthStore((s) => s.user?.id);
  const queryKey = ['cycle', 'entries', userId, options];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchCycleHistory(userId, options),
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    networkMode: 'offlineFirst',
    enabled: !!userId,
  });

  const refresh = useCallback(async () => {
    // Force API fetch regardless of cache
    const data = await fetchCycleHistoryFromApi(userId, options);
    await localDb.cycle.upsertMany(data);
    // Update query cache
    queryClient.setQueryData(queryKey, data);
  }, [userId, options]);

  return { ...query, refresh };
}
```

---

## 4. Testing

| Test | Method | What to Verify |
|------|--------|----------------|
| Read-through SQLite hit | Integration test | Mock SQLite returns data → query returns immediately, no API call |
| Read-through SQLite miss → API | Integration test | Mock SQLite empty, mock API returns data → query returns API data, SQLite upserted |
| Read-through API failure | Integration test | Mock SQLite empty, mock API error → query returns empty, no crash |
| Write-through upserts SQLite | Integration test | Mutation success → verify SQLite has record |
| Write-through offline queue | Integration test | Mock network error → operation queued, not lost |
| Offline fallback with no SQLite | Integration test | Both SQLite and API empty/offline → returns cached RQ data |
| Pull-to-refresh forces API | Integration test | `refresh()` called → API hit even with fresh SQLite data |
| Offline read with empty SQLite | Integration test | SQLite empty + API offline → query returns `[]`, no crash |

---

## 5. Rollback

1. Revert query hooks to Phase 1 code (remove SQLite `queryFn` logic).
2. Revert mutation hooks to Phase 1 code (remove `localDb` call in `onSuccess`).
3. Re-add `persistQueryClient` and AsyncStorage persister.
4. Increment React Query buster to `'v2'`.

---

## 6. Success Criteria

- [ ] All 11 query hooks refactored to check SQLite before API
- [ ] All mutation hooks refactored to upsert SQLite on server success
- [ ] SQLite read-through never throws — returns `[]` on failure
- [ ] SQLite write-through never throws — logs to Sentry on failure
- [ ] Offline fallback preserves last-known-good data from React Query cache
- [ ] Pull-to-refresh forces API fetch + SQLite upsert
- [ ] No AsyncStorage React Query persist cache exists (removed in Plan 2)
- [ ] All tests pass
