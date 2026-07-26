# All Tests — SheCare

> **Scope:** 25 specific test scenarios across 10 real-world user archetypes.
> **Goal:** Validate everything from perfect 28-day cycles to extreme PCOS variability, multi-device sync, and complete offline isolation.
> **Pass Criteria:** All 25 scenarios must pass for the Cycle Module to be considered bulletproof.

---

## Test Users (Archetypes)

| User | Profile | Cycle Pattern | Device |
|------|---------|---------------|--------|
| **Priya** | 28yo, Healthy | 28–30 days, Regular | Single Phone (Online) |
| **Ananya** | 32yo, PCOS | 35–45 days, Irregular, High Stress | Single Phone (Offline 80% of time) |
| **Sneha** | 25yo, Student | 32 days, but travels frequently | Phone + Web Dashboard (Multi-device) |
| **Maya** | 45yo, Perimenopausal | 22–60 days, Highly erratic | Single Phone |
| **Rita** | 29yo, New User | Just had a baby (Lactating) — No periods yet | Single Phone |

---

## Section 1: The "Happy Path" (Baseline Sanity)

### Scenario 1: Priya logs a period perfectly on time (Online) (done)

**Action:** Priya gets her period on June 14. The model predicted June 14. She opens the app, sees the Sticky Card, and taps "Yes, started on June 14."

**Expected System Behavior:**

- **Optimistic UI:** Calendar instantly turns the Light Pink block (June 14–avg period length) into Dark Pink.
- **SQLite Write:** The mutation `onSuccess` triggers `localDb.cycle.upsert()` with the server's response, writing the confirmed period to SQLite.
- **React Query:** In-memory cache is invalidated and refetches from SQLite (which now has the updated record).
- **Sync:** No pending writes in EncryptedStorage for this operation.

**Checkpoints:**
- ✅ UI updates < 100ms.
- ✅ SQLite has the corrected entry.
- ✅ Sticky Card disappears.

---

### Scenario 2: Priya logs a period "Manually" via the Log Period Screen (done)

**Action:** Priya ignores the Sticky Card. On June 16, she logs Start: June 14, End: June 19.

**Expected System Behavior:**

- **Auto-Link:** The backend links this to the existing prediction (within ±5 days).
- **SQLite:** `localDb.cycle.upsertMany()` writes the updated period block to SQLite.
- **React Query:** In-memory cache is invalidated and re-reads from SQLite.

**Checkpoints:**
- ✅ Auto-linking triggers silently.
- ✅ SQLite contains the accurate 6-day period.

---

## Section 2: The "Correction & Snooze" Flow (The Feedback Loop)

### Scenario 3: Ananya corrects a date (Late by 4 days) via Sticky Card (done)

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

### Scenario 4: Sneha uses "Snooze" repeatedly (done)

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

### Scenario 5: Ananya logs a period entirely offline (Airplane Mode) (done)

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

### Scenario 6: Ananya logs a period offline, THEN logs another period online before the first one syncs (done)

**Action:** Day 1 (Offline): Logs Period A (June 20). Day 3 (Online): Logs Period B (July 18) before sync.

**Expected System Behavior:**

- **FIFO:** `syncEngine` processes the offline queue first. Period A syncs. Then Period B syncs.
- **SQLite:** Both periods are upserted into SQLite sequentially.

**Checkpoints:**
- ✅ FIFO order preserved.
- ✅ No overwrites.

---

## Section 4: The "Multi-Device War" (Conflict Resolution)(done)

### Scenario 7: Sneha edits the SAME period on Phone (Offline) and Web (Online)

**Action:** Phone offline corrects to June 12 (9:00 AM). Web online corrects to June 14 (10:00 AM). Phone reconnects.

**Expected System Behavior:**

- **Conflict (409):** Server returns 409 with `server_data` (June 14).
- **SQLite Overwrite:** `syncEngine` calls `localDb.cycle.upsert(server_data)`, overwriting the local (stale) June 12.
- **React Query:** In-memory cache invalidated and re-reads from SQLite (now showing June 14).

**Checkpoints:**
- ✅ Server timestamp authority wins.
- ✅ SQLite is overwritten with server truth.

---

### Scenario 8: Sneha edits DIFFERENT periods on two devices (No conflict)(done)

**Action:** Phone corrects Period A (June 10). Web corrects Period B (July 15).

**Expected System Behavior:**

- Both sync independently. SQLite gets both updates.

**Checkpoints:**
- ✅ No false conflicts.

---

## Section 5: The "Irregular & Outlier" Edge Cases

### Scenario 9: Maya (Perimenopausal) has a 60-day gap (done)

**Action:** Logs Jan 1, then March 2 (60 days).

**Expected System Behavior:**

- **SQLite:** Stores the 60-day gap in `cycle_entries`.
- **UI:** Prediction window appears (confidence drops). SQLite stores the `std_dev` and `avg_error` recalculated by the backend.

**Checkpoints:**
- ✅ SQLite holds the historical extreme data.
- ✅ Prediction window displayed.

---

### Scenario 10: Rita (Postpartum) has NO periods (done)

**Action:** Opens app. No cycle data.

**Expected System Behavior:**

- **SQLite:** Returns `[]` for `user_id`.
- **UI:** Shows empty state.

**Checkpoints:**
- ✅ App doesn't crash.
- ✅ Empty state renders beautifully.

---

### Scenario 11: User logs a period in the FUTURE (done)

**Action:** Today is July 20. User logs start date July 25.

**Expected System Behavior:**

- **SQLite:** Stores the future date.
- **UI:** Renders in Light Pink (predicted).

**Checkpoints:**
- ✅ Future dates are not treated as "Confirmed Reality."

---

### Scenario 12: User tries to mark End Date BEFORE Start Date (done)

**Action:** Start June 10. Tries to end June 8.

**Expected System Behavior:**

- **UI Validation:** Rejects with error.
- **SQLite:** No invalid data written.

**Checkpoints:**
- ✅ Validation catches the logical error.

---

## Section 6: The "Visual Integrity" Tests (UI/UX) (completely done)

### Scenario 13: Calendar 4-Phase Color Rollover

**Action:** June 1 confirmed as Period (`P`). User corrects it to June 5.

**Expected System Behavior:**

- **SQLite:** `period_start_date` updated. `calculate_cycle_phases` logic applied to SQLite data.
- **UI:** Dark colors for this cycle, Light colors for the next.

**Checkpoints:**
- ✅ SQLite data drives the phase calculation.

---

### Scenario 14: BS Calendar Switch (Bikram Sambat) (completely done)

**Action:** Toggle Home screen chip from AD to BS.

**Expected System Behavior:**

- **Display:** Date formatting changes in the UI. SQLite stores ISO dates (AD). Conversion happens client-side via `formatDisplayDate`.

**Checkpoints:**
- ✅ All 20+ date displays switch instantly.
- ✅ SQLite unaffected (storage remains ISO).

---

### Scenario 15: Prediction History Table (The Report Card) (completely done)

**Action:** User opens `CyclePredictionsScreen`.

**Expected System Behavior:**

- **SQLite:** `PredictedCycle` history is read from SQLite (archived predictions).
- **UI:** Shows real data with Mint/Peach/Blush coloring.

**Checkpoints:**
- ✅ Real data replaces mock data.

---

## Section 7: The "Sync Engine" Stress Tests 

### Scenario 16: Sync engine receives a 500 error from the server (completely done)

**Action:** Online, but backend crashes.

**Expected System Behavior:**

- **Offline Queue:** Operation stays in EncryptedStorage. `retryCount` increments.
- **SQLite:** Unchanged.

**Checkpoints:**
- ✅ Queue is not cleared.
- ✅ Infinite loop prevented.

---

### Scenario 17: Sync engine receives a 400 error (Bad Request) (completely done)

**Action:** Server rejects the data.

**Expected System Behavior:**

- **Offline Queue:** `isRetryableError(400) = false`. Operation is discarded from EncryptedStorage.
- **SQLite:** No write occurs.
- **UI:** Toast: "Failed to sync. Discarded."

**Checkpoints:**
- ✅ Malformed data is dropped to prevent queue blockage.

---

### Scenario 18: The "Queue Backlog" (100 operations pending) (completely done)

**Action:** Offline for 3 days, writes 100 entries.

**Expected System Behavior:**

- **EncryptedStorage:** Queue holds 100 ops.
- **Sync Engine:** Batches them (`POST /sync/batch`). Gzip compression applies.
- **SQLite:** On success, `upsertMany` batches them into SQLite.

**Checkpoints:**
- ✅ Gzip compression triggers.
- ✅ Batch endpoint handles large payloads.

---

## Section 8: The "Period Length Confirmation" Flow (End Dates)

### Scenario 19: The End Date Notification fires exactly on Day 3 to confirm period length or average period length (completely done)

**Action:** Start June 10. Avg length 5. Notification fires June 13 at 9:00 AM.

**Expected System Behavior:**

- **Local Notification:** Fires (handled by Expo Notifications).
- **SQLite:** When user confirms End Date, `period_end_date` is updated in SQLite.

**Checkpoints:**
- ✅ Notification fires correctly.
- ✅ SQLite updated.

---

### Scenario 20: User ignores the notification, logs the NEXT period (Auto-Close) (completely done)

**Action:** June 10 start. Ignores end. Gets next period July 8.

**Expected System Behavior:**

- **Backend/Service:** `_auto_close_open_entry()` runs on backend. This closes the open entry in the cloud.
- **SQLite:** On the next pull (`/sync/changes`), the updated `period_end_date` is pulled and upserted into SQLite.

**Checkpoints:**
- ✅ Auto-close prevents data corruption.
- ✅ SQLite eventually reflects the closed period.

---

## Section 9: Model Performance (ML Drift)

### Scenario 21: The "Heuristic" vs "Global Model" threshold (not done)

**Action:** User has exactly 9 cycles logged.

**Expected System Behavior:**

- **Backend:** Uses Linear Regression (6–9 cycles). Switches to Global XGBoost at cycle 10.
- **SQLite:** Stores `model_type` and `confidence_score` in the `predicted_cycles` table.

**Checkpoints:**
- ✅ Model type changes in the UI.
- ✅ SQLite stores the updated prediction metadata.

---

## Section 10: The "Disaster Recovery" Tests

### Scenario 22: EncryptedStorage fails (Cannot read/write) (completely done)

**Action:** SecureStore is corrupted.

**Expected System Behavior:**

- **Auth:** `storage.ts` catches the error. Falls back to in-memory. User might have to re-login.
- **Offline Queue:** Cannot save pending operations. Warning banner shows.
- **SQLite:** Still functional (since it's a separate file in the documents directory). Reads still work.

**Checkpoints:**
- ✅ App does not crash.
- ✅ SQLite reads still serve data.

---

### Scenario 23: SQLite fails (Corrupted / Disk Full) (completely done)

**Action:** Disk is full. SQLite cannot write.

**Expected System Behavior:**

- **Read Path:** `queryFn` catches the SQLite error and falls back to React Query in-memory cache (if available). If not, returns empty. Toast shows: "Local storage unavailable."
- **Write Path:** Writes go to EncryptedStorage queue. The sync engine will retry SQLite writes on the next sync cycle.

**Checkpoints:**
- ✅ Graceful degradation.
- ✅ App does not crash.
- ✅ User can still log periods.

---

### Scenario 24: App Update (SQLite Schema Migration) (completely done)

**Action:** Developer adds a new column to `cycle_entries` (e.g., `stress_level`). Drizzle migration generated.

**Expected System Behavior:**

- **Migration:** `useMigrations()` runs on app launch (blocking Splash Screen).
- **SQLite:** Table is altered, new column added. Existing data is preserved.
- **React Query Buster:** Does NOT exist anymore (since `persistQueryClient` is removed). No cache invalidation needed because the `queryFn` reads directly from SQLite. The new column is just available for future queries.

**Checkpoints:**
- ✅ Migrations run smoothly.
- ✅ No stale cache errors.
- ✅ App doesn't crash due to mismatched data shapes.

---

### Scenario 25: The "Kill Switch" (User logs out globally) (completely done)

**Action:** Admin revokes token, or password changes on another device.

**Expected System Behavior:**

- **Auth:** Server returns 401. App clears EncryptedStorage (tokens, queue).
- **SQLite:** Does NOT get cleared. SQLite is a cache partitioned by `user_id`. The user is logged out, but the database file remains intact with their data.
- **Re-login:** If the same user logs back in, the data is still available in SQLite and instantly populates the UI (since `queryFn` reads from SQLite). This is a feature, not a bug.
- **New user login:** If a different user logs in, the SQLite queries are filtered by `user_id`, so they only see their own data.
- **(Optional enhancement):** If needed, implement `clearSqliteOnLogout` to wipe the entire DB for privacy.

**Checkpoints:**
- ✅ Session ends immediately.
- ✅ App fully resets auth state.
- ✅ SQLite persists safely for the returning user.

---

## Section 11: SQLite & Drizzle Infrastructure

### Scenario 26: Fresh Install — Migration runs successfully  (completely done)

**Action:** Install the app on a clean device (no existing SQLite file).

**Expected System Behavior:**

- **Migration:** On first launch, `useMigrations()` runs. The splash screen blocks until `drizzle-kit` creates all tables (`cycle_entries`, `journal_entries`, etc.).
- **Splash Time:** Migration should complete in < 500ms (empty database, no data to migrate).
- **Health Check:** `dbHealthCheck()` returns `{ ok: true, version: 1 }`.

**Checkpoints:**
- ✅ Tables exist in `sqlite_master`.
- ✅ App proceeds to Auth/Onboarding.

---

### Scenario 27: Fresh Install — Offline (No API) (completely done)

**Action:** Install the app. Turn on Airplane mode before opening.

**Expected System Behavior:**

- **SQLite:** Empty (no data).
- **React Query:** `queryFn` hits SQLite, returns `[]`. Background API fails silently.
- **UI:** Shows empty states (e.g., "No cycles logged yet").
- **Auth:** `authStore.hydrate()` has no token. Shows Auth Stack (Login/Register).

**Checkpoints:**
- ✅ No crash.
- ✅ No infinite spinners.
- ✅ User can see the Login screen.

---

### Scenario 28: Migration Failure (Corrupt DB)  (completely done)

**Action:** Simulate a corrupt SQLite file (e.g., manually corrupt `shecare.db` via adb).

**Expected System Behavior:**

- **Migration:** `useMigrations()` throws an error.
- **Graceful Degradation:** The app logs the error to Sentry, shows a toast: "Local storage unavailable. Your data is safe."
- **App continues:** React Query uses in-memory cache (empty) or previously fetched data (if any).

**Checkpoints:**
- ✅ App does NOT crash.
- ✅ Sentry receives the error report.

---

### Scenario 29: SQLite Schema Upgrade (App Update) (completely done)

**Action:** You add a new column to `cycle_entries` (e.g., `stress_level`). Generate a new Drizzle migration.

- **Old app (v1):** SQLite has no `stress_level` column.
- **New app (v2):** `useMigrations()` runs `ALTER TABLE cycle_entries ADD COLUMN stress_level TEXT;`.

**Expected System Behavior:**

- Migration completes successfully.
- Existing rows have `NULL` for the new column.
- The app queries SQLite without crashing (the service layer handles `undefined`/`null` gracefully).

**Checkpoints:**
- ✅ Schema upgrade works.
- ✅ Old data is preserved.

---

## Section 12: Query & Cache Behavior (Post-RQ-Persist Removal)
 
### Scenario 30: Returning User — Offline (SQLite has data, AsyncStorage is cleared)  (completely done with gaps)

**Action:**

1. User logs in online, syncs 6 months of history (SQLite is populated).
2. Manually clear AsyncStorage (or uninstall `persistQueryClient` via code).
3. Turn off Wi-Fi. Reopen the app.

**Expected System Behavior:**

- **SQLite:** Returns 6 months of history.
- **React Query:** In-memory cache is empty.
- **UI:** Renders the history instantly (< 50ms).
- **The "Stale Cache" Bug:** Is the 7-day-old AsyncStorage data showing instead of SQLite? NO — because `persistQueryClient` is removed. The app bypasses AsyncStorage entirely.

**Checkpoints:**
- ✅ SQLite is the sole source.
- ✅ No stale cache override.

---

### Scenario 31: Background API Refresh — UI Updates Silently  (completely done with gaps)

**Action:** User opens the app (online). SQLite has old data (e.g., from 2 days ago). The server has a new period logged from another device.

**Expected System Behavior:**

1. `queryFn` returns SQLite data instantly (UI renders).
2. Background API call fires. Fetches the new period.
3. `localDb.cycle.upsertMany()` writes the new period to SQLite.
4. `queryClient.invalidateQueries()` runs.
5. React Query re-executes the `queryFn`, which now reads the updated SQLite (including the new period).

**UI:** Silently updates with the new period. No spinner.

**Checkpoints:**
- ✅ UI updates without user interaction.
- ✅ No flash/loading state.

---

### Scenario 32: Offline Writes — Optimistic UI + SQLite Sync  (completely done with gaps)

**Action:** User writes a journal entry offline.

**Expected System Behavior:**

- **Optimistic UI:** UI updates instantly (entry appears with a "Syncing..." badge).
- **EncryptedStorage:** Operation is enqueued.
- **SQLite:** NOT updated yet (because we only write to SQLite on server success).
- **App Restart:** React Query cache is lost. SQLite still lacks the entry. The UI shows the list of synced entries (without the pending one).
- **Reconnect & Sync:** Sync engine pushes the queue. Server returns 200. `localDb.journal.upsert()` updates SQLite. UI shows the entry (without the badge).

**Checkpoints:**
- ✅ Pending entries are not lost.
- ✅ SQLite eventually has the record.

---

## Section 13: Stress & Edge Infrastructure

### Scenario 33: SQLite Performance — 5,000+ Records  (completely done with gaps)


**Action:** Import 5,000 cycle entries (simulating a heavy user over 10+ years) into SQLite.

**Expected System Behavior:**

- **Query Speed:** `localDb.cycle.getHistory()` (with `LIMIT 50`) should return in < 20ms.
- **Indexes:** Ensure `idx_cycle_entries_user_id` and `idx_cycle_entries_period_start_date` are present.
- **UI:** Scrolling through the list should be smooth (< 60fps).

**Checkpoints:**
- ✅ SQLite handles large datasets gracefully.

---

### Scenario 34: Offline Queue + SQLite Conflict  (completely done with gaps)


**Action:**

1. Device A logs a period offline (June 10).
2. Before Device A syncs, Device B (web) updates the SAME period to June 12.
3. Device A reconnects.

**Expected System Behavior:**

- **Conflict (409):** Server returns 409 with `server_data` (June 12).
- **Sync Engine:** `hydrateSqlite()` overwrites SQLite with June 12.
- **Offline Queue:** The pending CREATE operation for June 10 is discarded (since the server resolved the conflict).
- **UI:** React Query invalidates, refetches from SQLite, shows June 12.

**Checkpoints:**
- ✅ Conflict resolution works.
- ✅ SQLite is updated with the server truth.

---

### Scenario 35: Logout — SQLite Data Persistence (Privacy Check)  (completely done with gaps)


**Action:** User logs out (taps "Sign Out").

**Expected System Behavior:**

- **Auth:** `authStore.reset()` clears EncryptedStorage (tokens, user, queue).
- **SQLite:** Data remains intact (files are not deleted).
- **Re-login (Same User):** App hydrates, React Query reads SQLite, data appears instantly.
- **Login (Different User):** SQLite queries are filtered by `user_id`. The new user sees only their own data (if any). The previous user's data is still in the DB but inaccessible due to the `WHERE user_id = ...` clause.
- **(Optional Security Enhancement):** If you want to clear SQLite on logout, implement `clearSqliteOnLogout()` using `db.run(sql'DELETE FROM ...')`.

**Checkpoints:**
- ✅ User's data persists for re-login.
- ✅ Different users cannot see each other's data.


## Section 14: Concurrency & Edge Infrastructure

### Scenario 36: Race Condition — Sync Engine Triggers Twice Simultaneously (completely done with gaps)


**Action:** App is offline. User force-quits and relaunches, triggering `useEffect` sync. Simultaneously, `NetInfo` fires `isConnected = true` and triggers `syncAll()`.

**Expected System Behavior:**

- **Sync Lock:** `syncEngine.isSyncing` guard prevents the second call from executing.
- **Queue Integrity:** The queue is not processed twice. No duplicate API calls.

**Checkpoints:**
- ✅ `isSyncing` flag prevents duplicate runs.
- ✅ No duplicate writes to SQLite.

---

### Scenario 37: App Backgrounded During Sync (iOS/Android) (completely done with gaps)


**Action:** User starts a large sync (100+ pending operations). Before the sync completes, the user swipes up to background the app.

**Expected System Behavior:**

- **Graceful Pause:** `AppState` changes to `'background'`. The sync engine does not crash.
- **Resume:** When the app returns to the foreground, the sync engine resumes (or restarts) without duplicating operations (idempotency keys prevent duplicates).

**Checkpoints:**
- ✅ No crash on background.
- ✅ Sync resumes safely.

---

### Scenario 38: Deep Link Conflict — Two Notifications Tapped Rapidly (completely done with gaps)


**Action:** User receives a "Check-in" notification and an "End Date Reminder" notification simultaneously. Taps both rapidly.

**Expected System Behavior:**

- **Navigation:** The app navigates to the Cycle Dashboard.
- **State:** The deep-link handler checks if the screen is already mounted. It does NOT remount the screen or reset the navigation stack completely, preserving the user's current state.

**Checkpoints:**
- ✅ No navigation stack reset.
- ✅ App doesn't crash.

---

### Scenario 39: Stale Refresh Token (Refresh Loop Death) (completely done with gaps)


**Action:** Refresh token expires. The user is on the app. The interceptor attempts `POST /auth/refresh`. The server returns 401 (refresh token expired).

**Expected System Behavior:**

- **Kill Switch:** The interceptor catches the 401 and calls `triggerSessionExpired()`.
- **Queue Reset:** EncryptedStorage (tokens + offline queue) is cleared.
- **UI:** User is navigated to the Auth Stack (Login).
- **No Infinite Loop:** The app does NOT retry the refresh token repeatedly.

**Checkpoints:**
- ✅ Session ends gracefully.
- ✅ Infinite loop prevented.

---

### Scenario 40: Large Offline Queue Exceeding SecureStore Limits (iOS Keychain) (completely done with gaps)


**Action:** User is offline for 3 weeks, generating 1,500 journal entries/mood logs. The `offlineStore` attempts to save the entire queue (as a single JSON blob) to `expo-secure-store`.

**Background:** iOS SecureStore limits values to ~1–4 KB per key. A 1,500-item queue will exceed this limit, causing `setItem` to throw an error.

**Expected System Behavior:**

- **Fallback / Chunking:** The app catches the `setItem` error. It does NOT crash.
- **Split Logic:** The app attempts to store the queue in AsyncStorage (which has a much larger limit) as a fallback, or it prunes the oldest 20% of the queue to fit it into SecureStore.
- **User Alert:** A toast appears: "Too many offline entries. Syncing oldest ones first." (Implicitly handled via `maxRetries` and FIFO discard).

**Checkpoints:**
- ✅ App does not crash due to storage limits.
- ✅ Pending operations are not silently lost.

---

### Scenario 41: Type-Safe Parsing Error — Malformed JSON in SQLite (completely done with gaps)


**Action:** A Drizzle migration adds a `symptoms` JSON column. Due to a bug, a record in SQLite has `symptoms = '{{'` (malformed JSON). The `queryFn` tries to parse it.

**Expected System Behavior:**

- **Service Layer:** `localDb.cycle.getHistory()` wraps `JSON.parse()` in a `try-catch`.
- **Graceful Degradation:** If parsing fails, the field is set to `[]` (default empty array) and logged to Sentry.
- **UI:** The list renders smoothly, skipping the malformed symptom entry.

**Checkpoints:**
- ✅ App doesn't crash on malformed data.
- ✅ Error is captured in Sentry.

---

### Scenario 42: Timezone Shift — User Travels from Nepal (+5:45) to US (-4:00) (completely done with gaps)


**Action:** User logs a period start on July 15, 2025 in Nepal. She travels to the US, and the phone's timezone changes. She opens the app and views her cycle history.

**Expected System Behavior:**

- **ISO Storage:** Dates are stored as ISO strings (`YYYY-MM-DD`) in SQLite (no timezone attached).
- **Display:** The app uses `date-fns` to format the date. `new Date('2025-07-15')` is treated as local time.
- **Critical Check:** The period start date should not shift to July 14 or July 16 simply because the timezone changed.
- **Validation:** Ensure `toDateStr` and `formatDisplayDate` use UTC methods (or simply parse the ISO string as-is) to prevent day-shifting. This is a known React Native pitfall.

**Checkpoints:**
- ✅ Dates remain accurate across timezones.
- ✅ No off-by-one errors.

---

### Scenario 43: Multi-Device Setup — Temp ID Collision (completely done with gaps)


**Action:** User creates a period offline on Device A (gets `temp_id = 'abc'`). Device B (offline) creates a period at the exact same microsecond, generating the same `temp_id` (extremely unlikely with `crypto.randomUUID()`, but possible if the fallback UUID generator is used).

**Expected System Behavior:**

- **Collision Handling:** The app uses `crypto.randomUUID()` (1 in 2^122 collision chance). The fallback generator also uses high-entropy random.
- **Safeguard:** Even if they collide, the sync engine sends `idempotency_key` (which is a separate UUID). The server uses this to deduplicate.

**Checkpoints:**
- ✅ Unique IDs prevent data overwriting.
- ✅ Server dedup protects against edge-case collisions.

---

### Scenario 44: Voice Journal — Binary Data (Offline) (not doing for now)

**Action:** User records a voice journal offline (audio file stored locally via `expo-file-system`). She taps "Save".

**Expected System Behavior:**

- **Storage:** The audio file is saved to the app's documents directory.
- **Queue:** A metadata reference (path to the file) is enqueued in EncryptedStorage (the binary file stays on disk).
- **Sync:** When online, the sync engine uploads the binary file (via `expo-file-system` read) to the server via a `multipart/form-data` request. On success, the file path is retained in SQLite. If the upload fails, the file stays on disk.

**Checkpoints:**
- ✅ Binary data is stored offline.
- ✅ Sync succeeds without corrupting the file.

---

### Scenario 45: Full Disk Space Recovery (completely done with gaps)


**Action:** User's phone is critically low on storage (< 50 MB free). The app tries to write 5 MB of new data to SQLite.

**Expected System Behavior:**

- **SQLite Error:** `SQLITE_FULL` error is thrown.
- **Service Layer:** `BaseLocalService.upsert()` catches the error, logs to Sentry, and does not crash.
- **UI:** A toast appears: "Storage full. Please free up space and try again."
- **Fallback:** The operation remains in the EncryptedStorage queue (since it's tiny), ensuring no data loss when space is eventually freed.

**Checkpoints:**
- ✅ App does not crash on disk-full.
- ✅ Data is preserved in the queue.

## Section 15: Network Chaos & Timing Edge Cases

### Scenario 46: The "Network Flapping" (Constant Offline/Online Toggle)

**Action (Random):** The user rapidly toggles Airplane mode on/off while the app is:

- Loading the dashboard.
- In the middle of `syncEngine.pushOperations()`.
- Submitting a correction via the Sticky Card.

**Expected System Behavior:**

- **Idempotency:** The sync engine must not push duplicate operations. If the network fails mid-upload, the server must ignore the retry (via Idempotency-Key).
- **UI State:** The connectivity banner (`isConnected`) should not cause a full-screen reload. It should just toggle a subtle banner.
- **SQLite:** No data should be corrupted by half-written transactions. If the app crashes mid-sync, SQLite should roll back to the last committed state (ACID compliance).

**Checkpoints:**
- ✅ No duplicate data.
- ✅ No UI freezing.
- ✅ SQLite integrity remains intact.

---

### Scenario 47: The "Rapid Fire" Tapping (Race Condition on UI)

**Action (Random):** User taps "Log Period" twice in rapid succession (or clicks "Save" before the previous screen has finished navigating).

**Expected System Behavior:**

- **Double Submission Prevention:** The mutation hook should have `isPending` or `isLoading` that disables the button immediately after the first tap.
- **Queue Check:** If the first operation is queued (offline), the second tap should not create a duplicate record.

**Checkpoints:**
- ✅ No duplicate entries.
- ✅ The button is disabled during submission.

---

### Scenario 48: "The Fragile Internet" (Very Slow 2G/3G Network)

**Action (Chaos):** Network is available but incredibly slow (30KB/s). The API takes 10+ seconds to respond. The user gets impatient and navigates away to another screen.

**Expected System Behavior:**

- **AbortController:** The fetch request should be aborted when the component unmounts (or a new query is triggered).
- **Cache State:** React Query should not mark the data as "error" if the request is aborted. It should retain the existing SQLite data.
- **Memory:** Aborted requests should clean up their listeners to prevent memory leaks.

**Checkpoints:**
- ✅ Old SQLite data remains visible.
- ✅ No pending zombie requests blocking the UI.

---

### Scenario 49: "The Desync" (SQLite vs. Backend Discrepancy)

**Action (Random):** The backend (Postgres) has a record (ID: `abc-123`). SQLite has the same record, but with a slightly different `updated_at` timestamp. The user tries to edit the record offline.

**Expected System Behavior:**

- **Conflict Check:** When the user comes online, the `syncEngine` sends the update. If the server's timestamp is newer, a 409 triggers the overwrite.
- **UI Refresh:** React Query invalidates and reads the fresh data from SQLite (overwritten).
- **No Data Loss:** The user's local edit is discarded gracefully (with a toast) rather than corrupting the sync queue.

**Checkpoints:**
- ✅ Conflict resolution handles timestamp mismatches.
- ✅ No data corruption.

---

### Scenario 50: "The Midnight Rollover" (Timezone/Daylight Saving Shift)

**Action (Chaos):** It is exactly 11:59 PM on the last day of the predicted period. The device timezone is set to a region that observes Daylight Saving Time (DST). The user logs the end date right as the DST shift occurs, potentially causing the date to "jump" back or forward an hour.

**Expected System Behavior:**

- **ISO Parsing:** The date picker relies solely on the ISO string (`YYYY-MM-DD`), not on `Date.getHours()`.
- **Storage:** `period_end_date` is stored as `2025-10-15` without timezone offset.
- **Validation:** The system does not rely on `Date.now()` to calculate "today." It uses the user's selected date from the picker.

**Checkpoints:**
- ✅ DST shifts do not change the selected date.
- ✅ Calendar dates remain accurate.
