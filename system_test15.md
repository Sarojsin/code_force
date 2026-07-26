# Scenario 46: The "Network Flapping" — Constant Offline/Online Toggle — Detailed Explanation

This scenario validates the "Chaos Monkey" resilience of your offline-first architecture. It simulates the worst-case real-world network condition: a user in a moving vehicle, walking through a tunnel, or in a rural area with a patchy 2G/3G signal, where the device rapidly alternates between "Connected" and "No Internet" multiple times per second.

The system must survive this "Network Flapping" without corrupting data, freezing the UI, or creating duplicate entries.

---

## 1. The Problem: The "Signal Chaos" Trap

| Challenge | Description |
|-----------|-------------|
| Rapid Trigger Spam | NetInfo fires `isConnected = true` and `isConnected = false` dozens of times within seconds. Each event triggers `syncAll()` (if NetInfo listener is poorly implemented). |
| In-Flight Request Abortion | A `POST /sync/batch` request is sent. Halfway through the upload, the network drops. The `fetch` request is aborted by the browser/RN engine, throwing an `AbortError`. |
| The "Zombie" Response | The server processed the request just before the network dropped, but the mobile app never received the 200 OK. The mobile queue assumes failure and retries. |
| UI Reactivity | If the ConnectivityBanner component forces a full-screen reload or heavy re-render every time `isConnected` toggles, the UI will stutter and freeze. |
| SQLite Write Interruption | If the app is in the middle of `localDb.cycle.upsertMany()` and the OS suspends the app (or the app crashes) due to memory pressure from the network flapping, the database could be left in a half-written state. |

**The Golden Rule:** Assume the network can die at any microsecond. The system must rely on Idempotency (Server) to prevent duplicates, Atomic Transactions (SQLite) to prevent corruption, and Throttling/Debouncing (UI) to prevent UI freeze.

---

## 2. The Architecture: The "Chaos Resistant" Stack

| Layer | Defense Mechanism |
|-------|------------------|
| Network Listener (NetInfo) | **Debounced.** A `setTimeout` (or Lodash debounce) ensures that `syncAll()` is only triggered after the connection has been stable for 500ms. This prevents a flood of sync requests during rapid flapping. |
| Idempotency (Server) | The Idempotency-Key header prevents duplicate processing. If the client retries a request that the server already processed, the server returns the cached 200 OK without re-executing the database logic. |
| SQLite ACID (Transactions) | All write operations (`upsertMany`) are wrapped in `BEGIN TRANSACTION ... COMMIT`. If the app is killed mid-write, SQLite's rollback journal restores the database to the exact state before the transaction started. |
| UI Banner | The ConnectivityBanner is a subtle overlay (using Reanimated or simple Animated with FadeIn/FadeOut). It does not force a full-screen reload or reset the navigation stack. |

---

## 3. Step-by-Step System Behavior

### Step 3A: The Flapping Starts (Dashboard Loading)

**User State:** Opens the app. `useCycleHistory` `queryFn` is reading SQLite.

**Flap 1 (Offline):** NetInfo fires `isConnected = false`.

- **UI:** The ConnectivityBanner fades in (subtle yellow bar at the top).
- **No Reload:** The Dashboard remains fully interactive with SQLite data.

**Flap 2 (Online):** 200ms later, `isConnected = true`.

- **UI:** The ConnectivityBanner fades out.
- **Sync Trigger:** The debounced listener waits 500ms. Since the connection is still up after 500ms, it calls `syncAll()`.

---

### Step 3B: Flap Interrupts `syncEngine.pushOperations()`

1. **Sync Start:** `syncAll()` acquires the `isSyncing` lock.
2. **Push Phase:** `pushOperations()` reads the queue (3 pending journal entries) and sends `POST /sync/batch` (with Idempotency-Key: `ik-123`).
3. **The Interrupt (Mid-Upload):** The network drops. The `fetch` request throws an `AbortError`.
4. **Sync Error Handler:** The `catch` block in `syncAll()` logs the error and releases the `isSyncing` lock.
5. **The Retry (Network Recovers):** 2 seconds later, the network stabilizes. The debouncer triggers `syncAll()` again.
6. **Server Receives:** The server receives `POST /sync/batch` with Idempotency-Key: `ik-123`.
   - The server checks its 24-hour cache. Finds a record for `ik-123` from the previous attempt (which succeeded before the network dropped).
   - The server returns 200 OK with the existing `server_data`.
7. **Client Response:** The mobile app receives the 200, clears the queue, and hydrates SQLite. No duplicate data is created.

---

### Step 3C: Flap Interrupts SQLite Write (The Atomic Rollback)

1. **Write Trigger:** A correction is submitted. `localDb.cycle.upsertMany()` is called.
2. **Transaction Start:** SQLite begins `BEGIN TRANSACTION`.
3. **The Flap:** The app crashes due to the system pressure (or user force-quits) in the middle of the transaction.
4. **Auto-Rollback:** On the next app launch, SQLite detects the unfinished transaction in its write-ahead log (WAL) and automatically rolls back the transaction.
5. **Result:** The `cycle_entries` table is exactly as it was before the correction. No partial writes. Data integrity is 100% intact.

---

## 4. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| Rapid toggling floods the sync queue. | The `isSyncing` lock (Scenario 36) prevents multiple syncs from running simultaneously. The debounced trigger prevents the sync engine from even trying on every toggle. |
| Server processed request but client never received 200. | Idempotency key ensures the retry does not create a duplicate. The server simply returns the cached result. |
| SQLite transaction is interrupted mid-`upsertMany`. | SQLite's atomic commit/rollback ensures the database is never in a half-written state. |
| Connectivity Banner flashes constantly. | The banner uses FadeIn and FadeOut animations with a 300ms duration, smoothing out the rapid toggles. It does not trigger a screen re-render of the heavy Dashboard content. |
| Background API refresh (Scenario 31) fires during flapping. | React Query's `queryFn` is already designed to handle this: it returns SQLite data immediately, and the background API call is fire-and-forget. If the API fails due to flapping, it simply logs the error and does not affect the UI. |

---

## 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ No duplicate data. | 1. Use a network throttling tool (e.g., Charles Proxy) to drop the connection exactly 100ms after a `POST /sync/batch`.<br>2. Let the app retry.<br>3. Check the server database. There should be exactly one row (not two). | Proves the Idempotency-Key mechanism is correctly preventing duplicate processing on the server. |
| ✅ No UI freezing. | 1. Toggle Airplane mode on/off every second for 30 seconds while navigating between screens (CycleHistory, JournalList).<br>2. Monitor the frame rate. The UI should remain smooth (< 60fps drops). | Proves the ConnectivityBanner is lightweight and does not trigger expensive re-renders of the main content. |
| ✅ SQLite integrity remains intact. | 1. Instrument the code to pause the SQLite thread during an `upsertMany` transaction.<br>2. Force-kill the app (using the OS task manager).<br>3. Reopen the app.<br>4. Run `PRAGMA integrity_check;` on the SQLite database (via a hidden debug screen). It should return `ok`. | Proves SQLite's ACID compliance (Atomicity) protects against data corruption from abrupt process termination. |

---

## 6. Why This Matters (The Business Logic)

| Without Idempotency & UI Smoothing | With Idempotency & UI Smoothing |
|-------------------------------------|--------------------------------|
| User walks in and out of a Wi-Fi zone. App creates 3 duplicate journal entries. User loses trust. | User walks in and out of Wi-Fi. Sync retries, server dedupes. Exactly 1 entry appears. |
| Connectivity banner flashes and causes the FlatList to jump to the top on every toggle. User gets annoyed. | Connectivity banner fades smoothly. The FlatList stays in its current scroll position. User barely notices. |
| A crash mid-SQLite write leaves the database in a "corrupt" state. App crashes on every subsequent launch. | SQLite auto-rolls back the transaction. App launches normally. Data is intact. |

---

## 7. Summary

This scenario proves that your app is resilient against "Network Chaos"—the most common real-world condition in a health app used in rural or travel-heavy settings. By combining:

- Debounced network triggers (preventing sync spam).
- Idempotent API requests (preventing duplicate data).
- Atomic SQLite transactions (preventing data corruption).
- Subtle UI banner animations (preventing UI freezes).

The app guarantees that even under the worst network flapping conditions, the user's data remains consistent, the UI remains buttery smooth, and the database remains perfectly intact. This is the hallmark of a truly offline-first, robust mobile health application. 🌸📱🌐🔄

---

# Scenario 47: The "Rapid Fire" Tapping — Race Condition on UI — Detailed Explanation

This scenario validates the "UI Resilience" against the most common user behavior pattern: impatience. It simulates the user frantically tapping the "Log Period" button (or "Save Journal") twice (or three times) in rapid succession because the app doesn't respond instantly.

The system must ensure that only one record is ever created, regardless of how many times the user mashes the button, and that the UI provides immediate visual feedback to discourage the second tap.

---

## 1. The Problem: The "Double Tap" Nightmare

| Challenge | Description |
|-----------|-------------|
| The User Behavior | User taps "Save". The app takes 200ms to process (or network latency kicks in). The user, assuming the app didn't register the tap, taps again. |
| The Mutation Trigger | The `mutate()` function is called twice. The first call kicks off the API request/queue operation. The second call kicks off another one. |
| The Data Corruption Risk | If not prevented, two identical period logs are created. If offline, two identical operations are enqueued in the `offlineStore`. |
| The UI Freeze Risk | If the button doesn't immediately disable, the UI might look unresponsive, causing the user to tap a third time. |

**The Golden Rule:** The UI must be strictly "fire-and-forget" from the user's perspective, but mathematically "single-fire" from the system's perspective. The button must become disabled (`pointer-events: none` or `disabled={true}`) the nanosecond the first tap is registered.

---

## 2. The Architecture: The "Disable on Press" Pattern

| Layer | Defense Mechanism |
|-------|------------------|
| UI Layer (The Button) | The button's `disabled` prop is bound to the mutation's `isPending` (or `isLoading`) state. As soon as the mutation fires, `isPending` becomes `true`, instantly greying out the button and blocking further taps. |
| Mutation Layer (React Query) | Even if the button fails to disable (e.g., due to a bug), React Query's `mutate` function is synchronous in its invocation. However, React Query does not inherently prevent a second `mutate` call on the same hook while the first is pending. It will queue the second mutation and fire it after the first completes (leading to duplicates). Therefore, we must rely on the UI disable. |
| Server Layer (Idempotency) | If the UI disable fails and two requests go to the server, the Idempotency-Key header ensures the server only processes one. The second request returns the cached 200 OK without creating a duplicate. |
| Offline Queue (Dedup) | If the app is offline and the UI disable fails, the second tap will call `offlineStore.enqueue()` again, creating two identical pending operations. Therefore, the UI disable layer is non-negotiable. |

---

## 3. Step-by-Step System Behavior

### Step 3A: The User Action (First Tap)

**User Action:** Taps "Log Period" on `LogPeriodScreen`.

1. **Mutation Trigger:** The `useCreateCycleEntry` hook's `mutate()` function is called.
2. **UI Response (Immediate):** The button's `disabled` prop is set to `true` (because `isPending` becomes `true`). The button text changes to "Saving...".
3. **Network/Queue:** The mutation fires (API call or offline enqueue).

---

### Step 3B: The User Action (Second Tap — 100ms later)

**User Action:** Taps the now-disabled button.

- **UI Layer:** React Native's `Pressable` (or `TouchableOpacity`) checks the `disabled` prop. Since it is `true`, the press event is ignored entirely. The `onPress` handler does not fire.
- **Result:** No duplicate mutation call. No duplicate API request. No duplicate queue entry.

---

### Step 3C: The Offline Scenario (Critical Safeguard)

1. **First Tap:** User is offline. The mutation fires, `isPending = true`, button disables. The mutation calls `offlineStore.enqueue()`.
2. **Second Tap:** Button is disabled. Tap is ignored.
3. **Result:** Exactly one entry is in the `offlineStore`.

---

### Step 3D: The Exception (If UI Disable Fails)

If the UI disabled prop is incorrectly implemented (e.g., using `isFetching` instead of `isPending`), the second tap might slip through.

- **Online:** The API sends two identical requests. The server processes the first (Idempotency-Key: `ik-1`). The second request arrives with the same Idempotency-Key. The server returns 200 with the existing record. No duplicate.
- **Offline:** Two identical operations are enqueued. When the user eventually syncs, the server processes both (with different `idempotency_keys`, because each operation generates its own). This results in duplicate data. This is why the UI disable layer is non-negotiable.

---

## 4. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| Navigation occurs before the mutation completes. | React Navigation unmounts the screen. The mutation keeps running in the background. The button is unmounted, so double-tap is irrelevant. |
| Very slow network (1-second latency). | The button is greyed out for the entire second. The user cannot tap it again. |
| User taps "Back" while mutation is pending. | The mutation continues. If it succeeds, the cache is updated. The user might return to the list later and see the new entry. |
| `isPending` remains `false` on first tap (rare bug). | If a component misuses `isLoading` instead of `isPending`, the button might stay active. The fallback is Idempotency (online) or catastrophic data loss (offline). Code review should enforce `isPending` for writes. |

---

## 5. Implementation Pattern (Mental Model)

```tsx
// Correct Implementation
const { mutate, isPending } = useCreateCycleEntry();

<Button
  label={isPending ? 'Saving...' : 'Log Period'}
  onPress={() => mutate(data)}
  disabled={isPending} // <<<<--- CRITICAL
/>
```

**Incorrect Implementation (The Bug to Avoid):**

```tsx
// ❌ WRONG: isFetching is for queries, not mutations.
const { mutate, isFetching } = useCreateCycleEntry();
<Button disabled={isFetching} /> // isFetching might not be true during the mutation!
```

---

## 6. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ No duplicate entries. | 1. Rapidly tap "Log Period" 5 times as fast as possible.<br>2. Check the server database or the offline queue.<br>3. There should be exactly 1 period log. | Proves the UI disable prevented the second tap from firing. |
| ✅ The button is disabled during submission. | 1. Tap "Log Period".<br>2. Immediately attempt to tap again while the mutation is pending.<br>3. The button should be greyed out/disabled. The `onPress` should not fire a second mutation. | Proves the `disabled` prop is correctly bound to `isPending`. |
| ✅ Server Idempotency acts as a fail-safe. | 1. Temporarily comment out the `disabled` prop in the code.<br>2. Tap "Log Period" twice rapidly (online).<br>3. Check the server. Only one record exists. | Proves that even if the UI fails, the server's Idempotency-Key prevents duplicates (safety net for online scenarios). |

---

## 7. Why This Matters (The Business Logic)

| Without UI Disable | With UI Disable |
|-------------------|-----------------|
| User taps twice → Two duplicate period logs appear on the calendar. | User taps twice → Only one period log appears. The button is greyed out on the first tap. |
| If offline, two duplicate operations accumulate in the queue. When the user syncs, the server processes both (different `idempotency_keys`) → Duplicate data. | If offline, the button is disabled on the first tap. The queue only receives one operation. |
| User loses trust: "Why does my period keep duplicating?" | User perceives the app as responsive: "It saved my period instantly." |

---

## 8. Summary

This scenario proves that your app is defensively designed against impatient users. By strictly binding the button's disabled state to the mutation's `isPending` flag, the system guarantees that:

- Only one mutation is ever triggered per user action.
- No duplicate UI feedback (multiple loading states) is ever rendered.
- The offline queue remains clean (no duplicate pending operations).

This is the simplest, yet most critical, defense against data duplication in any mobile app. Combined with server-side Idempotency, it provides a bulletproof shield against the "Rapid Fire" tap. 🌸📱🛡️

---

# Scenario 48: "The Fragile Internet" — Very Slow 2G/3G Network — Detailed Explanation

This scenario validates the "Request Cancellation" layer of your offline-first architecture. It simulates the most frustrating real-world condition for a mobile user: a painfully slow network (30KB/s) that causes an API request to hang for 10+ seconds. The user, assuming the app is broken, navigates away to another screen.

The system must immediately abort the hanging network request to preserve battery life, prevent "zombie" requests from clogging the network stack, and ensure that React Query does NOT display an error state (which would wipe out the perfectly good SQLite data the user was just looking at).

---

## 1. The Problem: The "Hanging Request" Trap

| Challenge | Description |
|-----------|-------------|
| Slow 2G/3G Network | The signal is weak. Download speed is throttled to < 30 KB/s. A 50 KB batch payload takes 2-3 seconds to upload, and the response takes 5-10 seconds. |
| User Impatience | The user waits 3 seconds, sees nothing happening, and navigates back to the Dashboard (or closes the app). |
| The "Zombie" Request | The `fetch` request is still pending in the JavaScript event loop. It is consuming memory, occupying a network socket, and potentially blocking other requests in the browser's connection pool. |
| The UI Flash Risk | When the component unmounts, React Query cancels the query. If we don't handle the cancellation properly, React Query might treat the cancellation as an error, flipping the UI to a red "Error" state and hiding the SQLite data. |

**The Golden Rule:** A user action (navigation) must immediately terminate any pending network requests that are no longer relevant. The UI must never show an error state for a user-initiated cancellation. It must seamlessly retain the SQLite cache.

---

## 2. The Architecture: The AbortController + React Query Integration

| Layer | Defense Mechanism |
|-------|------------------|
| React Query (`queryFn`) | The `queryFn` receives an `AbortSignal` object (via `context.signal` or automatically when using `fetch`). When the component unmounts, React Query calls `abort()` on this signal. |
| Fetch API | The `fetch` call must be configured with `signal: context.signal`. When the signal aborts, the `fetch` promise rejects with an `AbortError`. |
| React Query Error Handling | React Query internally distinguishes between `AbortError` (cancellation) and other errors (network failure, 500). It does not mark the query as error for abort errors. It simply keeps the existing data. |
| Memory Cleanup | The JavaScript engine automatically garbage-collects the abandoned `fetch` promise listeners once the promise rejects. No memory leaks. |

---

## 3. Step-by-Step System Behavior

### Step 3A: The Slow Network Request Begins

**User Action:** Opens `CycleHistoryScreen`. `useCycleHistory` fires.

**Query Function Execution:** The `queryFn` runs.

1. **Step 1 (Instant):** Fetches `localData` from SQLite (< 50ms). UI renders the cached history.
2. **Step 2 (Background):** Triggers an API call `GET /sync/changes` to fetch fresh data from the server.
3. **Network State:** The network is extremely slow. The `fetch` request hangs indefinitely.

---

### Step 3B: User Navigates Away (The Abort)

**User Action:** Taps the "Back" button or navigates to another tab (e.g., "Journal").

1. **Component Unmount:** The `CycleHistoryScreen` unmounts.
2. **React Query Cancellation:** React Query detects the component unmount and calls `context.signal.abort()` for any in-flight queries associated with that component.
3. **fetch Abort:** The `fetch` function receives the abort signal and immediately terminates the network request (saving battery and freeing up the network socket).
4. **Promise Rejection:** The `fetch` promise rejects with a `DOMException` (name: `AbortError`).

---

### Step 3C: React Query State (The "Non-Error")

**Error Handler:** The `queryFn` catches the `AbortError`.

```typescript
try {
  const response = await fetch(url, { signal: context.signal });
} catch (error) {
  if (error.name === 'AbortError') {
    // Do NOT rethrow. Just return the SQLite data we already have.
    return localData;
  }
  throw error; // Real network error, handle normally.
}
```

- **React Query Behavior:** Since the `queryFn` returned `localData` successfully and did not throw an error, React Query marks the query as success (not error). The UI retains the SQLite data.
- **No Error Flash:** The user navigates back to the `CycleHistoryScreen` later. The SQLite data is still there. The background refresh will retry later.

---

### Step 3D: Memory Cleanup

- **Garbage Collection:** The `AbortError` promise rejection is caught and swallowed. There are no lingering event listeners or unresolved promises. The JavaScript engine frees the memory allocated for the `fetch` request.

---

## 4. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| Abort happens mid-upload (`POST /sync/batch`). | The `fetch` aborts the upload. The server might have partially received the payload. **Mitigation:** The server uses Idempotency-Key. If the client retries, the server ignores the partial/failed attempt and uses the cached result. |
| Multiple slow requests are aborted simultaneously. | Each `queryFn` has its own `AbortSignal`. React Query aborts them all individually. No conflict. |
| User re-enters the screen immediately after aborting. | React Query triggers a new `queryFn`. It checks SQLite (cache hit) and fires a new API request. The old aborted request is dead and gone. |
| The network is slow, but the user stays on the screen. | The `fetch` request eventually succeeds (or times out). If it times out (non-abort), React Query marks the query as error (if no data exists) OR keeps the stale data (if `placeholderData`/`initialData` is used). Since we use SQLite-first, the UI retains the SQLite data even on a timeout. |

---

## 5. Implementation Pattern (Mental Model)

```typescript
// src/services/queries/useCycleHistory.ts
export function useCycleHistory() {
  return useQuery({
    queryKey: ['cycle', 'entries'],
    queryFn: async (context) => {
      const userId = useAuthStore.getState().user?.id;
      
      // 1. Read SQLite FIRST (Instant render)
      const localData = await localDb.cycle.getHistory(userId);
      
      // 2. Fire background API with AbortSignal
      try {
        const response = await fetch('/api/v1/cycles', {
          signal: context.signal, // <<--- CRITICAL: Pass the signal
        });
        const freshData = await response.json();
        await localDb.cycle.upsertMany(freshData);
        // Invalidate to re-fetch (which will return SQLite data)
        queryClient.invalidateQueries({ queryKey: ['cycle', 'entries'] });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          // SWALLOW: User navigated away. Do nothing.
          logger.debug('Background fetch aborted due to navigation.');
        } else {
          // LOG: Real network error.
          logger.error('Background fetch failed', error);
        }
      }
      
      // 3. Return SQLite data immediately
      return localData;
    },
  });
}
```

---

## 6. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Old SQLite data remains visible. | 1. Throttle the network to "Slow 3G" (30 KB/s) in the simulator.<br>2. Open CycleHistory. SQLite data renders instantly.<br>3. Immediately navigate to a different screen (before the API responds).<br>4. Navigate back to CycleHistory. The data should still be visible, not an "Error" state. | Proves that React Query correctly handles the `AbortError` and does not transition to an error state. |
| ✅ No pending zombie requests blocking the UI. | 1. Open the Network tab in the React Native Debugger or Charles Proxy.<br>2. Trigger a slow request, abort it via navigation.<br>3. The request should disappear from the "Pending" list immediately.<br>4. Verify the app's network thread is not locked (you can fire other requests smoothly). | Proves the `AbortController` is correctly cancelling the underlying `fetch` operation, freeing up system resources. |

---

## 7. Why This Matters (The Business Logic)

| Without AbortController | With AbortController |
|-------------------------|----------------------|
| User navigates away. The 10-second request hangs in the background, draining battery and holding a network socket. | User navigates away. The request is aborted instantly. Battery saved. |
| The user re-enters the screen. The old stale "zombie" request finally completes and overwrites the SQLite data, possibly with outdated data or causing a UI refresh. | The old request is dead. A fresh request starts cleanly. |
| The UI flashes an error briefly as the component unmounts, confusing the user. | The UI remains stable and smooth. The user never sees a "Network Error" popup due to their own navigation. |

---

## 8. Summary

This scenario proves that your app respects the user's "Attention Budget". By integrating React Query's `AbortSignal` with the `fetch` API, the system guarantees that:

- Slow requests are terminated immediately when the user navigates away.
- Battery life is preserved by aborting unnecessary network tasks.
- UI stability is maintained because React Query correctly distinguishes between a user-initiated cancellation (not an error) and a real network failure.

This is the hallmark of a polished, battery-conscious, and responsive mobile health app. 🌸📱🔄

---

# Scenario 49: The "Desync" — SQLite vs. Backend Discrepancy — Detailed Explanation

This scenario validates the "Timestamp Authority" principle against data drift. It simulates the most subtle and dangerous multi-device bug: the local SQLite database and the server's PostgreSQL database both have the same record (ID: `abc-123`), but their `updated_at` timestamps have diverged.

This desync can occur due to:

- A genuine multi-device edit: The user edited the record on their laptop (web) 2 hours ago (server timestamp updated), but their phone never pulled the fresh data because it was offline.
- System Clock Drift: The user's phone clock is 2 minutes ahead of the server's clock, causing `new Date()` on the phone to generate a timestamp slightly different from the server's reality.

When the user tries to edit this record offline, the local `client_updated_at` is generated. Upon reconnection, the server must detect this subtle timestamp mismatch and enforce the latest truth, preventing a corrupted "merge" of stale data.

---

## 1. The Problem: The "Clock Skew" and "Zombie Edit" Traps

| Challenge | Description |
|-----------|-------------|
| The Desync Scenario | Server has Record (id: `abc-123`) with `updated_at = 2025-07-15T10:00:00Z`. SQLite has the same record, but due to a missing sync, its `updated_at = 2025-07-15T08:00:00Z` (or the client clock is skewing the time). |
| User Action | User edits the record offline. The mobile app sets `client_updated_at = 2025-07-15T08:30:00Z` (the time of the offline edit). |
| The Sync Race | User reconnects. The sync engine pushes the edit with the `client_updated_at` timestamp. |
| The Risk (The "Corruption" Merge) | If the server blindly applies the update based on the Idempotency-Key or `temp_id` without checking the timestamp, it will overwrite the server's newer data (10:00 AM) with the older offline edit (8:30 AM). The user's newer web edit is lost. |

**The Golden Rule:** Timestamps are the absolute arbiters of truth. The server must strictly compare the incoming `client_updated_at` with its current `updated_at`. If the server's timestamp is newer, the server must reject the client's edit and force the client to adopt the server's version.

---

## 2. The Architecture: The "Strict Timestamp Authority" Chain

| Layer | Defense Mechanism |
|-------|------------------|
| Mobile (Offline Edit) | Generates `client_updated_at` using `new Date().toISOString()`. This is attached to the pending operation in EncryptedStorage. |
| Sync Engine (Push) | Sends the update to `POST /sync/batch` with the `X-Client-Updated-At` header (or the body field). |
| Server (Conflict Detection) | Compares `incoming_timestamp` with `record.updated_at`. If `record.updated_at > incoming_timestamp`, returns a 409 Conflict with the full `server_data`. |
| Mobile (Conflict Handler) | Calls `hydrateSqlite(server_data)` to overwrite the stale local record, discards the pending operation, and shows a toast. |

---

## 3. Step-by-Step System Behavior

### Step 3A: Pre-Condition (The Desync)

- **Server (Postgres):** Record ID: `abc-123`, Content: "Hello World", `updated_at = 2025-07-15T10:00:00Z` (edited via Web).
- **SQLite (Mobile):** Record ID: `abc-123`, Content: "Hello World", `updated_at = 2025-07-15T08:00:00Z` (stale, never pulled the web update).

---

### Step 3B: User Edits Offline

**User Action:** User edits the record content to "Goodbye World" on the mobile app.

1. **Optimistic UI:** React Query updates the cache locally.
2. **Queue Entry:** `offlineStore.enqueue()` creates an operation with:
   - `type`: `'journal/update'`
   - `data`: `{ id: 'abc-123', content: 'Goodbye World' }`
   - `client_updated_at`: `'2025-07-15T08:30:00Z'` (The time of the offline edit).

---

### Step 3C: Reconnection & Sync Push

1. **Event:** User walks into a Wi-Fi zone.
2. **Sync Engine:** `pushOperations()` sends the UPDATE to the server.

---

### Step 3D: Server Conflict Detection

1. **Server Check:** The server fetches the current record (`abc-123`).
   - `Server updated_at = 2025-07-15T10:00:00Z`.
2. **Comparison:** `server_updated_at` (10:00) > `client_updated_at` (08:30). **CONFLICT DETECTED.**

**Server Response (409):**

```json
{
  "status": "conflict",
  "server_data": {
    "id": "abc-123",
    "content": "Hello World",
    "updated_at": "2025-07-15T10:00:00Z"
  }
}
```

---

### Step 3E: Mobile Conflict Handler

1. **Queue Discard:** `offlineStore.discard(op.id)` is called. The pending "Goodbye World" operation is removed.
2. **SQLite Overwrite:** `hydrateSqlite(server_data)` is called.
   - SQLite updates the record to reflect the server's truth: Content = "Hello World", `updated_at = "2025-07-15T10:00:00Z"`.
3. **UI Refresh:** `queryClient.invalidateQueries()` runs.
4. **UI Render:** The screen re-renders showing "Hello World" (the server's version).
5. **User Notification:** A toast appears: "Updated from another device. Your latest edit was overwritten."

---

## 4. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| Client Clock is ahead (08:30 vs Server 08:00). | If the client clock is ahead, `client_updated_at` might be 10:30, which is > server 10:00. The server accepts the update (200 OK), and the server timestamp is updated to 10:30. Result: The user's edit wins (which is correct, because they performed the action later on their device's clock). |
| Server timestamp clamp (future dates). | To prevent a buggy device with a date set to 2099 from overwriting everything, the server clamps `client_updated_at` to `NOW()` if it is > 5 minutes in the future. |
| The edit is on a different field (e.g., Title vs Content). | The server uses the `updated_at` of the entire record. If the server touched the Content field, and the client tries to edit the Title field, the client still loses if their `updated_at` is older. This prevents "split-brain" syndrome. |
| Multiple pending operations in the queue (CREATE + UPDATE). | The FIFO logic applies. The UPDATE is discarded because the CREATE might have resolved to a different ID. `removeCascading()` handles this. |

---

## 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Conflict resolution handles timestamp mismatches. | 1. Manually update a record on the server (SQL) to a newer timestamp.<br>2. Simulate an offline edit of the same record on the mobile app.<br>3. Sync.<br>4. The server must return a 409, and the mobile app must overwrite SQLite with the server data. | Proves the `client_updated_at` header is correctly parsed and compared against the database's `updated_at` column. |
| ✅ No data corruption. | After the conflict sync, check the local SQLite record. The content should match the server's version (the "newer" version). The offline queue should be empty for that operation. | Proves that the conflict resolution logic is not just returning a 409 but also correctly discarding the local stale data and adopting the server truth. |

---

## 6. Why This Matters (The Business Logic)

| Without Timestamp Authority | With Timestamp Authority |
|------------------------------|--------------------------|
| Offline edit (08:30) overwrites Web edit (10:00). User loses their newer changes. | Web edit (10:00) is preserved. Offline edit is discarded. Data converges to the latest truth. |
| User complains: "My edit disappeared!" (The app broke the law of "last write wins"). | User receives a clear toast: "Updated from another device." They understand why their edit was reverted. |
| Debugging is a nightmare because you have to trace multi-device timestamps manually. | The system automatically enforces consistency. No manual intervention required. |

---

## 7. Summary

This scenario proves that your sync engine is strictly governed by time. By enforcing server-side timestamp authority:

- The server always wins if its timestamp is newer.
- The client gracefully retreats, overwriting its local SQLite and discarding the stale pending operation.
- The user is notified with a subtle toast, building trust in the system's consistency.

This is the definitive safeguard against "clock skew" and "zombie edits," ensuring that the last actual user action (by timestamp) always prevails across all devices. 🌸🛡️⏱️

---

# Scenario 50: "The Midnight Rollover" — DST/Timezone Shift — Detailed Explanation

This scenario validates the "Absolute Timezone Immunity" of your date handling layer. It simulates the most treacherous timing edge case: a user logging a period end date at the exact moment of a Daylight Saving Time (DST) transition (e.g., the "fall back" shift at 2:00 AM where clocks go back to 1:00 AM, or the "spring forward" shift at 1:59 AM where clocks jump to 3:00 AM).

If the date picker relies on the device's local Date object (which shifts with the DST change), the selected date could "jump" backward or forward by one day. The system must ensure that the user's selected date is the absolute, immutable truth, independent of the phone's timezone or DST status.

---

## 1. The Problem: The "One-Hour Ghost" Trap

| Challenge | Description |
|-----------|-------------|
| The "Fall Back" Trap (End of DST) | In Autumn, clocks shift from 2:00 AM to 1:00 AM. If the user selects a date at 11:59 PM, and the clock rolls back to 11:00 PM without skipping a day, the local Date object might interpret the selection as occurring on the previous day due to the negative timezone offset shift. |
| The "Spring Forward" Trap (Start of DST) | In Spring, clocks jump from 1:59 AM to 3:00 AM. The hour between 2:00 AM and 2:59 AM never exists. If the date picker uses `new Date('2025-03-09')` (which is midnight UTC), and the user is in a timezone that springs forward, the local representation might display as the previous day at 11:00 PM, causing an off-by-one error. |
| The `Date.getHours()` Pitfall | If the app uses `date.getHours()` to determine "today" (e.g., `if (date.getHours() < 12)`), the DST shift will break this logic. |

**The Golden Rule:** Calendar dates are abstract entities. They must be treated as strings (`YYYY-MM-DD`). We must never use `.getHours()`, `.getMinutes()`, or `.getTimezoneOffset()` to determine the day of a date. The only valid operations are `.getUTCFullYear()`, `.getUTCMonth()`, and `.getUTCDate()` (or simply parsing the ISO string directly).

---

## 2. The Architecture: The "UTC-Only String" Pipeline

| Layer | Defense Mechanism |
|-------|------------------|
| DatePicker Input | The React Native `@react-native-community/datetimepicker` returns a JS Date object. This object represents midnight UTC of the selected day. The app immediately extracts the ISO string using `toISOString().split('T')[0]` (which returns `YYYY-MM-DD` in UTC). |
| Storage (SQLite) | Stores the date as a pure TEXT string: `'2025-10-15'`. No timezone, no time component. |
| Display (`formatDisplayDate`) | When rendering the date, the app creates a new Date object from the ISO string (`new Date('2025-10-15')`). It then extracts the year/month/day using `.getUTCFullYear()`, `.getUTCMonth()`, `.getUTCDate()`. |
| Calendar Logic (Compare dates) | When comparing dates (e.g., "Is today the same as the predicted start?"), the app compares the raw ISO strings directly (`'2025-10-15' === '2025-10-15'`), or uses `date-fns isSameDay` (which operates in UTC). |

---

## 3. Step-by-Step System Behavior

### Step 3A: The Date Picker Interaction (At 11:59 PM on DST Night)

**User Action:** User opens the date picker to mark the end date of her period. She selects October 15, 2025.

1. **JS Date Object:** The picker returns a Date object representing `2025-10-15T00:00:00.000Z` (midnight UTC).
2. **Immediate Extraction:** The mutation handler calls `toDateStr(selectedDate)`:

```typescript
export function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]; // '2025-10-15'
}
```

3. **Storage:** SQLite stores `period_end_date = '2025-10-15'`.

---

### Step 3B: The DST Shift Occurs (Midnight Transition)

- **Background:** The device's timezone shifts from UTC-4 to UTC-5 (fall back) at 2:00 AM. The system clock jumps from 1:59 AM to 1:00 AM.
- **Local Date Representation (If using `getHours`):** `new Date('2025-10-15')` in the new timezone might now represent `2025-10-14T23:00:00` (local time). If we used `.getDate()` (local), we would see 14.
- **However, the app uses `.getUTCDate()`:** `date.getUTCDate()` returns 15 regardless of the local timezone shift.
- **Result:** The UI displays October 15 consistently.

---

### Step 3C: The "Today" Button Logic

**User Action:** Taps the "Today" button on the date picker.

**Implementation:** The button must NOT use `new Date().getDate()` directly.

```typescript
// ✅ CORRECT
const today = new Date();
const todayStr = toDateStr(today); // Uses UTC extraction
```

**DST Immunity:** Even if the system clock has shifted due to DST, `toDateStr(today)` extracts the UTC year/month/day, which corresponds to the actual calendar day the user is experiencing (the same day the system clock says it is).

---

### Step 3D: The Calendar Rendering (Comparing Dates)

1. **Prediction:** The system predicted the period end date as `'2025-10-15'`.
2. **User Log:** The user logs `'2025-10-15'`.
3. **Comparison:** The `queryFn` compares the ISO strings directly. Since they match, the calendar marks the period as "Confirmed." No off-by-one errors.

---

## 4. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| User travels across timezones during the period. | The ISO string `'2025-10-15'` is unchanged. The calendar displays correctly in the new timezone because the UTC getters are used. |
| Server uses timestamps (Zulu) vs local. | The server stores dates as `DATE` (which is timezone-naive in PostgreSQL if we use Date type). The API returns `YYYY-MM-DD`. This matches the mobile's format. |
| Daylight Saving "Spring Forward" (missing hour). | The user selects a date at 1:30 AM. The system clock springs forward to 3:00 AM. The Date object (`2025-03-09T00:00:00Z`) is created before the shift. The UTC extraction still returns `2025-03-09`. Safe. |
| User manually enters a date string (text input). | The validation schema (zod or yup) must strictly enforce `YYYY-MM-DD` and reject any timezone offsets (e.g., `+05:45`). |

---

## 5. The Code Level Rules (Enforcement)

To guarantee this behavior across the entire app, these rules must be enforced in code review:

- **Store:** Always store dates as ISO strings (`YYYY-MM-DD`). Never store Date objects directly in AsyncStorage or the Redux/Zustand state.
- **Read:** When reading from SQLite, treat the string as a pure date. If you must create a Date object, do so with `new Date(string + 'T00:00:00Z')` or simply use `date-fns parseISO`.
- **Display:** Use `formatDisplayDate` (which wraps `.getUTCDate()`).
- **Input:** When the user selects a date from the picker, immediately convert it to UTC using `Date.UTC(year, month, day)` or `new Date(year, month, day)` and then normalize it via `toDateStr`.
- **Compare:** Use `date-fns isSameDay` (which works in UTC) or compare ISO strings directly (`'2025-10-15' === '2025-10-15'`).

---

## 6. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ DST shifts do not change the selected date. | 1. Set the device timezone to a region that observes DST (e.g., New York).<br>2. Set the date to exactly the DST transition date (e.g., Nov 1, 2025, at 11:59 PM).<br>3. Use the date picker to select Nov 1.<br>4. Let the clock transition occur (or mock the time).<br>5. Reopen the app and check the stored date. It should still be `'2025-11-01'`. | Proves the UTC extraction is immune to the local timezone shift. |
| ✅ Calendar dates remain accurate. | 1. Log a period start on Oct 31 (ISO: `'2025-10-31'`).<br>2. Simulate a DST shift.<br>3. Open the Calendar screen.<br>4. The period block should still appear on October 31, not shifted to November 1 or October 30. | Proves the `formatDisplayDate` function correctly uses `.getUTCDate()` to draw the grid. |

---

## 7. Why This Matters (The Business Logic)

| Without UTC-Only Storage | With UTC-Only Storage |
|--------------------------|-----------------------|
| User logs a period on the exact DST transition day. The app stores the date as the previous day (due to local time parsing). The cycle history is wrong forever. | User logs a period on the DST transition day. The app stores the correct UTC day. The cycle history is accurate. |
| Push notifications for "Check-in" (Day 3) might fire 1 day early or late if the server and client clocks are misaligned. | Notifications are scheduled based on UTC ISO strings. They fire on the exact UTC day, which matches the user's actual calendar day (since the user's local date is derived from UTC). |
| User loses trust in the app: "My period was on the 15th, but the app says the 14th!" | User sees exactly what they selected. The app is unshakeable. |

---

## 8. Summary

This scenario proves that your app is immortal against timezone and DST chaos. By:

- Storing dates exclusively as ISO strings (`YYYY-MM-DD`).
- Extracting year/month/day using `.getUTCFullYear()`, `.getUTCMonth()`, `.getUTCDate()`.
- Never using `.getHours()`, `.getTimezoneOffset()`, or `.toLocaleDateString()` for calendar logic.

The app guarantees that a period logged in the split-second of a DST transition remains permanently anchored to the correct calendar day. This is the hallmark of a truly global, timezone-agnostic health app. 🌸📅🌍
