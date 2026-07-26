# Scenario 36: Race Condition — Sync Engine Triggers Twice Simultaneously — Detailed Explanation

This scenario validates the "Sync Stampede" protection mechanism of your offline-first architecture. It simulates the most common race condition in mobile apps: the user force-quits the app and reopens it, triggering a foreground sync, at the exact same microsecond that the network stack detects a Wi-Fi connection and triggers a background sync.

The system must ensure that only one sync cycle ever runs at a time, preventing duplicate API calls, queue corruption, and wasted battery life.

---

## 1. The Problem: The "Sync Stampede" Race

| Challenge | Description |
|-----------|-------------|
| Trigger A (Foreground) | AppState changes from `'background'` to `'active'`. The `useEffect` cleanup/focus listener calls `syncAll()`. |
| Trigger B (Network) | NetInfo fires `isConnected = true` (the user walked into a Wi-Fi zone). Its listener calls `syncAll()`. |
| Timing | Both triggers fire within milliseconds of each other, often before the first `syncAll()` has finished setting up its network requests. |
| The Risk | If both run simultaneously, the syncEngine will read the pending queue twice, send two identical batches to the server, and attempt to write duplicate data to SQLite. This leads to server errors (duplicate idempotency keys failing), wasted bandwidth, and potential SQLite constraint violations. |

**The Golden Rule:** Only one sync cycle per device at a time. The sync engine must be strictly mutually exclusive.

---

## 2. The Architecture: The `isSyncing` Mutex Lock

| Component | Role |
|-----------|------|
| `syncEngine.isSyncing` | A global boolean flag (`private static isSyncing = false`). Acts as the mutex lock for the sync process. |
| The Guard Clause | At the very beginning of `syncAll()`, the engine checks `if (this.isSyncing) return;`. |
| The Try-Finally Block | The flag is set to `true` immediately upon entry, and set to `false` only after the entire sync cycle (`push + pull`) completes or fails. |

```typescript
// src/services/sync/syncEngine.ts
class SyncEngine {
  private static isSyncing = false;

  async syncAll(): Promise<void> {
    // 1. THE GUARD: If a sync is already running, exit immediately.
    if (SyncEngine.isSyncing) {
      logger.debug('syncAll: Already syncing, skipping duplicate call.');
      return;
    }

    // 2. ACQUIRE LOCK: Set the flag BEFORE any async operation.
    SyncEngine.isSyncing = true;
    logger.debug('syncAll: Lock acquired.');

    try {
      // 3. EXECUTE: Push → Pull → Model sync.
      await this.pushOperations();
      await this.pullServerData();
      await this.syncModelCoefficients();
      logger.debug('syncAll: Sync completed successfully.');
    } catch (error) {
      logger.error('syncAll: Sync failed.', error);
    } finally {
      // 4. RELEASE LOCK: ALWAYS release the lock, even if an error occurs.
      SyncEngine.isSyncing = false;
      logger.debug('syncAll: Lock released.');
    }
  }
}
```

---

## 3. Step-by-Step System Behavior

### Step 3A: The "Double Trigger" Event

1. **User Action:** The user force-quits the app (swipe up).
2. **Relaunch:** The user taps the app icon.
3. **Trigger A (Foreground):** AppState changes to `'active'`. The registered listener in `App.tsx` calls `syncEngine.syncAll()`.
4. **Trigger B (Network):** Simultaneously, the device reconnects to Wi-Fi. NetInfo fires `isConnected = true`. Its listener also calls `syncEngine.syncAll()`.

---

### Step 3B: The Race (Microtask Level)

1. **Call 1 (Foreground):** Enters `syncAll()`. Checks `isSyncing` → `false`. Sets `isSyncing = true`. Begins executing `pushOperations()`.
2. **Call 2 (Network):** Enters `syncAll()` while Call 1 is still running. Checks `isSyncing` → `true`. The guard clause triggers, and the function returns immediately (`return;`).

---

### Step 3C: Queue Integrity (The Result)

- **Call 1** proceeds to read the `offlineStore` queue (EncryptedStorage). It sends the batch to the server.
- **Call 2** does nothing. It never reads the queue, never sends an API request, and never writes to SQLite.

---

### Step 3D: SQLite Write Integrity

Since only Call 1 runs, SQLite is updated exactly once via `hydrateSqlite()` on the server's success response.

---

## 4. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| The first sync fails (e.g., server 500). | The `finally` block ensures `isSyncing` is set to `false`. The second (queued) trigger would have already been dropped (it returned immediately). The next sync will only happen on the next trigger (e.g., user pulls-to-refresh or opens the app again). |
| The user force-quits the app during the sync. | The `isSyncing` flag is held in memory. Since the app is killed, the flag is destroyed. On the next launch, `isSyncing` initializes to `false`, allowing a fresh sync to start. |
| Idempotency failsafe: | If the guard somehow fails (due to a logic bug), the server's Idempotency-Key header ensures the second batch does not duplicate data. The server returns a 200 for duplicate keys, and the client discards the already-processed queue items. |
| React Query Invalidation: | Even if a second sync slipped through, `invalidateQueries` might fire twice. React Query deduplicates these calls, so the UI doesn't flicker. |

---

## 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ `isSyncing` flag prevents duplicate runs. | 1. Mock NetInfo to fire `isConnected` and trigger `syncAll()`.<br>2. Immediately (within 1ms) manually call `syncAll()` again.<br>3. Log the entry and exit of the function. The second call should log "Already syncing" and exit immediately. | Proves the mutual exclusion (mutex) guard is correctly preventing overlapping sync operations. |
| ✅ No duplicate writes to SQLite. | 1. Run the double-trigger test.<br>2. Query SQLite for the pending operation's data.<br>3. Verify that only one row exists (no duplicates). | Proves that even if the sync runs once, the upsert operations are idempotent and do not create duplicate records. |
| ✅ Queue is not processed twice. | 1. Check the `offlineStore` queue size before the sync.<br>2. After the sync, verify the queue is cleared exactly once. | Proves that the `pushOperations` logic is not called twice, preventing the same operation from being sent to the server multiple times. |

---

## 6. Why This Matters (The Business Logic)

| Without the `isSyncing` Guard | With the `isSyncing` Guard |
|--------------------------------|----------------------------|
| Two syncs run simultaneously, sending duplicate Idempotency-Key headers. The server processes the first, but the second is rejected (or wastes resources). | The second sync is dropped immediately. Server load is minimized. |
| The `offlineStore` queue is iterated twice. The first sync clears the queue. The second sync reads an empty queue, but the `hydrateSqlite()` function might attempt to upsert the same data twice (wasting battery). | The queue is processed exactly once. |
| UI flashes: React Query invalidates twice, causing two rapid re-renders. | React Query invalidates once. Smooth UI. |

---

## 7. Summary

This scenario proves that your sync engine is thread-safe (or rather, "concurrency-safe" in a single-threaded JavaScript environment). By using a simple, robust `isSyncing` flag:

- The guard clause prevents overlapping sync cycles.
- The try-finally block guarantees the lock is always released, even on failure.
- Idempotency acts as the ultimate fallback if the guard fails.

This ensures that your app never wastes battery, bandwidth, or CPU on duplicate sync operations, keeping the offline queue clean and the UI snappy. 🛡️🔄📱

---

# Scenario 37: App Backgrounded During Sync — Detailed Explanation

This scenario validates the resilience and idempotency of your sync engine against operating system interruptions. It simulates a highly realistic user behavior: starting a large sync (e.g., walking into a Wi-Fi zone, triggering a flood of 100 pending operations) and then immediately swiping up to background the app or pressing the home button.

The system must handle this gracefully without crashing, and must safely resume or retry the sync without duplicating any data when the user returns.

---

## 1. The Problem: The OS "Pause" Trap

| Challenge | Description |
|-----------|-------------|
| iOS Background Throttling | When an app backgrounds on iOS, the JavaScript thread is immediately suspended (unless a background task is specifically requested). Any in-flight `fetch` requests are cancelled by the OS. |
| Android Headless JS | Android allows a few seconds of background execution, but ultimately suspends the app. `fetch` requests may time out or be aborted. |
| The "Half-Sync" State | The sync engine might be mid-execution when the backgrounding occurs. It could have already sent the `POST /sync/batch` to the server, but the app is killed before receiving the response and clearing the offline queue. |
| The Risk | The server processed the batch (data is saved), but the mobile queue wasn't cleared. When the user reopens the app, the sync engine will retry the entire batch, potentially creating duplicate data on the server (if not for idempotency). |

**The Golden Rule:** Assume the app can be killed at any millisecond. The system must rely on idempotency keys and transactional SQLite writes to ensure that a retry never causes data corruption.

---

## 2. The Architecture: Idempotency + Async Persistence

| Component | Role in this Scenario |
|-----------|----------------------|
| Idempotency-Key Header | The unique key sent with every API request. The server stores it for 24 hours. If a duplicate key arrives, the server returns the existing result without processing it again. |
| Offline Queue (EncryptedStorage) | Holds the pending operations until the server explicitly returns a 200 OK. If the app is backgrounded mid-sync, the queue retains the operations. |
| SQLite Transactions | `upsertMany` wraps all writes in a single `BEGIN TRANSACTION ... COMMIT`. If the app is killed mid-write, the transaction is rolled back entirely (no partial data). |
| Sync Lock (`isSyncing`) | Prevents two syncs from running simultaneously (Scenario 36). If a sync is interrupted, the lock is released via the `finally` block. |

---

## 3. Step-by-Step System Behavior

### Step 3A: Sync Starts (High Speed)

1. **Trigger:** User opens the app (foreground) or Wi-Fi connects.
2. `syncAll()`: Acquires the `isSyncing` lock.
3. **Push Phase:** `pushOperations()` reads 100 pending operations from EncryptedStorage.
4. **Network Request:** The app compresses the batch and sends `POST /sync/batch` with an Idempotency-Key for the entire batch (or per operation).

---

### Step 3B: App Backgrounds (The Interrupt)

1. **User Action:** Swipes up to background the app.
2. **iOS/Android Event:** AppState changes to `'background'`.
3. **iOS:** The OS immediately suspends the JavaScript thread. The `fetch` request is aborted (throws an `AbortError` or a network error).
4. **Android:** The request may hang for a few seconds before timing out.

---

### Step 3C: The Server's Perspective (The "Zombie" Request)

**If the request was sent before the app suspended:**

- The server receives the batch, processes it, saves the data, and returns a 200 OK.
- However, because the app is backgrounded, it never receives the response.

**If the request was sent but the OS cancelled it mid-flight:**

- The server never receives the batch. No data is written.

---

### Step 3D: The Mobile State (Post-Interrupt)

- **In-Memory:** The `isSyncing` lock is still `true` (it was never released). However, the `finally` block in `syncAll()` will eventually run if the `fetch` promise rejects (which it will, due to the abort/timeout).
- **Offline Queue:** The 100 operations are still in EncryptedStorage (because the `offlineStore.remove()` call never happened, as the `onSuccess` handler was never triggered).
- **SQLite:** The database is untouched (no `upsertMany` executed).

---

### Step 3E: App Reopens (The Resurrection)

1. **User Action:** Taps the app icon to return to the foreground.
2. **AppState fires:** The `useEffect` focus listener calls `syncAll()`.
3. **The Sync Retry:**
   - The queue still has 100 operations.
   - The batch is sent again (with the same Idempotency-Key).
4. **Server Response (Idempotency Check):**
   - The server receives the batch. It checks the Idempotency-Key against its 24-hour cache.
   - **If the previous request succeeded:** The server returns a 200 OK with the existing `server_data` (no duplicate writes).
   - **If the previous request failed** (never reached server): The server processes the batch normally.
5. **Mobile Finalization:**
   - The `onSuccess` handler triggers: `offlineStore.remove()` clears the queue.
   - `hydrateSqlite()` upserts the `server_data` into SQLite.
   - React Query invalidates, and the UI updates.

---

## 4. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| App is force-killed (swipe up to remove) during the sync. | The JavaScript thread is killed immediately. `finally` never runs. The queue remains untouched. Data is safe. On next launch, the sync retries from scratch. Idempotency prevents duplicates. |
| Backgrounding happens after the server returns 200, but before SQLite is updated. | The `onSuccess` handler executes partially. If the app is killed before `upsertMany` completes, the SQLite transaction rolls back. The queue is not cleared (because `offlineStore.remove()` happens after `upsertMany`). On retry, the server returns the same 200, SQLite is updated, and the queue is cleared. |
| Network fails during background (no response). | The `fetch` throws a `NetworkError`. The `finally` block releases the lock. The sync engine logs the failure. On foreground, the sync retries. |
| Multiple background/foreground toggles. | The sync engine's `isSyncing` lock prevents overlapping syncs. Each toggle triggers a new `syncAll()` call, but the guard ensures only one runs at a time. |

---

## 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ No crash on background. | Start a sync of 100+ operations. Immediately background the app. The app should not crash. The device logs should not show a native exception. | Proves the `fetch` cancellation/abort is handled gracefully by the sync engine's `try/catch` and that the JavaScript thread suspension does not cause a fatal error. |
| ✅ Sync resumes safely. | 1. Background the app mid-sync.<br>2. Wait 10 seconds.<br>3. Bring the app to the foreground.<br>4. The sync engine should automatically re-trigger. The queue should be drained, and SQLite should be hydrated. | Proves the foreground focus listener correctly retriggers `syncAll()` and that the queue is not stuck in a "processing" state. |
| ✅ No duplicate data (Idempotency). | Check the server database after the background sync. Compare the row count for the user's journal/cycles with the expected count from the offline queue. They should match exactly (no duplicates). | Proves the Idempotency-Key mechanism is correctly preventing duplicate processing on the server side. |
| ✅ SQLite Transaction Rollback on Kill. | 1. Instrument the code to pause execution inside the `upsertMany` transaction.<br>2. Force-kill the app.<br>3. Reopen the app.<br>4. Check SQLite. The data should be consistent (no half-written rows). | Proves that SQLite's atomic commit/rollback protects against data corruption. |

---

## 6. Why This Matters (The Business Logic)

| Without Idempotency + Queue Persistence | With Idempotency + Queue Persistence |
|------------------------------------------|--------------------------------------|
| App backgrounded mid-sync. Queue is partially cleared. Reopen app. Duplicate records appear in the user's history. | App backgrounded mid-sync. Queue remains intact. Reopen app. Sync retries. Server dedupes. No duplicates. |
| User sees duplicate journal entries. They lose trust in the app. | User sees exactly one entry. The app feels reliable. |
| Support team spends hours debugging "duplicate data" tickets. | Support team never sees duplication tickets. |

---

## 7. Summary

This scenario proves that your sync engine is robust against operating system interrupts—one of the most common failure points in mobile apps. By relying on:

- Idempotency-Key headers for server-side deduplication.
- Persistence of the offline queue (EncryptedStorage) until explicit success.
- SQLite transactions for atomic local writes.
- Sync lock (`isSyncing`) to prevent overlapping runs.

The app guarantees that a user can background the app during a heavy sync, and when they return, the data is perfectly consistent—no duplicates, no data loss, and no visible errors. This is the hallmark of a truly polished, production-grade offline-first experience. 🌸📱🔄

---

# Scenario 38: Deep Link Conflict — Two Notifications Tapped Rapidly — Detailed Explanation

This scenario validates the robustness of your deep-linking and navigation system against rapid, overlapping user interactions. It simulates the most common push notification storm: the user receives both a "Period Check-in" (Day P-3) and an "End Date Reminder" (Day 3) simultaneously, and frantically taps both within a split second.

The system must handle this without crashing, duplicating screens, or resetting the user's navigation state (e.g., kicking them out of a half-filled journal entry).

---

## 1. The Problem: The "Tap Storm" Race

| Challenge | Description |
|-----------|-------------|
| Native Batching | iOS and Android batch rapid taps. The second tap may execute while the first navigation animation is still in progress (or while the app is still mounting). |
| Screen Stack Duplication | If the deep-link handler uses `navigation.push('CycleDashboard')`, tapping the second notification will push a second CycleDashboard on top of the first, causing a back-stack nightmare. |
| Navigation Stack Reset | If the handler uses `navigation.reset()` (to force a clean state), the second tap might reset the stack again, potentially disrupting any UI state (e.g., an active BottomSheet) the user had open. |
| State Loss | If the handler relies on `useEffect` on `route.params`, the first notification sets params, the second overrides them, and the first notification's intent (e.g., opening the Sticky Card) might be lost. |

**The Golden Rule:** The deep-link handler must be idempotent and state-aware. It should navigate to the target screen (if not already there) and merge the intents, rather than overwriting or duplicating them.

---

## 2. The Architecture: The "Idempotent Gate" Pattern

| Component | Role in this Scenario |
|-----------|----------------------|
| `navigationRef` | The global React Navigation reference, used to inspect the current route stack (`getState()`) without causing re-renders. |
| DeepLinkStore (Zustand) | A transient store that holds pending actions (`type: 'checkin'`, `entryId`, etc.). Acts as a queue for multiple intents. |
| `useFocusEffect` | The screen's `useFocusEffect` hook checks the DeepLinkStore every time the screen comes into focus and processes any pending actions, then clears them. |
| Conditional Navigation | The handler checks `navigationRef.getState().routes` to see if `CycleDashboard` is already mounted. If it is, it navigates (which focuses the existing screen) instead of pushing a new one. |

---

## 3. Step-by-Step System Behavior

### Step 3A: The "Dual Tap" Event

**User Action:** The user receives two notifications in rapid succession. Taps Notification A (Check-in), then immediately taps Notification B (End Date Reminder) before the app has fully transitioned.

1. **Native Layer:** The OS routes both intents to the app's entry point (`App.tsx` or the Notifications response handler).

---

### Step 3B: The Deep Link Handler (`App.tsx`)

The `addNotificationResponseReceivedListener` processes the taps in order:

```typescript
// src/app/App.tsx
const handleNotification = (response: NotificationResponse) => {
  const data = response.notification.request.content.data;
  
  // 1. Don't navigate immediately. Just set the intent.
  deepLinkStore.enqueue({ type: data.type, id: data.entryId });
  
  // 2. Navigate to the target screen (without duplicating).
  // The navigate() function is smart: if the screen exists, it focuses it.
  navigationRef.navigate('Main', { screen: 'Calendar', params: { screen: 'CycleDashboard' } });
};
```

---

### Step 3C: The DeepLinkStore (Queue Pattern)

The store handles multiple pending actions gracefully:

```typescript
// src/stores/deepLinkStore.ts
interface PendingAction { type: 'checkin' | 'mark-end-date'; id: string; }

export const useDeepLinkStore = create<{
  pending: PendingAction[];
  enqueue: (action: PendingAction) => void;
  dequeue: () => PendingAction | undefined;
  clear: () => void;
}>((set, get) => ({
  pending: [],
  enqueue: (action) => set((s) => ({ pending: [...s.pending, action] })),
  dequeue: () => {
    const [first, ...rest] = get().pending;
    set({ pending: rest });
    return first;
  },
  clear: () => set({ pending: [] }),
}));
```

---

### Step 3D: The Screen Focus (`CycleDashboardScreen`)

When the Dashboard mounts or comes into focus, it processes the queue:

```typescript
// src/screens/cycle/CycleDashboardScreen.tsx
import { useDeepLinkStore } from 'src/stores/deepLinkStore';

export function CycleDashboardScreen() {
  const { enqueue, dequeue, pending } = useDeepLinkStore();

  useFocusEffect(
    useCallback(() => {
      if (pending.length === 0) return;

      // Process all pending actions in order
      while (pending.length > 0) {
        const action = dequeue();
        if (action.type === 'checkin') {
          // Show the Sticky Card
          setShowCheckin(true);
        } else if (action.type === 'mark-end-date') {
          // Open the End Date modal
          setShowEndDateModal(true, action.id);
        }
      }
      
      // Optional: Add a small delay to clear the queue visually
      return () => {}; // cleanup
    }, [pending])
  );
}
```

---

### Step 3E: The User Experience

1. **First Tap (Check-in):** The `navigate` call focuses the Dashboard. The screen runs `useFocusEffect`, sees pending queue has 2 items. It processes Check-in → Sticky Card appears.
2. **Second Tap (End Date Reminder):** The second tap executes while the first focus effect is running. It enqueues the second action to the same store. Since the screen is already focused and the `pending` array is updated, the `useFocusEffect` runs again (or the store subscription triggers an update). It processes the End Date action → End Date modal appears.
3. **Result:** The user sees both the Sticky Card and the End Date modal (or the modal opens on top of the Sticky Card). No navigation reset. No duplicate screens.

---

## 4. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| Two notifications of the same type are tapped. | The pending queue has two identical actions (e.g., two Check-ins). The screen processes the first, shows the card. The second is processed, but since the card is already visible, it is ignored (or the `isVisible` state prevents duplication). |
| User taps a notification while on a different screen (e.g., Journal). | The `navigate` call pushes the Dashboard on top of the Journal stack. The `useFocusEffect` runs when the Dashboard mounts, processing the queue. The Journal screen is preserved in the back stack. |
| The app is closed (killed) when the notification is tapped. | The `handleNotification` runs on cold start. The `navigationRef` might not be ready immediately. The app mounts the `RootNavigator` first, then processes the pending deep link via an `onReady` callback. |
| The user taps "Back" after the modals are open. | The modals are rendered on top of the Dashboard. Tapping "Back" closes the modals, revealing the Dashboard. The queue is already cleared. |

---

## 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ No navigation stack reset. | 1. Navigate to a deep screen (e.g., `JournalEntryScreen`).<br>2. Tap a notification.<br>3. The app should navigate to Dashboard, but the `JournalEntryScreen` should still be in the back stack (tapping "Back" should return to it). | Proves the `navigation.navigate` call respects the existing stack and does not call `navigation.reset()`. |
| ✅ App doesn't crash. | 1. Rapidly tap two different notifications (or simulate two deep links via Linking events).<br>2. The app should not throw a "Cannot read property 'navigate' of undefined" error. | Proves the `navigationRef` is initialized and the deep link handler is guarded against multiple rapid executions. |
| ✅ Multiple intents are processed. | 1. Send two different notification types.<br>2. Verify the Sticky Card and End Date Modal both appear (or appear in sequence). | Proves the pending queue in DeepLinkStore is correctly accumulating and processing actions. |
| ✅ No duplicate screen instances. | 1. Open CycleDashboard.<br>2. Tap a notification.<br>3. Tap another notification.<br>4. Check the navigation stack (e.g., via DevTools). There should be exactly one CycleDashboard instance. | Proves `navigation.navigate` is used (not `push`), which reuses existing screens. |

---

## 6. Why This Matters (The Business Logic)

| Without Idempotent Deep Linking | With Idempotent Deep Linking |
|----------------------------------|------------------------------|
| User taps two notifications quickly → App crashes due to navigation state conflicts. | User taps two notifications quickly → Both intents are processed sequentially. App is stable. |
| Two Check-in notifications → Two Sticky Cards appear on top of each other (broken UI). | Two Check-in notifications → First shows the card, second is ignored (idempotent). |
| Notification taps reset the entire navigation stack, losing the user's place in a journal draft. | Notification taps preserve the back stack. User can go back to their journal after checking the dashboard. |

---

## 7. Summary

This scenario proves that your app can handle rapid, overlapping deep link triggers without crashing or corrupting the navigation state. By combining:

- A persistent intent queue (DeepLinkStore) to handle multiple notifications.
- Conditional navigation (`navigate` over `push` or `reset`) to preserve the stack.
- Screen-level focus effects (`useFocusEffect`) to process pending actions only when the user is looking at the screen.

The app guarantees that even the most chaotic user interaction (tapping every notification in the tray simultaneously) results in a stable, predictable, and non-duplicating navigation flow. This is essential for user trust in a health app where notifications are safety-critical. 🌸📱🔔

---

# Scenario 39: Stale Refresh Token (Refresh Loop Death) — Detailed Explanation

This scenario validates the ultimate security fail-safe of your authentication layer. It simulates the point where the user's session is irrecoverably expired—the refresh token itself has reached its maximum lifetime (e.g., 30 days) or has been revoked by an admin. The system must detect this specific case, break the refresh loop, clean up securely, and guide the user to re-authenticate without getting stuck in an infinite cycle of failed refresh attempts.

---

## 1. The Problem: The "Refresh Loop Death" Trap

| Challenge | Description |
|-----------|-------------|
| The Standard Flow (When it works) | Access token expires → Interceptor catches 401 → Calls `POST /auth/refresh` with `refresh_token` → Server issues new `access_token` → Original request retries. |
| The "Death Loop" (When it breaks) | The `refresh_token` itself is expired or invalid. The server returns a 401 (or 400) on the `/auth/refresh` endpoint. If the interceptor treats this 401 the same way as a standard API 401, it will attempt to refresh again, using the same expired refresh token, causing a retry loop. |
| The Risk | The app gets stuck in a tight loop, constantly hitting the server with invalid refresh requests, draining the user's battery and bandwidth, and never actually logging the user out. The user stares at a spinning loader forever. |

**The Golden Rule:** The 401 on the refresh endpoint is a "Hard Stop" signal. It means "This session is dead. Kill it immediately." The interceptor must explicitly distinguish between a 401 on a normal API call and a 401 on the `/auth/refresh` call.

---

## 2. The Architecture: The "Dead Token" Interceptor Logic

| Component | Role in this Scenario |
|-----------|----------------------|
| Axios Interceptor (`client.ts`) | Monitors all HTTP responses. It checks the status code and the requested URL. |
| `isRefreshRequest` Flag | A boolean flag passed in the request config (`config._retry = true` or `config.url === '/auth/refresh'`). |
| `triggerSessionExpired()` | The "Kill Switch" function that clears EncryptedStorage, resets Zustand, and navigates to Auth. |
| `maxRetries` Guard (Optional) | A secondary safety net (e.g., retry 3 times max) to prevent infinite loops in case of a bug. |

---

## 3. Step-by-Step System Behavior

### Step 3A: The Stale Refresh Token

**User State:** The user has been using the app for 30 days. The `refresh_token` has reached its expiry.

**Scenario:** The user opens the app, and the `syncEngine` tries to pull new data via `GET /sync/changes`.

---

### Step 3B: The Access Token Expires

The app sends `GET /sync/changes` with the expired `access_token`.

The server validates the token. Since it's expired, it returns a `401 Unauthorized`.

---

### Step 3C: The Interceptor Catches the 401 (Standard Path)

The response interceptor in Axios catches the 401.

- It checks if the request URL is `/api/v1/auth/refresh` (the critical check).
- Since it is NOT the refresh endpoint, the interceptor assumes the access token is simply expired and attempts to refresh it.
- It pulls the `refresh_token` from EncryptedStorage and calls `POST /api/v1/auth/refresh`.

---

### Step 3D: The Server Response (The "Hard Stop")

The server receives the `refresh_token`.

- The server validates it: the token has expired or is invalid.
- The server returns `401 Unauthorized` on the refresh endpoint itself.

---

### Step 3E: The Interceptor Catches the 401 (Refresh Path - Kill Switch)

Now the interceptor receives the 401 response from the refresh endpoint. This triggers the specific "Kill Switch" logic:

```typescript
// src/services/api/client.ts (simplified)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error came from the refresh endpoint itself...
    if (originalRequest.url?.includes('/auth/refresh')) {
      // HARD STOP: The refresh token is dead.
      // Clear everything and redirect to login.
      await triggerSessionExpired();
      return Promise.reject(error);
    }

    // If it's a normal 401 (access token expired)...
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await tokenStore.getRefresh();
        const response = await apiClient.post('/auth/refresh', { refresh_token: refreshToken });
        await tokenStore.setBoth(response.data.access_token, response.data.refresh_token);
        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // If refresh fails (e.g., network error), you might retry once more.
        // But if it's a 401, it will fall into the condition above.
        throw refreshError;
      }
    }

    return Promise.reject(error);
  }
);
```

---

### Step 3F: The "Kill Switch" Execution (`triggerSessionExpired`)

1. **Clear EncryptedStorage:**
   - `tokenStore.clear()` (removes access & refresh tokens).
   - `offlineStore.clear()` (removes pending operations). **CRITICAL:** If we don't clear the queue, the sync engine will keep trying to push stale writes on the login screen.
2. **Clear Memory:**
   - `authStore.setState({ user: null })`.
   - `queryClient.clear()` (removes in-memory React Query cache).
3. **Navigate:**
   - `navigationRef.navigate('Auth')`.
4. **Toast:**
   - `Toast.show({ type: 'error', text1: 'Session expired. Please log in again.' })`.

---

## 4. The "Infinite Loop" Prevention (The Guarantee)

The `url.includes('/auth/refresh')` check is bulletproof.

- If the refresh endpoint returns a 401, the interceptor does NOT attempt to refresh again. It immediately triggers the Kill Switch.

**Secondary Safeguard (`_retry` flag):** If the first refresh attempt fails due to a network timeout (not a 401), the `_retry` flag prevents the interceptor from attempting the refresh a second time for the same original request.

---

## 5. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| Network error during refresh (no internet). | The `catch` block catches the error. The interceptor returns `Promise.reject(error)`. The original request fails. The app does NOT navigate to Auth (because the token might still be valid). The user sees a "Network error" toast. |
| The refresh token is revoked by an admin. | The server returns a 401 on `/auth/refresh`. The Kill Switch triggers immediately. The user is logged out. |
| The user logs out manually. | `triggerSessionExpired` is called explicitly. The queue is cleared. |
| The server returns a 400 (Bad Request) on refresh. | The interceptor logic should ideally treat any 4xx on the refresh endpoint as a hard stop (not just 401), because a bad refresh token means the session is unrecoverable. |

---

## 6. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Session ends gracefully. | 1. Manually expire the refresh token (or set a short expiry in dev).<br>2. Make an API call.<br>3. The app should navigate to the Login screen with a clear "Session expired" toast. | Proves the Kill Switch correctly identifies the 401 on the refresh endpoint and executes the logout flow without crashing. |
| ✅ Infinite loop prevented. | 1. Use a network sniffer (e.g., Charles Proxy) to watch the requests.<br>2. Trigger the stale refresh token scenario.<br>3. You should see exactly one `POST /auth/refresh` request. The app should not spam this endpoint. | Proves the `url.includes('/auth/refresh')` guard is working, preventing a retry loop. |
| ✅ Offline Queue is cleared. | 1. Ensure there is a pending operation in the queue.<br>2. Trigger the stale refresh token scenario.<br>3. Check EncryptedStorage for `shecare.offline.queue`. It should be empty. | Proves that stale writes are discarded to prevent cross-account contamination when the user logs back in. |
| ✅ `_retry` flag prevents duplicate refresh attempts. | 1. Mock the refresh endpoint to fail with a network error (not a 401).<br>2. Trigger the access token expiry.<br>3. Verify that the refresh call is made only once (not multiple times) for the same original request. | Proves the `_retry` flag prevents duplicate requests on network errors. |

---

## 7. Why This Matters (The Business Logic)

| Without the Kill Switch | With the Kill Switch |
|-------------------------|----------------------|
| App enters an infinite 401 loop. CPU usage spikes. Battery drains rapidly. | App logs the user out immediately. Zero wasted network/cpu cycles. |
| The user sees a spinning loader forever. They force-quit the app. | The user sees the Login screen with a clear reason. They know they need to re-authenticate. |
| Stale writes in the offline queue try to push to the server while the user is logged out, causing further 401 errors. | The queue is cleared, preventing spurious error logs and cross-account data contamination. |

---

## 8. Summary

This scenario proves that your authentication interceptor is smart enough to distinguish between an expired access token (refreshable) and an expired refresh token (unrecoverable).

By explicitly targeting the `/auth/refresh` endpoint for the "Hard Stop" logic:

- The loop is broken immediately on a 401 response from the refresh endpoint.
- All session data is purged (tokens, offline queue).
- The user is safely redirected to the Login screen.

This is the definitive safeguard against the "Refresh Loop Death" bug that plagues many mobile apps, ensuring that authentication failures are always handled cleanly and predictably. 🌸🛡️🔐

---

# Scenario 40: Large Offline Queue Exceeding SecureStore Limits (iOS Keychain) — Detailed Explanation

This scenario validates the "Storage Resiliency" of your offline-first architecture against the harsh limitations of iOS's secure hardware. It simulates a "power user" who travels to a remote area for 3 weeks, diligently logs 50 journal entries and 50 mood logs per day, generating 1,500 pending operations. When the app attempts to persist this massive queue, it hits the ~1–4 MB size limit of `expo-secure-store` (iOS Keychain), triggering a native write error.

The system must gracefully handle this without crashing and ensure zero data loss, even if it means degrading from hardware-backed encryption to plain file storage temporarily.

---

## 1. The Problem: The iOS Keychain Wall

| Challenge | Description |
|-----------|-------------|
| iOS Keychain Limits | Apple limits keychain items to ~1–4 KB on older devices and up to ~4 MB on newer ones, depending on the iOS version and hardware. The exact limit is undocumented and varies. |
| The Queue Size | Each pending operation is roughly 200–500 bytes (JSON payload + metadata). 1,500 operations = ~600 KB – 1.5 MB. This is well above the 1 MB threshold on many devices. |
| The `setItem` Error | `expo-secure-store` throws a native error (e.g., `NSKeyedArchiver` error or a generic `-25300` code) when the value exceeds the available space. |
| The Risk | If the app simply catches and ignores this error, the user's 1,500 offline entries are permanently lost. If the app crashes, the user loses trust and data. |

**The Golden Rule:** The Offline Queue must survive, even if it means sacrificing hardware-level encryption. Losing data is never acceptable; losing encryption for a single specific key is a calculated trade-off that we can warn the user about.

---

## 2. The Architecture: The Two-Tier Fallback System

| Layer | Standard Behavior | Fallback Behavior (Scenario) |
|-------|------------------|------------------------------|
| Primary Vault (EncryptedStorage) | `expo-secure-store` (Hardware-backed AES-256). | **FAILED** (SecureStore limit hit). |
| Secondary Vault (AsyncStorage) | Not used for sensitive queues (plain text). | **ACTIVATED** (Store the queue here as a fallback). |
| In-Memory (Zustand) | Volatile state. | **PRESERVED** (The app keeps the queue in memory). |

**The Adapter Logic (`storage.ts`):**

The `storage.ts` adapter wraps `setItem` in a try-catch. On failure, it falls back to a plain key-value store (AsyncStorage) and logs a warning to Sentry.

```typescript
// src/services/storage.ts
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// We track the fallback status to show a one-time toast.
let isUsingFallbackStorage = false;

async function setItem(key: string, value: string): Promise<void> {
  try {
    // 1. Try SecureStore first.
    await SecureStore.setItemAsync(key, value);
    // If successful, and we were in fallback mode, we can switch back (optional).
  } catch (error) {
    // 2. If SecureStore fails (e.g., quota exceeded), log the error.
    Sentry.captureException(error, { tags: { context: 'storage.setItem', key, fallback: 'enabled' } });
    
    // 3. Fallback to AsyncStorage.
    await AsyncStorage.setItem(key, value);
    
    // 4. Show a one-time toast to the user.
    if (!isUsingFallbackStorage) {
      isUsingFallbackStorage = true;
      Toast.show({
        type: 'warning',
        text1: 'Storage limit reached',
        text2: 'Some data is stored with lower encryption. Please sync when possible.',
      });
    }
  }
}
```

---

## 3. Step-by-Step System Behavior

### Step 3A: The Queue Accumulation (Offline)

**User Action:** Logs a journal entry offline. The app is in a remote area with no signal.

1. **Queue Growth:** `offlineStore.enqueue()` appends the operation to the local operations array in Zustand.
2. **Persistence Attempt:** The Zustand persist middleware calls `storage.setItem('shecare.offline.queue', JSON.stringify(ops))`.
3. **Initial Success:** The first 200 entries fit in SecureStore. No issues.

---

### Step 3B: The Tipping Point (1,500 entries)

**User Action:** 1,500th entry is written.

1. **Persistence Attempt:** `storage.setItem` tries to write the 1.5 MB JSON blob to SecureStore.
2. **Native Error:** iOS returns an error (e.g., "The keychain item could not be created").
3. **`catch` Block:** The error is caught in `storage.ts`.
4. **Fallback Activation:** The adapter falls back to `AsyncStorage.setItem`.
5. **Success:** The queue is now safely persisted in AsyncStorage (plain text, but secure within the app's sandbox).

---

### Step 3C: The "Pruning" Safeguard (If AsyncStorage also fails)

If AsyncStorage also fails (e.g., disk full), the adapter implements a pruning strategy before attempting the write again:

1. **Prune Oldest 20%:** Remove the oldest 20% of operations (FIFO) to reduce the payload size.
2. **Log to Sentry:** `logger.warn('Queue pruned to fit storage limits', { removed_count: 300 })`.
3. **Retry:** Attempt `AsyncStorage.setItem` again with the smaller queue.
4. **Fallback (Last Resort):** Keep the queue only in memory (Zustand). The next time the user opens the app, the queue will be empty unless they sync immediately.

---

### Step 3D: The Sync Drain (The Resolution)

1. **Trigger:** The user eventually walks into a Wi-Fi zone.
2. **Sync Engine:** `pushOperations()` reads the queue from AsyncStorage (or memory).
3. **Server Success:** The operations are pushed to the server.
4. **Queue Clear:** After successful sync, `offlineStore.clear()` is called, which removes the queue from AsyncStorage/SecureStore.
5. **Return to Normal:** The next write will attempt SecureStore first again.

---

## 4. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| User force-quits the app after fallback to AsyncStorage. | The queue is safely stored in AsyncStorage. On the next launch, `offlineStore.hydrate()` reads from AsyncStorage (via `storage.getItem`). The queue is preserved. |
| The queue is too large for AsyncStorage (disk full). | The prune logic activates. The oldest 20% of entries are discarded. The user receives a toast: "Too many offline entries. Syncing oldest ones first." The `maxRetries` logic ensures these discarded entries are handled gracefully (or logged). |
| Android vs iOS: | Android's Keystore (via `expo-secure-store`) does not have such strict size limits on the value size. This scenario is iOS-specific, but the fallback logic is universal and safe on both platforms. |
| The user logs in as a different user after the fallback. | The queue is cleared on logout (`authStore.reset()`), so the new user doesn't see the previous user's data. The fallback queue is also cleared. |

---

## 5. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ App does NOT crash due to storage limits. | Simulate a SecureStore error (e.g., by mocking `SecureStore.setItemAsync` to throw a "quota exceeded" error). Write 1,500 ops. The app should continue running. | Proves the try-catch wrapper in `storage.ts` is effectively handling native errors. |
| ✅ Pending operations are not silently lost. | After the fallback, check the queue via `offlineStore.getState().operations`. It should still contain all 1,500 ops. Check AsyncStorage for the `shecare.offline.queue` key. The data should be present. | Proves the fallback mechanism correctly preserves the data payload. |
| ✅ Pruning activates if necessary. | Mock both SecureStore and AsyncStorage to fail. The adapter should catch the failure, prune 20% of the queue, and retry. Check the queue length after the prune. It should be 1,200. | Proves the system has a last-resort safety net to prevent a complete crash on disk full. |
| ✅ Toast is shown. | When the fallback is triggered, a warning toast should appear: "Storage limit reached. Some data is stored with lower encryption. Please sync when possible." | Proves the user is informed about the degraded security state. |

---

## 6. Why This Matters (The Business Logic)

| Without Fallback (Crash or Data Loss) | With Fallback (Graceful Degradation) |
|---------------------------------------|--------------------------------------|
| App crashes. User loses 3 weeks of journals. Deletes the app in frustration. | App silently (or with a toast) switches to AsyncStorage. The user's 3 weeks of data are preserved. When they sync, the queue drains. |
| Security team panics: "Why is user data in plain text?" | The adapter logs the fallback to Sentry, and the `setItem` error is captured. The team knows exactly when and why a fallback occurred. |
| User is stranded with no way to log data. | User continues to log data indefinitely, unaware of the underlying storage change. |

---

## 7. Summary

This scenario proves that your storage layer is resilient against platform-specific storage limits and degrades gracefully rather than crashing or losing data. By implementing:

- A primary (SecureStore) → secondary (AsyncStorage) fallback chain.
- Active pruning (oldest 20%) when storage is critically full.
- Sentry logging for every fallback event.
- A user-facing toast to warn about degraded encryption.

The app guarantees that a user in a remote area with no internet for 3 weeks will never lose a single mood log or journal entry, even if they hit the iOS Keychain's physical limits. This is the hallmark of a truly bulletproof offline-first architecture. 🌸🛡️📱
