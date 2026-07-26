# Scenario 30: Returning User — Offline (SQLite has data, AsyncStorage is cleared) — Detailed Explanation

This scenario validates the "Single Source of Truth" principle of the Phase 2 architecture. It specifically tests the removal of `persistQueryClient` and confirms that React Query no longer relies on a volatile, stale AsyncStorage cache that could override or bypass the permanent SQLite archive.

---

## 1. The Problem: The "Ghost Cache" Conflict (The Phase 1 Bug)

| Challenge | Description |
|-----------|-------------|
| The Phase 1 Anti-Pattern (Removed) | React Query used `persistQueryClient` to store the cache in AsyncStorage. When the app launched, it would hydrate the in-memory cache from AsyncStorage before executing the `queryFn`. |
| The "Stale Bypass" Bug | If AsyncStorage had data (e.g., from 7 days ago), React Query would mark it as "fresh" (due to `staleTime: 5 min`) and never call the `queryFn`—which was supposed to read from the up-to-date SQLite database. |
| The Risk | A returning user would see 7-day-old stale data (AsyncStorage) instead of the fresh data in SQLite, even though they were offline. The `queryFn` was completely bypassed. |

**The Golden Rule (Phase 2):** With `persistQueryClient` removed, React Query's cache is purely in-memory. It is wiped on app kill. On every app launch, the `queryFn` must execute, and its primary source is SQLite. No AsyncStorage ghost can override it.

---

## 2. The Architecture: The Single Source of Truth

| Layer | State in this Scenario | Role |
|-------|------------------------|------|
| EncryptedStorage (SecureStore) | Contains Auth Tokens. The user is logged in. | Keeps the user authenticated. |
| AsyncStorage (Deprecated for RQ) | Cleared (or empty). `REACT_QUERY_OFFLINE_CACHE` is deleted. | Ignored. The app does not read or write React Query data here. |
| SQLite (Permanent Cache) | Contains 6 months of history. All cycles, journals, and moods are present. | The Source of Truth for offline reads. |
| React Query (In-Memory) | Empty (on fresh app start). | Fetches data from SQLite via the `queryFn` and caches it ephemerally for the session. |

---

## 3. Step-by-Step System Behavior

### Step 3A: Pre-Condition (The "Good State")

**User Action:** The user logs in (online), syncs their account.

1. **Server Sync:** The `syncEngine.pullServerData()` fetches 6 months of cycle history from the server.
2. **SQLite Hydration:** The pull handler calls `localDb.cycle.upsertMany(serverData)`.
3. **Result:** SQLite (`shecare.db`) now contains 6 months of historical period data.

---

### Step 3B: The Cache Clearance (Simulating Phase 2 Removal)

**Action:** The user (or the developer) manually clears AsyncStorage. This is equivalent to the Phase 2 code change that removes `persistQueryClient` entirely.

**Result:** The `REACT_QUERY_OFFLINE_CACHE` key is deleted. React Query no longer has a pre-seeded cache to hydrate from.

---

### Step 3C: The Offline Launch

**User Action:** Turn off Wi-Fi/Airplane mode. Force-quit the app (to ensure the in-memory React Query cache is completely cleared). Reopen the app.

1. **Auth Hydration:** `authStore.hydrate()` reads the token from EncryptedStorage (works offline). `user` is set. The app navigates to the Main Dashboard.

---

### Step 3D: The Query Execution (The Critical Path)

1. **UI Mounts:** `useCycleHistory` fires inside the Dashboard.
2. **React Query State:** The in-memory cache is empty. There is no data from a previous session.
3. **Query Function Execution (The `queryFn`):** Since the cache is empty and `staleTime` has not applied (because there is no stale data to compare to), React Query executes the `queryFn`.
4. **Read from SQLite:** The `queryFn` calls `localDb.cycle.getHistory()`.
5. **SQLite Response:** SQLite returns the 6 months of history immediately (< 50ms).
6. **Return to React Query:** The `queryFn` returns the SQLite data. React Query stores it in its in-memory cache for the current session.
7. **UI Render:** The UI renders the data instantly.

---

### Step 3E: The "Stale Cache" Bug (Why it's dead)

| Phase | Bug Scenario (Phase 1) | Correct Scenario (Phase 2) |
|-------|------------------------|---------------------------|
| App Launch | React Query hydrates from AsyncStorage (7-day-old data). | React Query in-memory cache is empty. |
| Query Execution | `staleTime: 5 min` kicks in. The `queryFn` is NOT called. AsyncStorage data is served. | `queryFn` IS called because there is no cached data to serve. |
| Source of Truth | AsyncStorage (7-day-old) is shown. | SQLite (6-months-old) is shown. |
| User Experience | User sees data from last week, thinking they are up-to-date. | User sees 6 months of complete history instantly. |

---

## 4. The User Experience (What the User Sees)

| Phase | UI State | User Perception |
|-------|----------|-----------------|
| App Launch | Splash Screen appears. | "The app is loading." |
| Post-Launch (Offline) | The Dashboard renders immediately. The calendar shows all 6 months of Dark Pink blocks. | "All my data is here, even without internet." |
| Force-Quit & Reopen | The same instant load happens again. No AsyncStorage dependency means no cache-clearing issues. | "The app is always fast." |

---

## 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ SQLite is the sole source. | 1. Log in online, sync history.<br>2. Clear AsyncStorage (or uninstall `persistQueryClient` dependencies).<br>3. Go offline.<br>4. Reopen the app.<br>5. The UI should show the historical data instantly. | Proves that the `queryFn` is correctly reading from SQLite and that the app is not falling back to a stale AsyncStorage cache. |
| ✅ No stale cache override. | 1. After clearing AsyncStorage, check the React Query Devtools (or console log the data). The data should be the exact data from SQLite, not a placeholder or mocked value. | Proves that the `persistQueryClient` hydration logic is completely bypassed, eliminating the "7-day stale" bug. |
| ✅ Cache is in-memory only. | 1. Log in online and load data.<br>2. Force-quit the app.<br>3. Reopen the app.<br>4. Check AsyncStorage. The `REACT_QUERY_OFFLINE_CACHE` key should NOT exist (or contain React Query data). | Proves that React Query is not persisting its cache to disk, ensuring the `queryFn` runs on every launch (guaranteeing fresh reads from SQLite). |

---

## 6. Why This Matters (The Business Logic)

| Without Removing RQ Persist (Phase 1) | With RQ Persist Removed (Phase 2) |
|----------------------------------------|-----------------------------------|
| AsyncStorage (7-day cache) overrides SQLite. User sees stale data for up to 5 minutes (due to `staleTime`). | SQLite (permanent archive) is the immediate source. Data is never more than the user's last sync. |
| If the user clears app cache, AsyncStorage is wiped, and the app reverts to a blank state (even though SQLite has data). | Clearing AsyncStorage has zero effect on the offline experience because SQLite is the primary source. |
| Developers maintain two conflicting caches (AsyncStorage + SQLite). This leads to bugs and confusion. | A single, clean data pipeline: Write → EncryptedStorage → Server → SQLite → Read. |

---

## 7. Summary

This scenario is the definitive proof that the Phase 2 architecture works as intended. By removing `persistQueryClient`:

- AsyncStorage is no longer a source of truth for React Query. It is relegated to minor UI state (if at all).
- SQLite is the sole permanent cache. Every offline read hits SQLite directly.
- The "Stale Cache" bug is dead. The `queryFn` must execute on every app launch, guaranteeing that the user sees the most up-to-date local data.
- Offline-first is truly achieved. Returning users see their entire historical archive instantly, without any dependency on a fragile, volatile, network-dependent AsyncStorage cache.

This is the foundational shift that makes your app reliable for users in rural Nepal who may not have internet for weeks at a time. 🌸📱💾

---

# Scenario 31: Background API Refresh — UI Updates Silently — Detailed Explanation

This scenario validates the "Stale-While-Revalidate" (SWR) pattern, which is the crown jewel of your offline-first architecture. It proves that the app can reconcile multi-device changes (e.g., the user logs a period on their iPad, and later opens the app on their iPhone) without any user interaction, loading spinners, or UI flicker.

The user opens the app, sees their data instantly, and the app silently refreshes the cache in the background. The user's only perception is that the data "magically" appears to be up-to-date.

---

## 1. The Problem: The Multi-Device Consistency Challenge

| Challenge | Description |
|-----------|-------------|
| Device A (iPad - Online) | User logs a period. The server (PostgreSQL) is updated. |
| Device B (iPhone - Offline/Stale) | The iPhone has SQLite data from 2 days ago. It does NOT have the period logged on the iPad. |
| User Action (Now) | The user opens the iPhone app (online). They expect to see the period they logged on the iPad. |
| The Risk (The "Flash" Trap) | If the app waits for the API response before showing any data, the user will see a loading spinner for 1-3 seconds. If the API fails, they see nothing. |

**The Golden Rule:** Never show a loading spinner for data you already have. Show the stale data instantly, and update it silently when the network responds.

---

## 2. The Architecture: The SWR Pattern in React Query

| Component | Role |
|-----------|------|
| SQLite (Permanent Cache) | Holds the 2-day-old data. Provides the instant render (< 50ms). |
| React Query (In-Memory) | Holds the SQLite data after the `queryFn` returns. Manages the "stale" state. |
| Background API Call (Fire-and-Forget) | Fetches the latest data from the server without blocking the `queryFn` return. |
| `queryClient.invalidateQueries()` | Triggers a background re-fetch of the `queryFn` after the API call updates SQLite. |

---

## 3. Step-by-Step System Behavior

### Step 3A: Pre-Condition (The "Stale" State)

- **Device A (iPad):** Logs a new period on June 20.
- **Device B (iPhone):** Last synced on June 18. SQLite has data up to June 18, but not June 20.
- **User Action:** The user opens the iPhone app (online).

---

### Step 3B: Step 1 — The Instant UI Render (SQLite)

1. **UI Mounts:** `useCycleHistory` fires on the Dashboard.
2. **React Query Check:** The in-memory cache is empty (fresh app launch, or cache expired).
3. **Query Function Execution:** The `queryFn` is called synchronously.

```typescript
const localData = await localDb.cycle.getHistory(userId); // < 50ms
return localData;
```

4. **Result:** SQLite returns the 2-day-old history (missing June 20).
5. **UI Render:** The UI renders the stale data instantly (< 50ms). The user sees the calendar.

---

### Step 3C: Step 2 — The Background API Call (Fire-and-Forget)

**Crucially:** The `queryFn` does NOT await the API call.

```typescript
// Inside the queryFn
// 1. Read SQLite first (synchronous return)
const localData = await localDb.cycle.getHistory(userId);

// 2. Fire the API call in the background (fire-and-forget)
apiClient.get('/api/v1/cycles', { params: { user_id: userId } })
  .then(async (response) => {
    const freshData = response.data.data;
    if (freshData.length > 0) {
      // Step 3
      await localDb.cycle.upsertMany(freshData);
      // Step 4
      queryClient.invalidateQueries({ queryKey: ['cycle', 'entries'] });
    }
  })
  .catch((err) => {
    // Silent fail — user already sees the stale data.
    logger.debug('Background refresh failed', err);
  });

// 3. Return SQLite data immediately
return localData;
```

1. **API Request:** The fetch is initiated.
2. **No Blocking:** The `queryFn` returns the SQLite data to React Query immediately.
3. **User Experience:** The UI renders the stale data. The user sees the calendar instantly.

---

### Step 3D: Step 3 — SQLite Hydration (The Update)

1. **API Success:** The server responds with the new period (June 20).
2. **Upsert to SQLite:** `localDb.cycle.upsertMany(freshData)` is called.
3. **SQLite updates** the `cycle_entries` table, adding the June 20 row.
4. **ON CONFLICT DO UPDATE** logic ensures no duplicates.

---

### Step 3E: Step 4 — React Query Invalidation (The "Silent Refresh")

1. **Trigger:** `queryClient.invalidateQueries({ queryKey: ['cycle', 'entries'] })` runs.
2. **React Query Behavior:**
   - React Query marks the cache for `['cycle', 'entries']` as stale.
   - It triggers a background refetch of the `queryFn`.
3. **Re-execution:** The `queryFn` runs again.
   - This time, `localDb.cycle.getHistory()` returns all data, including the new June 20 period.
4. **UI Update:** React Query updates its in-memory cache with the new data. The UI re-renders seamlessly.

---

## 4. The User Experience (What the User Sees)

| Phase | UI State | User Perception |
|-------|----------|-----------------|
| T0 (App Launch) | Splash Screen appears. | "The app is loading." |
| T1 (< 100ms after launch) | Dashboard renders. Calendar shows data up to June 18. | "My data is here." |
| T2 (Background fetch, ~1-3 seconds) | The calendar does not show a spinner. The UI remains interactive. The user might see a tiny "Syncing..." indicator at the very top of the screen (optional UI). | "The app is fast." |
| T3 (API Success + SQLite Update) | The calendar silently updates. The June 20 block appears in Dark Pink. | "Oh, the app automatically updated my period from my iPad." |

**The Magic:** The user never sees a blank screen, a loading spinner, or a "Failed to fetch" error (unless the network is completely down and the stale data is also missing). The UI is always populated.

---

## 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ UI updates without user interaction. | 1. Log a period on Device A (Web/other device).<br>2. Open Device B (iPhone) online.<br>3. Wait 3 seconds. The period should appear in the calendar automatically. | Proves the background refresh + invalidation cycle works. |
| ✅ No flash/loading state. | While the background API call is running, observe the UI. The calendar should never show a skeleton loader or a spinning wheel after the initial render. | Proves the `queryFn` returns SQLite data synchronously and does not block on the API response. |
| ✅ SQLite is updated. | After the background refresh, query SQLite directly. The new period (June 20) should be present in the `cycle_entries` table. | Proves the `upsertMany` function correctly writes the fresh data. |
| ✅ React Query cache is invalidated. | After the refresh, check React Query Devtools or console log the data. The data should now include the June 20 entry. | Proves the `invalidateQueries` call correctly triggers the re-fetch. |

---

## 6. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| The background API fails (500 error). | The `catch` block logs the error to Sentry. SQLite remains unchanged. The UI retains the stale data. The user is not disturbed. On the next app launch or sync cycle, the fetch retries. |
| The background API returns a 409 Conflict. | The server returns `server_data` (newer version). The conflict handler overwrites SQLite with `server_data` and invalidates the query. The UI updates to the server's version. |
| The user force-quits the app during the background fetch. | The fetch is aborted. SQLite is not updated (the transaction is never committed because the `upsert` wasn't fully processed). On the next app launch, the fetch triggers again. |
| Multiple background refreshes occur simultaneously. | React Query's `invalidateQueries` is idempotent. The second refresh will just fetch the same data again (no duplicates, due to `ON CONFLICT DO UPDATE`). |

---

## 7. Why This Matters (The Business Logic)

| Without SWR (Blocking API) | With SWR (Fire-and-Forget) |
|-----------------------------|----------------------------|
| User opens app. Sees a loading spinner for 2 seconds. Thinks the app is slow. | User opens app. Sees data instantly. Thinks the app is fast and responsive. |
| Multi-device sync requires a manual pull-to-refresh. | Multi-device sync happens automatically in the background. User doesn't have to "do" anything. |
| If the API is down, the user sees an error state and blank data. | If the API is down, the user still sees their stale data. No interruption to their workflow. |

---

## 8. Summary

This scenario proves that your app implements the definitive Stale-While-Revalidate pattern:

- **Instant (SQLite first):** The user sees their data immediately (< 50ms).
- **Silent (Fire-and-Forget):** The app fetches fresh data in the background.
- **Seamless (Cache Invalidation):** The UI updates automatically when the new data arrives.

This guarantees that the user never experiences a loading spinner on returning screens, making the app feel instantaneous, even on slow networks. It is the hallmark of a truly polished, offline-first mobile experience. 🌸📱🔄

---

# What Happens When a User is Offline for a Long Time (Weeks/Months)

This is the ultimate stress test for your offline-first architecture.

Here is the exact breakdown of what happens to your system when a user disappears into a remote village for 3 months, writes 100 entries, and finally walks back into a Wi-Fi zone.

---

## Scenario 32: Offline Writes — Optimistic UI + SQLite Sync — Detailed Explanation

This scenario validates the "No Write to Permanent Cache Before Server Confirmation" rule—one of the most critical architectural decisions in your offline-first system. It ensures that the user's local history (SQLite) is never contaminated with "ghost" entries that the server might eventually reject, and it completely decouples the "Session State" (Optimistic UI + Queue) from the "Permanent Archive" (SQLite).

---

### 1. The Problem: The "Zombie Record" Risk

| Challenge | Description |
|-----------|-------------|
| Offline Creation | The user writes a journal entry or logs a period offline. The server knows nothing about it yet. |
| Premature SQLite Write | If we write to SQLite immediately (before the server confirms), and the server later returns a 400 Bad Request (e.g., malformed data), we would have a "zombie" record in SQLite that does not exist on the server. |
| Conflict Nightmare | If the user creates a record offline, and then creates another record online before the first one syncs, the local IDs (temp IDs) would conflict. SQLite would be filled with untested, unvalidated data. |

**The Golden Rule:** The Permanent Cache (SQLite) is a mirror of the Server. It should only contain records that the server has explicitly acknowledged as valid (200 OK). The Offline Queue (EncryptedStorage) is the temporary holding area for unconfirmed writes.

---

### 2. The Architecture: The Two-Phase Write Pipeline

| Layer | Role in this Scenario | State During Offline Write |
|-------|----------------------|----------------------------|
| React Query (In-Memory Cache) | Optimistic UI. Displays the entry instantly with a temporary ID. | **UPDATED** (immediately). |
| EncryptedStorage (Offline Queue) | The "Pending" vault. Holds the raw operation (`journal/create`, payload, temp ID). | **UPDATED** (immediately). |
| SQLite (Permanent Cache) | The authoritative local archive. Only holds records confirmed by the server. | **UNCHANGED** (remains empty for this entry). |
| Server (PostgreSQL) | The absolute source of truth. | **UNKNOWN** (the request hasn't been sent yet). |

---

### 3. Step-by-Step System Behavior

#### Step 3A: User Action & Optimistic UI (Offline)

**User Action:** Writes a journal entry ("Feeling great today!") and taps "Save". The device is in Airplane mode.

**Mutation Trigger:** The `useCreateJournalEntry` hook fires.

**Optimistic UI (Immediate):**

- React Query's in-memory cache is updated with the new entry.
- The entry is assigned a temporary ID (`temp-abc-123`) and a `_pending: true` flag.
- The UI instantly displays the entry in the Journal List with a gray "Syncing..." badge.
- **Duration:** < 50ms.

#### Step 3B: The Offline Queue (EncryptedStorage)

**Network Attempt:** The mutation tries to `POST` to `/api/v1/wellness/journal`.

**Network Error:** The fetch fails immediately (offline).

**Queue Enqueue:** The `onError` handler catches the network error and calls `offlineStore.enqueue()`:

```typescript
{
  id: 'op-123',
  type: 'journal/create',
  endpoint: '/api/v1/wellness/journal',
  payload: { content: 'Feeling great today!' },
  tempId: 'temp-abc-123',
  idempotencyKey: 'ik-456',
  clientUpdatedAt: '2025-07-22T09:00:00Z',
  retryCount: 0,
  priority: 'normal'
}
```

**Persistence:** The operation is written to EncryptedStorage (`shecare.offline.queue`). It survives app restarts.

#### Step 3C: SQLite Isolation (The "No-Write" Rule)

**Crucial Step:** The `onSuccess` handler is not called because the API never responded.

**SQLite State:** `localDb.journal.upsert()` is never invoked.

**Result:** The `shecare.db` file remains unchanged. It does not contain the journal entry.

#### Step 3D: App Restart (The "Ghost" Vanishes)

**User Action:** Force-quits the app and reopens it (still offline).

1. **React Query:** The in-memory cache is wiped. The optimistic entry disappears.
2. **SQLite Query:** The `queryFn` runs: `const localData = await localDb.journal.getHistory(userId)`.
3. **Result:** SQLite returns `[]`. The UI shows the previous list of synced entries (without the pending one).

**User Perception:** The user might think, "Where did my entry go?"

But wait! The operation is still in EncryptedStorage. It is not lost.

#### Step 3E: Reconnect & Sync (The Resurrection)

**User Action:** Walks into a Wi-Fi zone. NetInfo fires `isConnected = true`.

**Sync Trigger:** `syncEngine.syncAll()` wakes up.

**Push Phase:** `syncEngine.pushOperations()` reads the `offlineStore`.

- It finds `op-123` (the journal entry).
- It sends `POST /api/v1/wellness/journal` with the payload.

**Server Success:** The server accepts the data, creates the record, and returns a 200 OK with the real server data:

```json
{
  "id": "server-uuid-789",
  "content": "Feeling great today!",
  "created_at": "2025-07-22T09:05:00Z"
}
```

**Post-Success Hook (Hydration):**

- **Queue Cleared:** `offlineStore.remove(op.id)` deletes the pending operation from EncryptedStorage.
- **SQLite Updated:** `localDb.journal.upsert(server_data)` is called.
- **React Query Invalidation:** `queryClient.invalidateQueries()` triggers a re-fetch.
- **Re-Read:** The `queryFn` runs again, reading the new entry from SQLite.
- **UI Final State:** The entry reappears in the Journal List, but this time it has the real `server-uuid-789` and no "Syncing..." badge.

---

### 4. The User Experience (What the User Sees)

| Phase | UI State | User Perception |
|-------|----------|-----------------|
| Offline Write | Entry appears instantly with "Syncing..." badge. | "Great, my journal is saved." |
| App Restart (Offline) | The entry is missing. The list shows older entries. | "Wait, where did my journal go?" (Potential confusion). |
| Reconnect & Sync | The entry reappears without the badge. | "Oh, it finally synced. The app didn't lose it." |

**Why this is better than writing to SQLite immediately:**

If we had written to SQLite immediately, the user would see the entry even after a restart (which seems good). BUT, if the server later rejected the entry (e.g., a 400 error), SQLite would permanently contain a "zombie" record that the server doesn't recognize. This would cause massive headaches during conflict resolution. The "vanish and reappear" flow is a minor UX hiccup compared to the nightmare of managing permanent ghost data.

---

### 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Pending entries are not lost. | After writing offline and force-quitting, check EncryptedStorage (or the `offlineStore` state on re-launch). The operation should still be present in the queue. | Proves the data is safely stored in the queue, not just in volatile memory. |
| ✅ SQLite eventually has the record. | After the device reconnects and the sync completes, query SQLite for the journal entry. It should be present with the server-generated ID. | Proves the "Hydration" step (`upsert` on server success) is working. |
| ✅ No SQLite write occurs before sync. | Immediately after the offline write (before app restart), query SQLite. The entry should be absent. | Proves the `onSuccess` handler is the only entry point for SQLite writes, confirming the Golden Rule. |
| ✅ Optimistic UI accurately reflects pending state. | The entry appears with a "Syncing..." badge. If the user edits it again offline, the UI updates the draft. | Proves React Query's in-memory cache is correctly managing the optimistic state, independent of the disk cache. |

---

### 6. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| User edits the offline entry before it syncs. | The optimistic state (React Query cache) is updated. The offline queue contains the latest version (the sync engine sends the most recent payload). SQLite is still empty. |
| User deletes the offline entry before it syncs. | The delete operation is enqueued after the create operation (FIFO). On sync, the server creates the record (200 OK), then immediately deletes it (200 OK). The user sees nothing. |
| Server returns a 400 error (bad data). | The sync engine discards the operation (`offlineStore.discard`). SQLite is never written to. The user's optimistic entry never reappears. |
| App is force-quit during the SQLite upsert. | The `upsert` is a single SQLite transaction. If interrupted, the database is rolled back to its previous state. On the next sync cycle, the entry will be retried (idempotency key prevents duplicates). |

---

### 7. Why This Matters (The Business Logic)

| Without "No Write" Rule (Writing to SQLite immediately) | With "No Write" Rule (Write only on Server Success) |
|---------------------------------------------------------|----------------------------------------------------|
| User creates entry offline → App crash → SQLite has ghost record → User reopens app → Sees ghost record. | User creates entry offline → App crash → SQLite is clean → User reopens app → Entry is missing (queue is safe). |
| Server rejects the data (400) → Ghost record remains in SQLite forever. | Server rejects the data (400) → Queue discards it → SQLite never had it. Clean. |
| Multi-device conflict is impossible to resolve because the local SQLite has an ID that the server doesn't recognize. | Conflict resolution is clean because SQLite only contains server-validated IDs (`server-uuid-789`). |

---

### 8. Summary

This scenario proves that your write pipeline strictly adheres to the "Confirm First, Cache Later" principle:

- Optimistic UI provides instantaneous feedback (React Query cache).
- EncryptedStorage ensures data survival (offline queue).
- SQLite (Permanent Cache) remains pure—it only contains records that have been acknowledged by the server.
- Server Sync is the bridge that "promotes" the pending operation from the queue to the permanent cache.

This architecture guarantees that your local database is never corrupted by unconfirmed data, making conflict resolution, debugging, and data integrity significantly easier to manage. The user might experience a brief disappearance of their offline entry after an app restart, but this is a small price to pay for absolute data integrity and sync reliability. 🌸📱💾

---

## Phase 1: The "Dark Period" (While Offline)

### 1. The Offline Queue (EncryptedStorage)

**Behavior:** Every journal, period log, and correction is appended to EncryptedStorage (`shecare.offline.queue`).

**The Risk (iOS SecureStore Limit):** iOS SecureStore limits values to ~1-4 MB. If the user writes 2,000 journal entries (each ~500 bytes = 1 MB), they will hit this limit. `setItem` will throw an error.

**The Fallback (Your Safety Net):** If `setItem` fails, your `offlineStore` should attempt to store the queue in AsyncStorage (which has no practical limit) and log a warning to Sentry. The queue must never be lost.

**Retry Count:** The `retryCount` does NOT increment while offline. It only increments when a sync attempt fails (e.g., a 500 error). While offline, the operations just sit there, patiently waiting.

---

### 2. The "Vanish and Reappear" UX Problem (The Elephant in the Room)

**Current Behavior (Scenario 32):** If the user writes a journal offline, force-quits the app, and reopens it, the journal disappears from the UI (because React Query in-memory cache is cleared, and SQLite hasn't been written to yet).

**The 3-Month Nightmare:** If the user writes 100 journals over 3 months, and force-quits the app every night, they will never see their journals on the screen for 3 months. This is terrible UX.

**The Solution (Critical Enhancement):** You MUST persist the "Pending" state to a third storage layer (e.g., a dedicated `pending` table in SQLite, or a separate key in AsyncStorage).

**Idea:** Create a `pending_entries` table in SQLite that holds `{ tempId, type, data, clientUpdatedAt }`.

**Flow:** On restart, the `queryFn` merges SQLite (synced) + SQLite `pending_entries` (unsynced) and displays them together with a "Syncing..." badge.

**Result:** The user sees all their entries, even after 100 restarts.

---

### 3. The Predictions

- **Global Model:** If the user had downloaded `global_model_v5.json` before going offline, predictions continue to work locally (using the arithmetic JSON).
- **Fallback (Median):** If the JSON is missing, the Median fallback works indefinitely using the 3+ cycles stored in SQLite. Predictions never break.

---

### 4. The Auth Token (The Looming Time Bomb)

**Refresh Token Expiry:** Your refresh token likely expires in 30 days (configurable).

**Day 31:** The user is still logged in locally (tokens in EncryptedStorage). However, the refresh token is expired on the server.

**User Experience:** The app does not know the token is expired until it tries to use it. Since the app is offline, it doesn't attempt a refresh. The user remains "logged in" locally.

**The Crisis (Day 91):** The user finally reconnects. The app attempts to refresh the token. The server returns 401. The interceptor triggers the Kill Switch (Scenario 25). The user is force-logged out and loses access to their local queue (which is cleared).

**Mitigation:** You must implement a client-side token expiry check during `authStore.hydrate()`. If `Date.now() > tokenExpiry`, automatically log the user out and clear the queue before they get a 401 and lose their queue. Better yet, extend the refresh token lifetime to 90 days for V1, or implement a "Offline Mode" grace period.

---

## Phase 2: The "Reconnection Storm" (Walking into Wi-Fi)

### 1. The Sync Trigger

**Event:** NetInfo fires `isConnected = true`.

**Triggers:** Foreground sync, background sync (15-day interval), and the immediate network change trigger all fire simultaneously. The `isSyncing` lock prevents duplicates.

---

### 2. The Batch Processing (The Heavy Lift)

- **Queue Size:** 100-2,000 operations.
- **FIFO Sorting:** The sync engine processes them in order.
- **Gzip Compression:** `POST /sync/batch` compresses the payload (reduces 2 MB to ~500 KB).
- **Server Processing:** The server validates each operation, handles conflicts (409s), and returns a batch response.

---

### 3. The "UI Explosion" (The Reward)

- **Step A:** Sync engine pushes the first 50 operations. Server returns 200. SQLite is hydrated for those 50 (via `upsertMany`).
- **Step B:** React Query invalidates. The `queryFn` re-reads SQLite and displays the 50 entries immediately.
- **Step C:** The sync engine continues processing the remaining 50. The UI silently updates with the rest.

**Result:** The user sees their 3 months of journals and periods appear on the screen, possibly in batches over 2-3 seconds.

---

### 4. The Conflict Resolution (Multi-Device War)

**Scenario:** The user logged period A (June 20) offline. But their partner logged period B (June 22) online on the web app.

**Sync:** When the phone syncs, the server detects the conflict based on `client_updated_at`.

**Result:** The server returns `server_data` (June 22). The phone overwrites SQLite. The UI shows the server's version. The user's offline entry is discarded (with a toast: "Updated from another device").

---

### 5. The Global Model Update

**Scenario:** The user missed the monthly v5 → v6 → v7 updates while offline.

**Sync:** After the queue drains, the app checks `/models/status`. It sees `current_version = 7`.

**Download:** The app downloads `global_model_v7.json` (only 5 KB) in the background.

**Result:** The next prediction instantly becomes more accurate, using 3 months of aggregated population data.

---

## Summary Checklist (What to Fix/Enhance)

| Issue | Solution | Priority |
|-------|----------|----------|
| Offline entries vanish on restart (UX) | Create a `pending_entries` table in SQLite (or AsyncStorage) to persist optimistic UI across restarts. | **CRITICAL** (Before launch) |
| EncryptedStorage limit (1-4 MB) | Implement a fallback to AsyncStorage for the offline queue when SecureStore fails. | **HIGH** |
| Refresh Token Expiry (30 days) | Extend refresh token lifetime to 90 days (or implement client-side expiry check to gracefully log out without losing the queue). | **HIGH** |
| Massive Queue Processing (Timeouts) | Ensure the `/sync/batch` endpoint can handle > 500 operations in < 10 seconds. Use database indexing to speed up SQLite upserts. | **MEDIUM** |
| Prediction updates after long offline | The `globalModelClient.ensureLatest()` will automatically download the new JSON on reconnection. | **ALREADY SOLVED** |

**Final Verdict:** Your architecture is structurally sound for long offline periods, but the "Vanish and Reappear" UX bug is a major friction point.

I strongly recommend implementing a "Pending Writes" cache (e.g., a simple AsyncStorage key like `shecare.pending.entries`) that persists the optimistic UI data across app restarts. When the app restarts offline, the `queryFn` should merge SQLite (synced) + AsyncStorage (pending) and display them together. This way, the user sees their 3 months of journals, even if they force-quit the app 100 times. 🌸📱💾
