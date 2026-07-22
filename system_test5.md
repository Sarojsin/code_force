# System Tests 5 — SheCare

> **Scope:** Prediction History Table, sync engine error handling (500/400), queue backlog, batch processing, and gzip compression.
> **Goal:** Validate prediction accuracy transparency, offline-first sync resilience, idempotency, and large-backlog recovery.
> **Pass Criteria:** All scenarios must pass while maintaining SQLite integrity and preventing queue blockage.

---

## Scenario 15: Prediction History Table — The "Report Card" — Detailed Explanation

This scenario validates the Prediction History Table—a feature that transforms the app from a "black box AI" into a transparent, trustworthy assistant. It shows users exactly how accurate the AI has been over time, building trust through data transparency.

---

### 1. Pre-Condition (The "Before" State — Mock Data Era)

**Before Phase 2 (SQLite):** The app displayed hardcoded mock data on the `CyclePredictionsScreen`.

**The Problem:** The mock data looked like this:

```typescript
const MOCK_HISTORY = [
  { month: 'May', predicted: 'May 12', actual: 'May 14', delta: 2, onTime: false },
  { month: 'Jun', predicted: 'Jun 9', actual: 'Jun 10', delta: 1, onTime: false },
  // ...
];
```

**User Confusion:** Users would see a "Prediction History" that did not reflect their actual cycles. This undermined trust in the AI.

---

### 2. The Architecture (How Real Data Replaces Mock Data)

#### 2.1. The Source of Truth — SQLite `predicted_cycles` Table

The `predicted_cycles` table in SQLite is the exclusive source for the Prediction History Table.

**Key Fields Used for History:**

| Field | Purpose | Example |
|-------|---------|---------|
| `predicted_next_period_start` | The date the AI guessed. | `2025-06-01` |
| `actual_cycle_entry_id` | Links to the confirmed `cycle_entry` (the truth). | `uuid-123` (links to `cycle_entries` table) |
| `prediction_error_days` | The deviation: `(Actual_Date - Predicted_Date)`. | `+4` (late by 4 days), `-1` (early by 1 day), `0` (perfect) |
| `is_active` | `false` for archived predictions (history). | `false` |
| `training_data_points` | How many cycles the AI had when making this prediction. | `8` cycles |
| `model_type` | The AI model used (e.g., `global_model`, `fallback`). | `global_model` |

---

#### 2.2. The "Archiving" Mechanism (How Records Get Here)

A prediction is "archived" (marked as history) when:

- **The user confirms/corrects a period:** The system sets `is_active = false` on the old prediction.
- **A new prediction is generated:** The system creates a new active prediction and archives the old one.
- **The correction links the records:** The archived `predicted_cycles` record receives the `actual_cycle_entry_id` and `prediction_error_days`.

**Rule:** Only records where `actual_cycle_entry_id IS NOT NULL` appear in the history table. If a user never confirms/corrects a prediction, it remains "pending" and does not appear in the history.

---

### 3. The Read Path (SQLite → UI)

#### Step 1: The Query Hook (`usePredictionHistory`)

When the user navigates to `CyclePredictionsScreen`, the `usePredictionHistory` hook fires.

**`queryFn` Logic:**

- **Primary Source (SQLite):** `localDb.predictedCycle.getHistory(userId)`.
  - **SQL Query:** `SELECT * FROM predicted_cycles WHERE user_id = X AND is_active = false AND actual_cycle_entry_id IS NOT NULL ORDER BY predicted_next_period_start DESC LIMIT 20`.
- **Background Refresh (API):** The hook fires a background `GET /cycle/predictions/history` to fetch any new archived predictions from the server (e.g., predictions corrected on another device).
- **Return:** The hook returns the SQLite data immediately (UI renders instantly). The background refresh silently updates SQLite if the server has newer data.

---

#### Step 2: The Data Transformation

The raw SQLite data is transformed into a table-friendly format:

```typescript
// Raw SQLite record
{
  id: 'pred-123',
  predicted_next_period_start: '2025-06-01',
  prediction_error_days: 4,
  actual_cycle_entry_id: 'entry-456',
  training_data_points: 6,
  model_type: 'fallback'
}

// Transformed for UI
{
  month: 'Jun',                       // Extracted from predicted_next_period_start
  predicted: 'Jun 1',                 // Format predicted date
  actual: 'Jun 5',                    // Join with cycle_entries to get actual date
  delta: '+4',                        // prediction_error_days with sign
  onTime: false,                      // delta === 0 ? true : false
  accuracy: 'Off'                     // Derived from delta (see color mapping)
}
```

---

### 4. The "Report Card" Coloring (Mint / Peach / Blush)

The visual color-coding is the most important UX element. It tells the user at a glance how reliable the AI is.

**The Rule:**

| Prediction Error (Absolute Value) | Background Color | Visual Meaning | User Message |
|-----------------------------------|------------------|----------------|--------------|
| 0 or 1 day | Mint (`#D4F0E0`) | Perfect or near-perfect prediction | "AI was spot on!" |
| 2 days | Soft Peach (`#FFDAB9`) | Close prediction | "AI was close." |
| 3+ days | Blush Light (`#FFB3C6`) | Off prediction | "AI missed this one." |

**Example Table:**

| Month | Predicted | Actual | Delta | Row Color |
|-------|-----------|--------|-------|-----------|
| May | May 12 | May 14 | +2 | 🟠 Peach |
| Jun | Jun 9 | Jun 10 | +1 | 🟢 Mint |
| Jul | Jul 7 | Jul 7 | 0 | 🟢 Mint |
| Aug | Aug 4 | Aug 8 | +4 | 🔴 Blush |

**Implementation Snippet:**

```typescript
function getRowColor(delta: number): string {
  const abs = Math.abs(delta);
  if (abs <= 1) return '#D4F0E0';   // Mint
  if (abs === 2) return '#FFDAB9';  // Peach
  return '#FFB3C6';                 // Blush
}
```

---

### 5. The "Data Quality" Summary (The Sidebar Stats)

In addition to the table, the screen displays a summary at the top:

```
📊 Accuracy Report
- Based on 6 predictions
- Accuracy: 67% (within 2 days)
- Average Error: +1.2 days (you tend to be slightly late)
- Best Model: Global XGBoost (used for 4 predictions)
```

These statistics are computed from the SQLite data:

| Field | Computation |
|-------|-------------|
| `total_predictions` | Count of archived records. |
| `accuracy_within_2` | Percentage of records where `abs(error_days) <= 2`. |
| `avg_error` | Average of `prediction_error_days` (e.g., `+1.2` means she is usually late). |
| `model_used` | Most frequent `model_type` in the history. |

---

### 6. Edge Cases & Data Integrity

| Scenario | System Behavior |
|----------|-----------------|
| User has 0 archived predictions | The table shows: "No prediction history yet. Keep logging your periods to see your accuracy." |
| User corrected a period offline (pending sync) | The `actual_cycle_entry_id` is `NULL` temporarily. The history table excludes this record until the correction syncs and the error is calculated. |
| User misses a cycle (no correction) | The prediction is never archived. It stays active until a new prediction overrides it. The history table only shows resolved cycles. |
| Multi-Device Correction | Device A corrects a period. The `predicted_cycles` record is archived locally. When Device B syncs, it receives the updated history via `GET /sync/changes`. |

---

### 7. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Real data replaces mock data. | Open `CyclePredictionsScreen`. The table should show your actual corrected periods (e.g., "June 1 → June 5"), not the hardcoded "May, Jun, Jul" mock data. | Proves that the SQLite `predicted_cycles` table is correctly populated and the `usePredictionHistory` hook is reading from it. |
| ✅ Color-coding matches error range. | Correct a period to be 4 days late. Open the history. The row for that month should be Blush Light (`#FFB3C6`). | Proves that `prediction_error_days` is correctly stored and translated to the correct visual color. |
| ✅ History survives app restart. | Force-quit the app. Reopen. Navigate to `CyclePredictionsScreen`. The table is still populated (not reset to empty/mock). | Proves that SQLite is the persistent source of truth and React Query is not just holding the data in volatile memory. |
| ✅ Pending (uncorrected) predictions are excluded. | Check a cycle where the user never confirmed or corrected the AI prediction. It should not appear in the history table. | Proves the `actual_cycle_entry_id IS NOT NULL` filter is active, preventing "incomplete" data from misleading the user. |

---

### 8. The "Trust" Feedback Loop

This feature closes the user-trust loop:

1. **User sees predictions** → (Light Pink blocks).
2. **User corrects the AI** → (Error is logged).
3. **User sees the "Report Card"** → ("Ah, the AI is 85% accurate. I trust it more now.").

- If the AI is consistently wrong (many Blush rows), the user might rely less on the app's predictions until the model improves.
- If the AI is mostly Mint, the user will trust the fertile window predictions for family planning.

---

### Summary

This scenario is the final validation of your AI feedback loop. It proves that:

- Predictions are correctly archived in SQLite (`is_active = false`).
- Corrections are correctly linked (`actual_cycle_entry_id`, `prediction_error_days`).
- The UI correctly transforms raw data into a visually accurate "Report Card" (Mint/Peach/Blush).
- The feature works 100% offline, using SQLite as the source of truth, with background server sync for multi-device consistency.

If this passes, your AI is not just a black box—it's an accountable assistant that learns and communicates its accuracy to the user. 🌸📊

---

## Scenario 16: Sync Engine Receives a 500 Error from the Server — Detailed Explanation

This scenario validates the resilience and idempotency of your offline-first architecture. A 500 Internal Server Error is a transient failure—the server is temporarily down, but the user's data is valid. The system must preserve the data and retry later, without corrupting the local database or getting stuck in an infinite loop.

---

### 1. Pre-Condition (The "Before" State)

- **User Action:** The user logs a period (or corrects a date).
- **Optimistic UI (Immediate):** The calendar updates instantly (Dark Pink appears). React Query's in-memory cache is updated.
- **Offline Queue (EncryptedStorage):** The operation is written to EncryptedStorage as a safety net (even if online).
  - Example: `{ id: 'op-123', type: 'cycle/correction', payload: { start: '2025-07-22' }, retryCount: 0, maxRetries: 5 }`.
- **SQLite:** The `cycle_entries` table has not been updated yet. SQLite only contains previously synced data.

---

### 2. The Failure Event (500 Internal Server Error)

- **Network Request:** The `syncEngine.pushOperations()` sends the operation to `POST /api/v1/cycle/corrections`.
- **Server Response:** The server returns 500 Internal Server Error (e.g., database connection pool exhausted, unhandled exception).
- **Axios/Api Client:** The client receives the error. The status code is identified as a 5xx error.

---

### 3. The Error Handling Logic (`isRetryableError`)

The `syncEngine` uses a dedicated function to classify errors:

```typescript
function isRetryableError(error: AxiosError): boolean {
  const status = error.response?.status;
  // 5xx = server errors (transient), 429 = rate limit (transient)
  return status === 429 || (status >= 500 && status < 600);
}
```

- **Result:** 500 is retryable.
- **Decision:** The operation is NOT discarded.

---

### 4. The Storage Behavior (EncryptedStorage)

- **Action:** The `syncEngine` increments the `retryCount` of the operation in EncryptedStorage.
  - **Before:** `{ retryCount: 0 }`
  - **After:** `{ retryCount: 1 }`
- **Queue Persistence:** The operation remains in EncryptedStorage. It is not deleted.

**Why this is critical:** If the user force-quits the app, the operation is still stored securely in the encrypted queue. When the app relaunches and network is available, the operation will be retried.

---

### 5. The Storage Behavior (SQLite & React Query)

- **SQLite:** Unchanged. The `cycle_entries` table does NOT receive the new period date.

**Why?** Because the server never confirmed the data. If we wrote to SQLite on a 500 error, the user would see the period in their history, but the server would have no record of it—creating a "zombie" record that would cause conflicts later.

- **React Query Cache (In-Memory):** The optimistic update is still in the UI (the user sees Dark Pink).

**However,** React Query is in-memory. If the user force-quits the app, this optimistic data is lost.

**The Bridge:** When the app restarts, the `queryFn` reads from SQLite (which doesn't have the new period). The UI will briefly show the old state. But the `syncEngine` will immediately retry the operation from EncryptedStorage, and on success, SQLite will be updated, and the UI will refresh.

---

### 6. The Retry Mechanism (Preventing the Infinite Loop)

#### A. Exponential Backoff (Implicit)

While not explicitly stated in your test, the `syncEngine` should ideally implement exponential backoff (e.g., wait `2^retryCount` seconds before retrying) to prevent hammering a downed server.

| `retryCount` | Wait Time |
|--------------|-----------|
| 1 | 2 seconds |
| 2 | 4 seconds |
| 3 | 8 seconds |
| 4 | 16 seconds |
| 5 | 32 seconds (then discard) |

#### B. The Hard Limit (`maxRetries = 5`)

If the 500 error persists: The operation will fail 5 times.

- **On the 6th attempt:** `retryCount` would become 6, which exceeds `maxRetries`. The system discards the operation.
- **Cleanup:** `offlineStore.discard(id)` removes it from EncryptedStorage.
- **User Notification:** A toast appears: "Failed to sync one entry after multiple attempts. Please try again." (Or it just silently discards, depending on your tolerance for data loss).

---

### 7. The User Experience (What the User Sees)

| Time | UI State | User Perception |
|------|----------|-----------------|
| Immediately after action | Dark Pink appears on calendar. No error message. | "Period logged successfully." |
| During the 500 error | A small "syncing..." badge or a red dot appears near the calendar (indicating pending sync). | "The app is trying to save my data." |
| After 5 failed retries | The "syncing..." badge turns into a warning icon. A toast: "Could not sync. Please check your internet." | "I need to check my connection, but my data is safe locally." |
| After force-quit + relaunch (before retry) | The Dark Pink disappears (because SQLite doesn't have it). | "Where did my period go?" — This is the UX gap. |
| After relaunch + online retry success | SQLite is updated. Dark Pink reappears. | "Ah, there it is." |

**To improve UX:** We should show a persistent "Pending Sync" entry in the history view (e.g., a greyed-out or dotted entry) that indicates the period is logged locally but pending server confirmation. This ensures the user sees their data even after a force-quit.

---

### 8. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Queue is not cleared. | Simulate a 500 response using Mock Service Worker (MSW). Log a period. Check EncryptedStorage for the pending operation. It should still be present after the error. | Proves that transient errors do not cause data loss. |
| ✅ Infinite loop prevented. | Simulate 5 consecutive 500 errors. After the 5th failure, check EncryptedStorage. The operation should be discarded (removed) or marked as "failed permanently." | Proves the `maxRetries` cap is working. The app will not retry indefinitely, wasting battery and causing network churn. |
| ✅ SQLite unchanged. | After the 500 error, query the `cycle_entries` table in SQLite (via dev tools). The new period should not be present. | Proves that the system does not write unconfirmed data to the permanent cache. Prevents "zombie" records. |
| ✅ Retry count increments. | After the first 500 error, check the `retryCount` field in the EncryptedStorage queue item. It should be 1. After the second, 2, etc. | Proves the exponential backoff logic (if implemented) or at least the retry limit is counting correctly. |

---

### 9. The "Discard" vs "Keep" Decision Matrix

| Error Code | Retryable? | Action | SQLite |
|------------|------------|--------|--------|
| 500 (Internal Error) | ✅ Yes | Increment `retryCount`, keep in queue. | Unchanged. |
| 503 (Service Unavailable) | ✅ Yes | Same as 500. | Unchanged. |
| 429 (Rate Limit) | ✅ Yes | Same as 500. | Unchanged. |
| 400 (Bad Request) | ❌ No | Discard immediately. | Unchanged. |
| 401 (Unauthorized) | ❌ No | Clear auth tokens, redirect to login. | Unchanged. |
| 404 (Not Found) | ❌ No | Discard (the endpoint no longer exists). | Unchanged. |

---

### Summary

This scenario proves that your sync engine:

- Preserves data (EncryptedStorage queue) during transient server failures.
- Prevents data corruption (does NOT write to SQLite) until the server confirms success.
- Prevents infinite loops via `maxRetries` and error classification.
- Protects the UI by keeping the optimistic update visible (with a pending badge), maintaining a seamless user experience even during server outages.

If this passes, your app can survive backend crashes, AWS outages, and slow networks without losing a single period log. 🌸🛡️

---

## Scenario 17: Sync Engine Receives a 400 Error (Bad Request) — Detailed Explanation

This scenario validates how your system handles permanent, unrecoverable client errors. A 400 Bad Request means the server is rejecting the payload because it violates the API contract (e.g., missing required fields, invalid date format, malformed JSON).

Unlike a 500 error (server is down), a 400 error will not resolve itself if we retry later. Retrying a 400 error is a waste of battery and network bandwidth. More critically, if we don't discard it, it will block the entire sync queue.

---

### 1. Pre-Condition (The "Before" State)

- **User Action:** The user logs a period or edits a journal entry.
- **Optimistic UI (Immediate):** The UI updates instantly (Dark Pink block appears, or the journal entry appears in the list). React Query's in-memory cache is updated.
- **Offline Queue (EncryptedStorage):** The operation is written to EncryptedStorage as a safety net:
  - Example: `{ id: 'op-456', type: 'cycle/correction', payload: { start_date: '2025-07-22' }, retryCount: 0 }`.
- **SQLite:** No write has occurred yet. The data is only in the in-memory cache and the EncryptedStorage queue.

---

### 2. The Failure Event (400 Bad Request)

- **Network Request:** The `syncEngine.pushOperations()` grabs the operation and sends `POST /api/v1/cycle/corrections`.
- **Server Validation:** The server receives the payload. It checks the schema:
  - Required field `period_end_date` is missing.
  - Or the date format is `MM-DD-YYYY` instead of `YYYY-MM-DD`.
  - Or the `prediction_id` is not a valid UUID.
- **Server Response:** The server rejects the payload and returns 400 Bad Request along with an error body:

```json
{ "detail": "Missing required field: period_end_date" }
```

---

### 3. The Error Classification (`isRetryableError`)

The `syncEngine` classifies the error:

```typescript
function isRetryableError(error: AxiosError): boolean {
  const status = error.response?.status;
  return status === 429 || (status >= 500 && status < 600);
}
```

- **Result:** 400 falls into the 4xx category. `isRetryableError` returns `false`.
- **Decision:** The error is non-retryable. The system will not increment `retryCount`. It will immediately discard the operation.

---

### 4. The Storage Behavior (EncryptedStorage & SQLite)

#### A. The Queue (EncryptedStorage)

- **Action:** `offlineStore.discard('op-456')` is called.
- **Result:** The operation is permanently removed from EncryptedStorage.

**Why this is critical:** If we kept it, the sync engine would attempt to send it on every network reconnect, wasting battery and data. Worse, if this operation is at the front of the FIFO queue, it would block all subsequent operations from syncing.

---

#### B. The Permanent Cache (SQLite)

- **Action:** No write occurs. SQLite remains unchanged.

**Why:** The server explicitly told us the data is invalid. If we wrote it to SQLite, the user would see this data in their history forever, but the server would have no record of it. This creates a "zombie" record that would cause inconsistencies across devices.

---

#### C. The In-Memory Cache (React Query)

- **Current State:** The optimistic update is currently in the UI (Dark Pink).
- **The Fix:** The `onError` handler of the mutation must roll back the optimistic update:

```typescript
queryClient.setQueryData(['cycle', 'entries'], (old) =>
  old.filter((item) => item.id !== tempId)
)
```

- **Result:** The invalid entry vanishes from the UI.

---

### 5. The User Experience (The "Rollback" Flow)

| Time | UI State | User Perception |
|------|----------|-----------------|
| Immediately after action | Dark Pink appears on calendar. | "Period logged successfully." |
| Sync attempt (400 error) | The Dark Pink entry disappears (rolls back). | "Wait, where did my period go?" |
| Toast appears | A toast pops up: "Failed to save. The data format was invalid. Please try again." | "Oh, I made a mistake. I'll try again." |

**Why this is the correct UX:** Hiding the invalid data is better than showing a "ghost" entry that the server will never confirm. It forces the user to re-enter the data correctly, ensuring data integrity.

---

### 6. Why Discarding is Critical (The FIFO Blockage Prevention)

This is the most important architectural reason for discarding 4xx errors immediately.

**The Scenario (Blocked Queue):**

1. Operation A (400 error) is at the front of the queue.
2. Operation B (valid data) is behind it.

If we kept Operation A in the queue, the FIFO logic would process A first → fail (400) → retry → fail → retry...

**Result:** Operation B is blocked indefinitely. The user's valid data never syncs.

By discarding A immediately: The sync engine moves to Operation B, and it syncs successfully.

**The Rule:** A single malformed payload should not break the entire sync pipeline.

---

### 7. Common Causes of 400 Errors (Why They Happen)

Even in a well-designed app, 400 errors can happen due to:

| Cause | Example | Mitigation |
|-------|---------|------------|
| Schema version mismatch | Mobile app updated to v2, but the backend is still on v1. | API versioning, buster strategy. |
| Bug in the mutation hook | The mobile app forgot to send a required field (e.g., `period_end_date`). | Zod validation on the client side (prevent sending invalid data). |
| Corrupted local data | SQLite has a malformed string (e.g., `NaN` in a date field). | Service layer catches this before sending. |
| User manipulation | User changes system clock, sending a date in the wrong format. | Normalize dates to ISO 8601 before sending. |

---

### 8. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Malformed data is dropped. | Modify the mutation hook to intentionally send a malformed payload (e.g., remove `period_start_date`). Trigger the sync. Check EncryptedStorage for the operation. It should be absent (discarded). | Proves that non-retryable errors do not clog the queue. |
| ✅ SQLite no write occurs. | After the 400 error, query SQLite. The invalid data should not be present. | Proves that we do not trust unconfirmed server data, preserving the integrity of the offline cache. |
| ✅ Optimistic UI rolls back. | After the 400 error, the Dark Pink block should disappear from the calendar (or the journal entry should disappear from the list). | Proves that the `onError` handler correctly reverts the optimistic update, preventing visual "ghost" data. |
| ✅ Toast is shown. | A toast should appear with the error message (e.g., "Failed to sync. Discarded."). | Proves that the user is informed that their action failed, prompting them to try again. |
| ✅ Queue blockage is prevented. | Place a malformed operation at the front of the queue, and a valid operation behind it. Sync. The valid operation should still sync successfully. | Proves the FIFO pipeline is not blocked by bad data. |

---

### 9. The "Discard" vs "Keep" Decision Matrix (Revisited)

| Error Code | Retryable? | Action | UI Rollback? |
|------------|------------|--------|--------------|
| 400 (Bad Request) | ❌ No | Discard immediately. | ✅ Yes (remove optimistic update). |
| 401 (Unauthorized) | ❌ No | Clear tokens, redirect to login. | N/A |
| 404 (Not Found) | ❌ No | Discard (the endpoint is gone). | ✅ Yes. |
| 422 (Validation Error) | ❌ No | Discard (semantic error, e.g., date logic). | ✅ Yes. |
| 500 (Internal Error) | ✅ Yes | Keep in queue, retry later. | ❌ No (keep optimistic update). |
| 503 (Service Unavailable) | ✅ Yes | Keep in queue, retry later. | ❌ No (keep optimistic update). |

---

### Summary

This scenario proves that your sync engine:

- Correctly classifies errors (distinguishes between transient server issues and permanent client issues).
- Protects the queue by discarding bad data to prevent blocking valid operations.
- Preserves data integrity by refusing to write unconfirmed data to SQLite.
- Maintains UI consistency by rolling back optimistic updates when the server rejects the data.

If this passes, your app can gracefully handle edge cases where the client and server temporarily fall out of sync due to bugs or version mismatches, without breaking the rest of the user's experience. 🌸🛡️

---

## Scenario 18: The "Queue Backlog" (100 Operations Pending) — Detailed Explanation

This scenario validates the scalability and efficiency of your offline-first sync engine. It simulates a real-world situation where a user travels to a remote area with no internet for 3 days but continues using the app daily (logging periods, moods, journals, corrections). When they finally return to Wi-Fi, the system must handle a massive backlog without crashing, draining the battery, or overwhelming the server.

---

### 1. The Accumulation (Offline State)

**User Behavior:**

- **Day 1 (Offline):** Logs 3 mood entries, 2 journal entries, 1 period correction.
- **Day 2 (Offline):** Logs 4 symptoms, 2 period logs.
- **Day 3 (Offline):** Logs 5 journal entries, 1 emergency contact update.

**Total:** ~17 operations per day × 3 days = ~51 operations (we use 100 for stress testing).

**System Behavior (During Offline Period):**

- **Optimistic UI:** Every write updates the UI instantly (Dark Pink, new journal entry appears). The user has no idea they are offline (seamless experience).
- **EncryptedStorage (Queue):** Each write is appended to the `shecare.offline.queue` key in EncryptedStorage (SecureStore).
- **Queue Growth:** The queue grows to 100 items. Each item is ~200–500 bytes. Total queue size ~50 KB – 200 KB.
- **Risk Management:** 100 items is well within the ~1–4 MB limit of iOS SecureStore. The queue remains safe.

---

### 2. The Sync Trigger (Reconnection)

- **Event:** The user walks into a Wi-Fi zone. `NetInfo` fires `isConnected = true`.
- **App Lifecycle:** If the app is in the foreground, `syncEngine.syncAll()` is called immediately. If the app is in the background, the 15-day background sync will pick it up (or foreground focus will trigger it).
- **State Check:** `syncEngine` checks `isSyncing` flag to prevent duplicate runs.

---

### 3. The Batching Strategy (Efficiency Over Individual Calls)

Instead of firing 100 separate POST requests (which would be slow, battery-draining, and risk rate-limiting), the sync engine uses batching.

#### Step 3A: FIFO Sorting

The queue is sorted by `createdAt` (oldest first) to preserve chronological order.

**Critical:** If Operation A (CREATE a period) is before Operation B (UPDATE that period), the batch preserves this order.

---

#### Step 3B: Building the Batch Payload

The sync engine groups the 100 ops into a single payload:

```json
{
  "operations": [
    { "id": "op-1", "type": "journal/create", "endpoint": "/api/v1/wellness/journal", "data": { ... }, "client_updated_at": "..." },
    { "id": "op-2", "type": "cycle/correction", "endpoint": "/api/v1/cycle/corrections", "data": { ... }, "client_updated_at": "..." },
    ...
  ],
  "device_id": "uuid-123",
  "last_sync_at": "2025-07-19T00:00:00Z"
}
```

---

### 4. Gzip Compression (The Bandwidth Saver)

#### Why Compression is Critical

A batch of 100 operations is roughly 100 KB – 200 KB of JSON text. On a slow 2G/3G network in rural Nepal, uploading 200 KB can take 5–10 seconds. Gzip compression reduces this to ~30–50 KB (up to 75% reduction).

---

#### How it Works

- **Trigger Condition:** The sync engine checks if `payloadSize > 10 KB` or `opCount > 10`. If true, it compresses the payload using `pako` (zlib) before sending.
- **Headers:** The `Content-Encoding: gzip` header is added to the request.
- **Server Handling:** The FastAPI backend middleware decompresses the payload before routing it to the `/sync/batch` endpoint.

---

### 5. Server Processing (`POST /sync/batch`)

#### Step 5A: Decompression & Validation

The server receives the gzipped payload, decompresses it, and parses the JSON. It validates the `device_id` and checks the `last_sync_at` timestamp (used for incremental syncs).

---

#### Step 5B: Idempotency Handling (Deduplication)

Each operation in the batch has a unique `idempotency_key`. The server checks if this key has been processed in the last 24 hours.

- If duplicate, the server skips the operation and returns a 200 (silent success) to prevent duplicate data on the client.

---

#### Step 5C: Processing in Order

The server processes the operations in the order they appear in the batch (FIFO).

**Conflict Resolution:** If a later operation references an ID from an earlier operation (e.g., an UPDATE on a record just CREATEd in the same batch), the server handles it correctly because the batch is processed sequentially, not in parallel.

---

#### Step 5D: Response Structure

The server returns a batch response:

```json
{
  "results": [
    { "id": "op-1", "status": "success", "server_data": { ... } },
    { "id": "op-2", "status": "conflict", "server_data": { ... } },
    { "id": "op-3", "status": "failed", "error": "Invalid date" }
  ],
  "processed_count": 100
}
```

---

### 6. SQLite Hydration (`upsertMany`)

#### Step 6A: Processing the Successful Results

For operations with `status: "success"`, the mobile app calls `localDb.cycle.upsertMany(server_data)`.

**Crucially:** `upsertMany` uses a single SQLite transaction.

```sql
BEGIN TRANSACTION;
INSERT OR REPLACE INTO cycle_entries (...) VALUES (...), (...), ...
COMMIT;
```

**Why this matters:** If the app crashes mid-write, the transaction rolls back completely. There is no "half-written" state.

---

#### Step 6B: Clearing the Queue

- For each successful operation, `offlineStore.remove(op.id)` is called. The queue shrinks from 100 to 0.
- For conflicts (`status: "conflict"`), the server's data is overwritten in SQLite, and the local op is discarded.

---

### 7. UI & User Experience

| Phase | UI State | User Perception |
|-------|----------|-----------------|
| During Offline Period | All 100 entries are visible (optimistic UI). A small "3 pending syncs" badge appears on the Dashboard. | "My data is safely stored." |
| Sync Starting | The badge changes to "Syncing 100 items...". | "The app is working hard to catch up." |
| During Sync (1–3 seconds) | The UI remains interactive. The sync happens in the background. | No lag. The app is still usable. |
| Sync Complete | The badge disappears. The calendar and lists update if new data came from the server (e.g., corrections from other devices). | "Everything is backed up." |

---

### 8. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Gzip compression triggers. | Use a network sniffer (e.g., Charles Proxy) or check the `Content-Encoding` header in the request. Verify it is `gzip` when > 10 ops. | Proves that bandwidth is being saved, which is critical for users in low-bandwidth environments. |
| ✅ Batch endpoint handles large payloads. | Simulate 100 ops. Monitor server CPU/memory. Ensure the server does not time out (should process < 2 seconds). | Proves the backend is scalable and can handle spikes in write activity after long offline periods. |
| ✅ SQLite transaction handles bulk writes. | After the sync, query SQLite. All 100 records should be present. Check that the write time was < 500ms. | Proves that `upsertMany` with a transaction is efficient, avoiding 100 individual disk writes. |
| ✅ FIFO order preserved. | Include a CREATE and an UPDATE for the same entity in the backlog. After the sync, the UPDATE should apply correctly to the CREATEd record. | Proves that chronological order is respected, preventing logical errors. |
| ✅ Idempotency prevents duplicates. | Force the client to retry the same batch due to a network hiccup. The server should return 200 for duplicates and not create duplicate records. | Proves the system is safe against network retries. |

---

### 9. Edge Cases & Failure Handling

| Scenario | System Behavior |
|----------|-----------------|
| Batch exceeds payload limit (e.g., > 10 MB). | The sync engine splits the batch into two (e.g., 50 ops each) and sends sequentially. |
| Server returns 500 during batch processing. | The entire batch fails. The queue is not cleared. On the next sync, the batch is retried. |
| Server returns 409 for a single op. | The conflict resolution logic applies to that specific op. Other ops in the batch proceed normally. |
| Gzip fails (corrupt data). | The client catches the error, falls back to sending uncompressed JSON. |

---

### 10. Performance Metrics (Targets)

| Metric | Target |
|--------|--------|
| Batch serialization time | < 100 ms |
| Gzip compression time (100 ops) | < 200 ms |
| Server processing time (100 ops) | < 2 seconds |
| SQLite `upsertMany` time (100 rows) | < 500 ms |
| Total sync time (including network) | ~3–5 seconds (on 4G) / ~15 seconds (on 2G) |

---

### Summary

This scenario proves that your sync engine is scalable, efficient, and resilient. By batching requests, compressing payloads, and using SQLite transactions, the app can recover from long offline periods without overwhelming the server, draining the battery, or losing data. This is the hallmark of a true offline-first architecture. 🌸📦
