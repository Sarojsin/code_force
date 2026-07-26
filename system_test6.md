# System Tests 6 — SheCare

> **Scope:** End date confirmation flow, auto-close safety net, and avg_period_length recalculation.
> **Goal:** Validate local notification scheduling, offline end-date marking, and automatic closing of orphaned period entries.
> **Pass Criteria:** Notifications must fire on time, SQLite must persist updates, and auto-close must prevent NULL end dates.

---

## Scenario 19: The End Date Notification — Detailed Explanation

This scenario validates the "Period Length Confirmation" flow. It is the system's polite way of saying: "Hey, your period should be wrapping up soon based on your average. Did it actually stop? Let us know so we can update your average."

---

### 1. The Scheduling Logic (Why Day 3?)

**User Action (Start):**

- **Date:** June 10.
- **User Action:** Logs the period start date (via Sticky Card "Yes" or `LogPeriodScreen`).
- **System State:** The system knows her `avg_period_length` is 5 days (from her past logs).

**The Calculation:**

The system schedules the notification for Day 3 of the bleeding cycle.

**Why Day 3?**

- Day 1 = June 10 (Start Day).
- Day 2 = June 11.
- Day 3 = June 12.

However, the text says the notification fires on June 13. Let's correct the math:

- If Start = June 10, Day 1 = June 10. Day 2 = June 11. Day 3 = June 12.
- The trigger offset is `(avg_period_length - 2)` days from the start.
- For `avg = 5`, offset = `5 - 2 = 3` days.
- June 10 + 3 days = June 13.

**Result:** The notification fires at 9:00 AM on June 13.

**Rationale:** This gives the user a 24-hour heads-up before her average end date (June 14). She can confirm if it stopped on June 13, or wait for it to stop on June 14/15.

**The Rule:**

```
Notification_Date = Start_Date + (avg_period_length - 2)
```

- If `avg = 4` days → fires on Day 2 (early heads-up).
- If `avg = 7` days → fires on Day 5.

---

### 2. The Notification Mechanism (Local vs. Server)

- **Implementation Method:** `expo-notifications` (Local Scheduled Notification).
- **No Server Dependency:** This notification is scheduled locally on the device using `expo-notifications` `scheduleNotificationAsync`.
- **Why Local?** Because the user might be offline when the day arrives. A server-side push notification would require internet, which she might not have on Day 3.
- **Storage:** The notification ID and the associated `entry_id` are stored in `pendingEndDate` (Zustand store persisted to EncryptedStorage) so the app knows which period entry the notification belongs to.

**The Payload:**

```typescript
{
  title: "Has your period ended?",
  body: "Tap to mark the end date.",
  data: { type: 'mark-end-date', entryId: 'entry-123' }
}
```

---

### 3. The User Interaction Flow (When She Taps)

#### Step 1: Tapping the Notification

The user taps the notification at 9:00 AM on June 13.

The app opens (if backgrounded) or navigates to `CycleDashboardScreen`.

#### Step 2: The "Mark End Date" Modal

A modal (or a prompt card) appears: "Has your period ended?"

- **Option A:** "Yes, it stopped today." (Pre-fills today's date: June 13).
- **Option B:** "No, it hasn't stopped yet." (Snooze for 24 hours → the notification will reappear tomorrow).
- **Option C:** "It stopped on [Date]" (Date picker to select a specific day, e.g., June 14 or 15).

#### Step 3: User Confirms End Date

The user selects June 13 (Option A) or selects June 14 (Option C).

**Action:** Taps "Confirm".

---

### 4. The SQLite & Backend Update (The Core Logic)

#### Step 4A: Optimistic SQLite Update (Local)

**Immediate Action:** The app calls `localDb.cycle.upsert()` to update the `period_end_date` field for the specific `cycle_entry`.

- **Before:** `{ id: 'entry-123', period_start_date: '2025-06-10', period_end_date: null }`
- **After:** `{ id: 'entry-123', period_start_date: '2025-06-10', period_end_date: '2025-06-13' }`

**UI Update:** The calendar instantly recalculates the `period_length` and updates the Dark Pink block. If she ends on June 13, the Dark Pink block shrinks from June 10–14 to June 10–13.

---

#### Step 4B: Average Recalculation (Local & Server)

- **Local:** The app recalculates her `avg_period_length` immediately using the new data point.
  - Old average: 5 days (across 5 cycles).
  - New data point: 3 days (June 10–13).
  - New average: `(5*5 + 3) / 6 = 4.67` days.
- **Note:** The local average is used for immediate display (e.g., next prediction Light Pink block), but the server's average will overwrite this on the next sync.

---

#### Step 4C: Background Sync (Server)

- **Mutation Trigger:** The modal calls `PUT /api/v1/cycle/entries/{id}` with `{ period_end_date: '2025-06-13' }`.
- **Queue:** If offline, the operation is enqueued in EncryptedStorage.
- **Online:** The server updates the `period_end_date` in PostgreSQL.
- **Server Recalculation:** The server recomputes the global `avg_period_length` and returns it in the response.
- **SQLite Sync:** On the next `syncEngine` pull, the updated server average is synced back to SQLite.

---

### 5. Edge Cases & The "Snooze" Fallback

| Scenario | System Behavior |
|----------|-----------------|
| User taps "No, not yet" (Snooze) | The modal closes. A new notification is scheduled for tomorrow at 9:00 AM (Day 4). The `pendingEndDate` state is updated to reflect the snooze. |
| User ignores the notification | The notification sits in the notification center. If the user opens the app manually, the "Mark End Date" prompt card appears on the Dashboard (as a fallback). |
| User logs the end date via `LogPeriodScreen` | If she manually goes to `LogPeriodScreen` and updates the end date before the notification fires, the `pendingEndDate` is cleared, and the scheduled notification is canceled via `cancelEndDateReminder()`. |

---

### 6. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Notification fires correctly. | Set the device date to June 12 at 8:59 AM. Wait 1 minute. The notification should appear at 9:00 AM. Tap it. | Proves the local notification scheduling logic respects the `avg_period_length` calculation. |
| ✅ SQLite updated. | After tapping "Confirm", query SQLite for the `cycle_entry` in question. `period_end_date` should be updated (e.g., `2025-06-13`). Force-quit and reopen the app to ensure the change persists. | Proves that the update is committed to the permanent local cache (not just volatile memory). |
| ✅ Average recalculated. | Check the user's `avg_period_length` after confirming. It should have shifted slightly. | Proves that the system learns from the user's input to refine future predictions. |
| ✅ Prompt card persists offline. | Turn off Wi-Fi. Trigger the prompt via the notification. Confirm the end date. The `period_end_date` should update in SQLite even though the server isn't reachable. | Proves the system is fully functional offline. |

---

### 7. The "Why" (Business Logic)

This feature closes the "Period Length" data gap:

| Without this feature | With this feature |
|---------------------|-------------------|
| The system guesses the end date based on stale averages. | The system prompts the user to confirm the actual end date. |
| `avg_period_length` remains inaccurate (e.g., she always bleeds 6 days, but the app guesses 5). | The average updates dynamically, leading to more accurate future Light Pink blocks. |
| The user feels the app is "buggy" because the calendar doesn't match reality. | The user feels the app is "smart" because it learns her unique pattern. |

---

### Summary

This scenario proves that your app actively "checks in" with the user to refine one of its most critical training data points (period length). By using local notifications and offline-first SQLite updates, the system ensures that the `avg_period_length` is always up-to-date, even if the user is in a remote area with no internet. This is the hallmark of a truly adaptive and user-respectful health app. 🌸📱

---

## Scenario 20: The "Auto-Close" Safety Net — Detailed Explanation

This scenario validates the "Forgotten End Date" safety net. It simulates the most common real-world behavior: a user starts her period, gets busy, ignores the "Has your period ended?" notification, and only remembers to open the app weeks later when she gets her next period.

The system must retroactively close the "open" period to prevent data corruption (an open entry with no end date breaks cycle length calculations). Here is the step-by-step breakdown of exactly what happens.

---

### 1. The Pre-Condition (The "Open" State)

**User Action (June 10):** Logs a period start (Start = June 10). Does NOT provide an end date.

**System State (SQLite):**

- `cycle_entries` has a record: `{ id: 'entry-123', period_start_date: '2025-06-10', period_end_date: NULL, is_active: true }`.
- The `avg_period_length` for this user is 5 days.

**System State (UI):** Calendar shows Dark Pink (`P`) starting June 10, extending for 5 days (June 14) based on the average. A "Mark End Date" prompt card is visible on the dashboard.

**Notification:** A local notification was scheduled for June 13 at 9:00 AM (Day 3), but the user ignores it.

---

### 2. The Ignore Phase (The Gap)

- **Date:** June 13 – July 7.
- **User Action:** The user does not open the app. She does not mark the end date. The `period_end_date` remains `NULL` in SQLite.
- **System State (SQLite):** The `cycle_entries` record remains "open" (`period_end_date = NULL`).
- **System State (UI):** The Sticky Card disappears (it only lasts from P-3 to P+6). The "Mark End Date" prompt card remains on the dashboard, but the user ignores it.

---

### 3. The "Log Next Period" Action (The Trigger)

- **Date:** July 8.
- **User Action:** The user gets her next period. She opens the app and logs Start: July 8. (She may or may not provide an end date for this one; it doesn't matter for the auto-close logic).
- **Optimistic UI (Local):** The calendar immediately updates to show Dark Pink for July 8–12 (based on her average). The new entry is written to SQLite locally (offline-first) with `period_start_date = '2025-07-08'`.

---

### 4. The Backend Auto-Close Logic (The Core Mechanism)

This is the heart of the scenario. The backend `_auto_close_open_entry()` function runs whenever a new period is logged.

#### Step 4A: Detection

The server receives the new period (July 8) via `POST /api/v1/cycle/entries`.

Before saving the new period, the server runs a query:

```sql
SELECT * FROM cycle_entries 
WHERE user_id = X AND is_active = true AND period_end_date IS NULL 
ORDER BY period_start_date DESC LIMIT 1;
```

**Result:** It finds the June 10 entry with `period_end_date = NULL`.

---

#### Step 4B: Calculating the End Date

The server looks at the user's `avg_period_length`. Let's assume it is 5 days (from her historical logs).

**Calculation:** `period_end_date = period_start_date + (avg_period_length - 1)`.

- June 10 + `(5 - 1)` = June 10 + 4 = June 14.

**The Rule:** The system does not use the new July 8 start date to calculate the end date. It uses the historical average. (Why? Because we don't know if the gap was 28 days or 32 days; the average is the safest bet).

---

#### Step 4C: Updating the Database

The server updates the June 10 entry:

```sql
UPDATE cycle_entries 
SET period_end_date = '2025-06-14', updated_at = NOW() 
WHERE id = 'entry-123';
```

**Result:** The June 10 period is now "closed" with a duration of 5 days. Data integrity is restored.

---

### 5. The Data Integrity Timeline (Before vs. After)

| Database | Before (Pre-Sync) | After (Backend Auto-Close) |
|----------|-------------------|---------------------------|
| **Local SQLite (Mobile)** | June 10: `period_end_date = NULL` (Open).<br>July 8: New entry inserted. | June 10: Still `NULL` (local hasn't pulled the fix yet).<br>July 8: Inserted. |
| **PostgreSQL (Server)** | June 10: `period_end_date = NULL`. | June 10: `period_end_date = '2025-06-14'` (Closed). |

---

### 6. SQLite Hydration (The Pull Fix)

Now the mobile app must learn about the fix.

#### Step 6A: The Sync Trigger

The user opens the app (online) or the background sync triggers.

`syncEngine.pullServerData()` calls `GET /sync/changes?since=<last_pull_timestamp>`.

---

#### Step 6B: The Server Response

The server returns the updated June 10 record in the changes list.

```json
{ "type": "update", "entity": "cycle_entries", "id": "entry-123", "data": { "period_end_date": "2025-06-14" } }
```

---

#### Step 6C: SQLite Upsert

The mobile app calls `localDb.cycle.upsert(server_data)`.

**Result:** The local SQLite record for June 10 is updated to `period_end_date = '2025-06-14'`.

---

### 7. The User Experience (What the User Sees)

| Phase | UI State | User Perception |
|-------|----------|-----------------|
| June 10 – July 7 | Dark Pink extends to June 14. Prompt card visible. | "I know my period ended on June 14, I just didn't tap it." |
| July 8 (Logging New Period) | Dark Pink appears for July 8. The old period is still shown (with an unconfirmed end date). | "I'm logging my new period." |
| After Sync (Pull) | The June 10 Dark Pink block now truncates to June 14 (if it previously extended to a guessed date). | "The app fixed itself." |

---

### 8. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| Avg Period Length is outdated (e.g., she now bleeds for 7 days). | The auto-close uses the old average (5 days). She can manually correct the end date later via `LogPeriodScreen` (which will update `avg_period_length`). |
| User opens the app offline after July 8, before the pull. | Local SQLite still has `period_end_date = NULL` for June 10. The UI shows the old open state. When she reconnects, the pull fixes it. |
| User does NOT log the next period for months (e.g., pregnancy). | No auto-close is triggered. The June 10 entry remains open indefinitely. The system will show a "Catch-up Card" (Scenario 5) to prompt her to backfill. |
| User manually closes the June 10 period via `LogPeriodScreen` before logging July 8. | The `period_end_date` is set. When she later logs July 8, the `_auto_close_open_entry()` query returns `NULL`, so it does nothing. |

---

### 9. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Auto-close prevents data corruption. | Log a period (June 10) without an end date. Log a new period (July 8). Check the server database. The June 10 record should now have a `period_end_date`. | Proves that the system actively repairs "open" entries, preventing them from breaking cycle length calculations and ML predictions. |
| ✅ SQLite eventually reflects the closed period. | After logging July 8, force a sync (or wait for background sync). Query local SQLite for the June 10 entry. It should now have `period_end_date = '2025-06-14'`. | Proves that the mobile cache is updated with the server's corrective action, ensuring the UI reflects the truth. |

---

### 10. The "Why" (Business Logic)

This scenario ensures that the system never has an "orphaned" period (a start date with no end date).

| Without Auto-Close | With Auto-Close |
|--------------------|-----------------|
| The June 10 entry would remain open forever. The user's `avg_period_length` would never be updated with this cycle. The next prediction would ignore this data point, leading to a gradual degradation of accuracy over time. | The system gracefully closes the loop using the user's historical average. Even if the user is forgetful, the data remains usable for the ML engine. |

---

### Summary

This scenario proves that your backend is self-healing and data-consistent. By automatically closing open entries when a new period is logged, the system ensures that:

- The historical data remains complete (no NULL end dates left hanging).
- The ML engine has clean data to calculate `avg_cycle_length` and `avg_period_length`.
- The user doesn't have to be perfect—the app covers for her when she forgets.

This is the hallmark of a robust, user-friendly health app. 🌸🛡️
