# Scenario 33: SQLite Performance — 5,000+ Records — Detailed Explanation

This scenario validates the scalability and longevity of your offline-first architecture. It simulates a "power user" who has been diligently logging her cycles, moods, and journals for over a decade (approximately 5,000 cycle entries, or ~13 years of monthly cycles). The system must prove that SQLite remains blazingly fast even with a massive dataset, and that the UI remains butter-smooth (60fps) when rendering this historical data.

---

## 1. The Problem: The "Scale" Cliff

| Challenge | Description |
|-----------|-------------|
| Full Table Scan (The Index Trap) | If there is no index on `user_id`, a query for one user's history forces SQLite to scan the entire 5,000-row table to find the ~500 rows belonging to that specific user. |
| Date Sorting Overhead | Ordering 5,000 rows by `period_start_date` without an index requires a full in-memory sort (O(n log n)), which blocks the database thread. |
| UI Rendering (The "Jank" Threat) | Even if the database returns data in 20ms, rendering 50 complex cycle cards (with symptoms, moods, and phase colors) can drop frames if the JavaScript thread is blocked by layout calculations. |
| The 10-Year Horizon | Users will use this app for years. The system must not degrade over time. |

**The Golden Rule:** Proper indexing + Efficient Queries + Recyclable UI = Infinite Scalability. SQLite is designed to handle terabytes of data. With the right indexes, 5,000 rows is trivial.

---

## 2. The Architecture: The Index Strategy

Your Drizzle schema (Plan 1) should define these exact indexes:

```sql
-- 1. The Primary Filter (Narrows down to the specific user)
CREATE INDEX idx_cycle_entries_user_id ON cycle_entries(user_id);

-- 2. The Sorting Filter (Speeds up date ordering)
CREATE INDEX idx_cycle_entries_period_start_date ON cycle_entries(period_start_date);

-- 3. Composite Index (Optimizes the most common query: user_id + date + active)
-- This is a "covering index" for the WHERE + ORDER BY clause.
CREATE INDEX idx_cycle_entries_user_date_active ON cycle_entries(user_id, period_start_date DESC, is_active);
```

**Why `idx_cycle_entries_user_date_active` is the champion:**

The query `SELECT * FROM cycle_entries WHERE user_id = ? AND is_active = 1 ORDER BY period_start_date DESC LIMIT 50` can be satisfied entirely from this index.

SQLite does not have to read the actual table rows (`SELECT *`) until it has found the 50 row IDs from the index. This is called a "covering index" (partially covering, since `SELECT *` still requires a lookup, but the index drastically narrows the search space).

---

## 3. Step-by-Step System Behavior

### Step 3A: Data Population (The 5,000 Records)

**Action:** The test harness or a backfill script inserts 5,000 dummy `cycle_entries` records across 10 users (500 entries per user).

**Data Distribution:** Each record has `period_start_date` spanning 10 years, `period_end_date`, symptoms (JSON), and `created_at`.

**SQLite State:** The `shecare.db` file size grows to roughly ~5-10 MB (JSON arrays and text fields).

---

### Step 3B: The Query Execution (The Database Thread)

1. **UI Trigger:** User opens the Cycle History screen. `useCycleHistory` fires.
2. **Query Call:** `localDb.cycle.getHistory(userId, { limit: 50 })`.
3. **SQL Execution:**

```sql
SELECT * FROM cycle_entries
WHERE user_id = 'uuid-123' AND is_active = 1
ORDER BY period_start_date DESC
LIMIT 50;
```

**The Query Plan (Using `EXPLAIN QUERY PLAN`):**

- **Without Index:** `SCAN TABLE cycle_entries` (scans 5,000 rows).
- **With Index:** `SEARCH TABLE cycle_entries USING INDEX idx_cycle_entries_user_date_active (user_id=?)` + `USE TEMP B-TREE FOR ORDER BY` (O(log n) for the search, O(1) for the LIMIT).

**Result:** The query returns in < 5-10ms (well under the < 20ms target).

---

### Step 3C: The UI Rendering (The JavaScript Thread)

1. **FlatList Component:** The `CycleHistoryScreen` renders the 50 entries using a `FlatList`.
2. **Item Component:** Each row is a `CycleHistoryItem` card (displays start date, end date, period length, symptom badges).
3. **Recycler Pattern:** `FlatList` only renders the visible rows (e.g., 7-10 items on screen) and recycles the offscreen ones. The DB query returns 50 items, but `FlatList` only mounts ~10 items at a time.

---

### Step 3D: The 60fps Guarantee

- **JS Thread:** The `queryFn` returns data in < 20ms. The UI state update is batched.
- **Native Thread:** Layout calculations (height, flexbox) are handled natively.
- **Result:** The UI maintains a solid 60fps (no dropped frames).

---

## 4. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| `LIMIT` without `OFFSET` (Infinite Scroll). | The first query returns 50 rows. The user scrolls to the bottom, triggering a second query with `OFFSET 50`. The index still guarantees sub-10ms performance. |
| User scrolls to the bottom rapidly. | The `queryFn` is debounced or uses React Query's `staleTime` to prevent duplicate network/db calls. |
| Querying for `period_start_date` range (e.g., last 6 months). | The composite index covers the `WHERE period_start_date > '2025-01-01'` condition as well. |
| JSON Parsing overhead (symptoms array). | The `symptoms` column is a JSON string. Parsing 50 JSON strings costs ~1-2ms. Negligible. |
| User has 50,000 records (100 years). | SQLite can handle this, but the `shecare.db` file would grow to ~100 MB. The query performance remains O(log n), so it still returns in < 20ms because of the index. |

---

## 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Query Speed < 20ms. | Run `performance.now()` around the `localDb.cycle.getHistory()` call. Log the duration. | Proves the database indexes are correctly configured and the query planner is utilizing them. |
| ✅ Indexes exist. | Open the SQLite database using a tool (e.g., DB Browser for SQLite). Navigate to the "Indexes" tab. Verify that `idx_cycle_entries_user_id` and `idx_cycle_entries_period_start_date` are present. | Proves the Drizzle migration generated the correct `CREATE INDEX` statements. |
| ✅ UI scrolls smoothly (< 60fps). | Open the Cycle History screen and rapidly scroll up and down. Monitor the FPS counter (React Native's built-in FPS monitor or Reanimated's performance monitor). | Proves that `FlatList` is correctly recycling views and that the JavaScript thread is not blocked by heavy layout calculations or large data transformations. |
| ✅ `EXPLAIN QUERY PLAN` shows index usage. | In the test environment, execute `EXPLAIN QUERY PLAN SELECT ...`. Verify the output shows `USING INDEX idx_cycle_entries_user_date_active`. | Proves the SQLite optimizer is actually using the index (confirms no missing or corrupt indexes). |

---

## 6. Why This Matters (The Business Logic)

| Without Indexes (Full Scan) | With Indexes (B-Tree Search) |
|------------------------------|------------------------------|
| Query takes 200ms (for 5,000 rows). As data grows to 50,000, it takes 2 seconds. | Query takes 5ms, whether the user has 5 cycles or 5,000 cycles. |
| UI freezes while the database scans rows. User experiences janky scrolling. | UI remains buttery smooth. The user perceives the app as "instant." |
| Battery drain due to high CPU usage on every database hit. | Battery efficient (minimal CPU cycles). |

---

## 7. The "Covering Index" Deep Dive

If you want to push the limit to < 2ms, you can create a covering index that includes the `period_start_date` and `period_end_date` so that SQLite never has to read the raw table rows at all.

```sql
CREATE INDEX idx_cycle_entries_covering 
ON cycle_entries(user_id, period_start_date DESC, period_end_date);
```

When you run `SELECT period_start_date, period_end_date ...`, SQLite reads this data entirely from the index without touching the main table (`EXPLAIN QUERY PLAN` will show `USING COVERING INDEX`). This is the absolute peak performance for a mobile database.

---

## 8. Summary

This scenario proves that your SQLite database is bulletproof for long-term usage. By leveraging proper indexing, the app guarantees that a user with 10+ years of cycle data will experience the exact same lightning-fast performance as a brand-new user with zero data. The combination of SQLite's B-tree indexes and React Native's `FlatList` recycling ensures that the app remains responsive, battery-efficient, and scalable for the foreseeable future. 🌸📱💾

---

# Scenario 34: Offline Queue + SQLite Conflict — Detailed Explanation

This scenario validates the "Server Wins" conflict resolution strategy, specifically when a device attempts to sync an offline write that has already been superseded by a newer edit made on another device. It ensures that your system never overwrites a newer truth with an older lie, preventing data corruption in multi-device environments.

---

## 1. The Problem: The "Time-Travel" Data Overwrite

| Challenge | Description |
|-----------|-------------|
| Device A (Offline Write) | User logs a period starting on June 10 while offline. |
| Device B (Online Edit) | Before Device A syncs, the user (or a family member) corrects the period to June 12 on the Web Dashboard. |
| The Sync Race | Device A reconnects to the internet and tries to push its "June 10" entry. |
| The Risk | If the sync engine blindly pushes the local "June 10" write and the server accepts it, the user's newer edit (June 12) is silently overwritten by the older edit. The user loses their more accurate data. |

**The Golden Rule:** The latest user action (by timestamp) must always win. The server must compare the timestamp of the incoming local edit (`client_updated_at`) with the timestamp of the existing server record (`updated_at`). If the server record is newer, the server must reject the local edit and force the local client to adopt the server's version.

---

## 2. The Architecture: The "Timestamp Authority" Chain

| Component | Role in this Scenario |
|-----------|----------------------|
| Device A (Mobile) | Holds an offline `CREATE` or `UPDATE` operation with `client_updated_at = 2025-06-10T09:00:00Z`. |
| Device B (Web) | Already sent a `PUT` operation that updated the same period to `period_start_date = '2025-06-12'` with `updated_at = '2025-06-11T14:00:00Z'` on the server. |
| Server (PostgreSQL) | Has the record with `updated_at = '2025-06-11T14:00:00Z'`. |
| Sync Engine (Mobile) | Attempts to send the pending `CREATE` (or `UPDATE`) via `POST /sync/batch`. |

---

## 3. Step-by-Step System Behavior

### Step 3A: Device A Offline Write (June 10)

**User Action:** User logs a period starting June 10 offline.

1. **Optimistic UI:** The calendar instantly shows Dark Pink for June 10 (React Query in-memory).
2. **Offline Queue:** The operation is enqueued to EncryptedStorage with:
   - `type`: `'cycle/create'` (or `'cycle/update'`)
   - `payload`: `{ period_start_date: '2025-06-10' }`
   - `client_updated_at`: `'2025-06-10T09:00:00Z'` (Crucial timestamp)
3. **SQLite:** Remains unchanged (Scenario 32 - Golden Rule).

---

### Step 3B: Device B Online Edit (June 12)

**User Action:** The user opens the Web Dashboard and corrects the period to June 12.

1. **Server Update:** The server executes `UPDATE cycle_entries SET period_start_date = '2025-06-12', updated_at = NOW()`.
2. **Server State:** The record now has `updated_at = '2025-06-11T14:00:00Z'`.

---

### Step 3C: Device A Reconnects (The Conflict Trigger)

1. **Trigger:** NetInfo fires `isConnected = true`.
2. **Sync Push:** `syncEngine.pushOperations()` reads the queue and sends the `cycle/create` (or `update`) operation to `POST /sync/batch`.
3. **Headers:**
   - `Idempotency-Key`: `ik-123` (prevents duplicates)
   - `X-Client-Updated-At`: `2025-06-10T09:00:00Z` (Device A's timestamp)

---

### Step 3D: The Server's Conflict Detection (The 409 Gate)

The server receives the request. It already has a record for this user's period window. It performs a check:

1. **Fetch Existing Record:** The server queries the database for the `cycle_entry` that matches the user and date window.
2. **Timestamp Comparison:**

```python
if existing_record.updated_at > client_updated_at:
    # Server is NEWER. Conflict!
    return 409 Conflict
elif existing_record.updated_at < client_updated_at:
    # Client is NEWER. Accept the update.
    ...
else:
    # Identical. No-op.
```

**The Math:** `2025-06-11T14:00:00Z` (Server) > `2025-06-10T09:00:00Z` (Device A). The server detects a conflict.

**Server Response (409):**

```json
{
  "status": "conflict",
  "server_data": {
    "id": "entry-456",
    "period_start_date": "2025-06-12",
    "updated_at": "2025-06-11T14:00:00Z"
  }
}
```

---

### Step 3E: Mobile Conflict Handler (The Overwrite & Discard)

The mobile `syncEngine` receives the 409 response.

1. **Step 1 — Discard the Pending Operation:** `offlineStore.discard(op.id)` is called. The queue is cleared of the stale "June 10" operation.
2. **Step 2 — Overwrite SQLite:** `hydrateSqlite()` is called with `server_data`.

```typescript
await localDb.cycle.upsert(server_data); // Inserts/Updates SQLite with June 12
```

3. **Step 3 — Invalidate React Query:** `queryClient.invalidateQueries()` is called.
4. **Step 4 — UI Re-fetch:** The `queryFn` reads from SQLite, which now contains the server's June 12 entry.
5. **Step 5 — UI Update:** The calendar instantly flips from June 10 to June 12. A toast appears (silently or with a notification): "Updated from another device."

---

## 4. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| Device A's edit is actually newer (timestamp wins). | If Device A edited the period to June 13 at `client_updated_at = 2025-06-12T16:00:00Z`, the server would accept the update (200 OK), overwrite the server record with June 13, and return the new `server_data` for SQLite hydration. |
| Both devices edit exactly the same time (clock sync). | Timestamps are in milliseconds. The chance of an exact collision is astronomically low. However, if it happens, the server trusts the `client_updated_at` value and uses `ON CONFLICT DO UPDATE` with `updated_at = client_updated_at` (the last one wins). |
| Device A's offline queue contains a `CREATE` while the server has an `UPDATE`. | The server handles the `CREATE` conflict by checking if a record with the same `temp_id` already exists. If not, it treats it as a conflict and returns `server_data`. The mobile app discards the `CREATE` and adopts the server's `UPDATE`. |
| Device A had multiple edits (`CREATE` + `UPDATE`) in the queue. | The queue is FIFO. The `CREATE` conflicts (409) and is discarded. The `UPDATE` (which refers to the `temp_id`) is also discarded because `removeCascading()` is triggered (dependent ops). Both are replaced with the server data. |

---

## 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Conflict resolution works. | 1. Log a period offline (Device A).<br>2. Edit the same period on the Web (Device B).<br>3. Bring Device A online.<br>4. The app should sync and show the Web's date (June 12) on Device A. | Proves the `client_updated_at` header is correctly sent and the server's timestamp comparison logic is working. |
| ✅ SQLite is updated with the server truth. | After the sync, query SQLite directly for the `cycle_entry`. The `period_start_date` should be June 12 (the server version), not June 10. | Proves that `hydrateSqlite()` correctly overwrites the local cache with the server's authoritative data during a conflict. |
| ✅ Offline Queue is cleared. | After the conflict sync, check EncryptedStorage for the pending operation. It should be absent. | Proves that `offlineStore.discard()` is correctly invoked, preventing the stale operation from reappearing on the next sync cycle. |
| ✅ UI shows the correct date. | The calendar on Device A should display Dark Pink for June 12. | Proves React Query successfully invalidated and re-fetched from the updated SQLite. |

---

## 6. Why This Matters (The Business Logic)

| Without Conflict Resolution (Blind Overwrite) | With Conflict Resolution (409 + Overwrite) |
|------------------------------------------------|--------------------------------------------|
| Device A syncs and overwrites Device B's June 12 with June 10. The user loses their manual correction. | Device A adopts Device B's June 12. The user's latest action is preserved. |
| Data inconsistency between devices (Device A shows June 10, Device B shows June 12). | All devices converge to June 12 (the server truth). |
| User has to manually re-enter the June 12 correction on Device A. | The user sees the correction automatically. No action required. |

---

## 7. Summary

This scenario proves that your sync engine is smart enough to detect and resolve multi-device conflicts. By leveraging the `client_updated_at` timestamp and the server's `updated_at` field, the system guarantees that the latest user action always prevails.

- Device A (older edit) is rejected (409 Conflict).
- The pending operation is discarded (no zombie records).
- SQLite is overwritten with the server's data (local cache reflects the truth).
- The UI updates instantly (React Query invalidation).

This is the definitive safeguard against data corruption in a multi-device, offline-first health app. 🌸📱🔄

---

# Scenario 35: Logout — SQLite Data Persistence (Privacy Check) — Detailed Explanation

This scenario validates the "Session vs. Archive" separation principle. It simulates the most common user security action: logging out of the app. The system must balance two conflicting requirements: Instant recovery (when the same user logs back in) and Absolute privacy (when a different user logs in on the same device). The solution lies in keeping the data file (SQLite) intact but strictly partitioning it by `user_id`.

---

## 1. The Problem: The "Shared Device" Dilemma

| Challenge | Description |
|-----------|-------------|
| The User (Priya) logs out. | She taps "Sign Out" in the Settings screen. |
| The Urgent Require (UX) | If Priya logs back in 5 minutes later, she expects to see her cycle history instantly—not wait 10 seconds for a network re-download. |
| The Privacy Nightmare (Security) | If Priya hands her phone to her sister (Ananya), who logs in with her own account, Ananya must never see Priya's period logs. |
| The Risk | If we clear SQLite on logout, Priya's re-login is slow (bad UX). If we keep SQLite, Ananya might accidentally see Priya's data (bad privacy). |

**The Golden Rule:** The historical archive (SQLite) is physically retained, but logically partitioned. The `user_id` column acts as an unbreakable wall. The service layer (not the database file) enforces data isolation.

---

## 2. The Architecture: The Two-Tier Data Model

| Layer | What it stores | On Logout Action |
|-------|---------------|------------------|
| EncryptedStorage (SecureStore) | Auth tokens, Offline Queue (`PendingOperation[]`), User Profile | **CLEAR** (Reset) — Prevents cross-account sync contamination. |
| SQLite (Permanent Cache) | Historical `cycle_entries`, `journal_entries`, `mood_logs`, etc. | **RETAIN** — The file is not deleted. |
| Row-Level Security (Service Layer) | Every `localDb` query includes `WHERE user_id = ?` | **ENFORCED** — The current logged-in user's ID is passed to all queries. |

---

## 3. Step-by-Step System Behavior

### Step 3A: User Taps "Sign Out"

**User Action:** Priya taps the "Sign Out" button in the Settings screen.

1. **Auth Reset:** `authStore.reset()` is called.

```typescript
async function reset() {
  await tokenStore.clear();           // Clears accessToken, refreshToken
  await offlineStore.clear();         // Clears the pending queue
  await clearCachedUser();            // Removes user object from storage
  set({ user: null, isHydrated: true });
  queryClient.clear();                // Clears in-memory React Query cache
}
```

2. **SQLite Write?** NO. `localDb` is not touched. The `shecare.db` file remains exactly as it was.

**Result:** The user is navigated to the Auth Stack (Login/Register). The queue is empty, ensuring that if Ananya logs in, her sync engine won't accidentally push Priya's pending writes.

---

### Step 3B: Re-login (Same User — Priya)

**User Action:** Priya logs back in (5 minutes later). The app gets a new `accessToken` and `refreshToken`.

1. **Auth Hydration:** `authStore.hydrate()` sets `user: { id: 'priya-uuid', ... }`.
2. **UI Navigation:** The app navigates to the Main Dashboard.
3. **Query Execution:** `useCycleHistory` fires. The `queryFn` runs:

```typescript
const userId = useAuthStore((s) => s.user?.id); // 'priya-uuid'
const localData = await localDb.cycle.getHistory(userId);
```

4. **SQLite Query:** `SELECT * FROM cycle_entries WHERE user_id = 'priya-uuid' ORDER BY period_start_date DESC LIMIT 50;`
5. **Result:** SQLite returns Priya's 6 months of history instantly (< 50ms). The UI renders her calendar immediately.
6. **Network Background Refresh:** The app fires a background API call to fetch any new data (Scenario 31). Priya sees her data instantly while the app updates silently.

---

### Step 3C: Login (Different User — Ananya)

**User Action:** Ananya logs in on Priya's device (after Priya has logged out).

1. **Auth Hydration:** `authStore.hydrate()` sets `user: { id: 'ananya-uuid', ... }`.
2. **Query Execution:** `useCycleHistory` fires. The `queryFn` runs:

```typescript
const userId = 'ananya-uuid'; // Different!
const localData = await localDb.cycle.getHistory(userId);
```

3. **SQLite Query:** `SELECT * FROM cycle_entries WHERE user_id = 'ananya-uuid' ORDER BY period_start_date DESC LIMIT 50;`
4. **Result:** Since Ananya has never used this device before, SQLite returns `[]` (empty). The UI shows the empty state ("No cycles logged yet").
5. **Privacy Guarantee:** Priya's 6 months of data is still present in `shecare.db`, but it is completely invisible to Ananya because the `WHERE user_id = 'ananya-uuid'` clause filters it out.

---

## 4. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| User wants absolute privacy (shared device). | **Optional Enhancement:** Add a toggle in Settings: "Clear local data on logout (recommended for shared devices)." If enabled, `reset()` calls `localDb.hardDeleteAllByUser(userId)` to physically delete the rows. Default is OFF (retain data). |
| User logs out, and the app is force-quit. | The auth store state is reset. On next launch, `authStore.hydrate()` reads `null` from EncryptedStorage and navigates to Auth. SQLite is untouched. |
| Different users have the same `user_id`? | Impossible (UUIDs are cryptographically unique). |
| SQLite file is corrupt (Scenario 28). | The `queryFn` returns empty or falls back. Data isolation is irrelevant if the file is broken. |
| New user logs in and creates new data. | The new data is inserted with `user_id = 'ananya-uuid'`. Priya's data (with `user_id = 'priya-uuid'`) remains untouched. The two data sets coexist in the same SQLite file but are never mixed in queries. |

---

## 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ User's data persists for re-login. | 1. Log in as Priya, sync some data.<br>2. Log out.<br>3. Log back in as Priya.<br>4. The calendar should show the data instantly (< 100ms). | Proves that SQLite is not cleared on logout, enabling instant UX for returning users. |
| ✅ Different users cannot see each other's data. | 1. Log in as Priya, sync data.<br>2. Log out.<br>3. Log in as Ananya (a different account).<br>4. The calendar should be empty (or show only Ananya's data, if any). | Proves the `WHERE user_id = ?` clause is correctly applied in every `localDb` query, enforcing logical data isolation. |
| ✅ Offline Queue is cleared. | Before logging out, create a pending operation (go offline, log a period). Log out. Log in as Ananya. Check the `offlineStore`. It should be empty. | Proves that pending writes (which are tied to the session) are destroyed, preventing cross-account sync contamination. |
| ✅ React Query cache is cleared. | After logging out, check React Query Devtools. The `['cycle', 'entries']` cache should be empty. | Proves that volatile UI state is reset, so Ananya doesn't see a flash of Priya's data before the `queryFn` executes. |

---

## 6. Why This Matters (The Business Logic)

| Without Data Partitioning (Clearing SQLite on Logout) | With Data Partitioning (Retaining SQLite) |
|--------------------------------------------------------|------------------------------------------|
| Priya logs out and back in → Calendar is empty → Network re-download takes 5-10 seconds → User gets frustrated. | Priya logs out and back in → Calendar appears instantly → User perceives the app as "instant." |
| Ananya logs in → No risk of seeing Priya's data because SQLite was wiped. | Ananya logs in → Priya's data is in SQLite but safely hidden by the `user_id` filter. |
| If the network is down, Priya cannot see her data after re-login because it was wiped. | If the network is down, Priya can see her full history instantly because SQLite retained it. |

---

## 7. Optional Enhancement: `clearSqliteOnLogout`

For users who share devices (e.g., a family tablet), privacy-conscious users may demand that all traces of their data be removed upon logout.

**Implementation:**

Add a toggle in Settings: "Clear local data on sign out (recommended for shared devices)."

When enabled, `authStore.reset()` calls:

```typescript
await localDb.cycle.hardDeleteAllByUser(userId);
await localDb.journal.hardDeleteAllByUser(userId);
await localDb.mood.hardDeleteAllByUser(userId);
```

**Default:** OFF. The vast majority of users (who are the sole owner of their phone) benefit from the instant recovery of retaining SQLite data.

---

## 8. Summary

This scenario proves that your app distinguishes "Session State" from "User Data":

- **Session State (Tokens, Queue):** Lives in EncryptedStorage. Destroyed on logout to prevent security leaks and cross-account contamination.
- **User Data (Historical Records):** Lives in SQLite. Retained on logout to ensure instant recovery for returning users.
- **Row-Level Security:** The `user_id` filter in SQLite queries ensures that even though the data physically remains in the file, it is strictly partitioned by the authenticated user.

This architecture guarantees that a password change or admin revocation does not result in data loss, while simultaneously ensuring that no stale writes infect a new user's session. This is the hallmark of a secure, offline-first, multi-device health app. 🌸🛡️🔑
