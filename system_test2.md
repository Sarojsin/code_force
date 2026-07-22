## Section 2: The "Correction & Snooze" Flow (The Feedback Loop)

### Scenario 3: Ananya corrects a date (Late by 4 days) via Sticky Card 

**Action:** Prediction was June 10. Actual is June 14. Taps "No, adjust date" and selects June 14.

**Expected System Behavior:**

- **SQLite:** Old prediction greyed out (`c`). New block Dark Pink (`P`). SQLite updated via `localDb.cycle.upsert()`.
- **Local Prediction Update:** `avg_prediction_error_days` shifts to +4. SQLite stores the updated `avg_error` (via users table migration).
- **Sync Engine:** Push operation is queued in EncryptedStorage, sent to server, and on success, SQLite is hydrated again.

**Checkpoints:**
- ✅ Calendar updates instantly.
- ✅ Offline queue stores the correction.
- ✅ SQLite reflects the new reality immediately after sync.

---

### Scenario 4: Sneha uses "Snooze" repeatedly 

**Action:** Taps "Not Yet" on June 10, June 11, logs period on June 12.

**Expected System Behavior:**

- **Snooze Events:** Written to `snooze_events` table in SQLite.
- **SQLite Schema:** `snooze_events` table exists and stores `day_offset` 0 and 1.
- **React Query:** In-memory cache is invalidated, re-reads from SQLite to show the updated Sticky Card state.

**Checkpoints:**
- ✅ Sticky Card respects the 24-hour snooze cooldown.
- ✅ SQLite has the snooze logs.

---

## Section 3: The "Offline-First" Survival Test (The Remote Village)

### Scenario 5: Ananya logs a period entirely offline (Airplane Mode)

**Action:** Logs a period offline. No network.

**Expected System Behavior:**

- **Optimistic UI:** Calendar updates immediately (optimistic mutation).
- **Offline Queue:** Operation is written to EncryptedStorage (`shecare.offline.queue`).
- **SQLite:** Does NOT contain the un-synced period yet (because we only write to SQLite on server success, per Plan 3, Rule 2).
- **App Restart:** React Query is in-memory only. However, the optimistic state is stored in the React Query cache (in-memory). Since it's in-memory, if she force-quits and reopens the app, the optimistic update is lost. BUT the offline queue still has the operation.
- **Crucial Fix:** We must ensure the UI shows the pending operation. The `queryFn` reads SQLite (which doesn't have it yet). React Query should show a "Syncing..." badge for that date, derived from the offline store queue state.
- **Sync (Later):** She reaches Wi-Fi. `syncEngine` pushes the queue. Server returns 200. SQLite is updated. UI re-renders.

**Checkpoints:**
- ✅ Data survives app restart (in EncryptedStorage queue).
- ✅ Sync succeeds without duplicates.
- ✅ SQLite eventually has the record.

---

### Scenario 6: Ananya logs a period offline, THEN logs another period online before the first one syncs

**Action:** Day 1 (Offline): Logs Period A (June 20). Day 3 (Online): Logs Period B (July 18) before sync.

**Expected System Behavior:**

- **FIFO:** `syncEngine` processes the offline queue first. Period A syncs. Then Period B syncs.
- **SQLite:** Both periods are upserted into SQLite sequentially.

**Checkpoints:**
- ✅ FIFO order preserved.
- ✅ No overwrites.

---