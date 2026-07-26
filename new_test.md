# New Tests — SheCare

> **Scope:** Cycle confirmation, manual logging, end-date rules, snooze, offline-first sync, multi-device conflict, and edge cases.
> **Goal:** Validate period logging behavior across online, offline, multi-device, and irregular-cycle scenarios.
> **Pass Criteria:** All scenarios must pass while respecting the 3-state buffer rule and maintaining SQLite integrity.

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

## Scenario 1: Priya confirms a period on the predicted date (Online) (done)

**Pre-condition:**

- Model predicted June 15 (Start).
- System displayed Light Pink (`p`) block for June 15–19 (Avg length = 5).
- SQLite contains the predicted block (stored in `predicted_cycles` table).

**Action:**

- It is June 16. Priya opens the app, sees the Sticky Card, and taps "Yes, started on June 15."

**System Behavior (Step-by-Step):**

- **Optimistic UI:** The UI immediately turns the Light Pink block (June 15–19) into Dark Pink (`P`). React Query updates its in-memory cache.
- **API Call:** The mutation fires `POST /cycle/corrections` with `prediction_id` and `period_start_date`.
- **Server Response:** Server confirms the prediction, sets `prediction_error_days = 0`, and returns the definitive `cycle_entry`.
- **SQLite Write:** The `onSuccess` handler triggers `localDb.cycle.upsert(server_data)`. The Dark Pink block is now permanently stored in SQLite (`cycle_entries` table).
- **Sync Queue:** Since the operation succeeded online, no entry is left in EncryptedStorage (offline queue).
- **React Query Invalidation:** `queryClient.invalidateQueries()` runs. The UI re-reads from SQLite (which now contains the confirmed period).
- **Countdown:** The "Next period in X days" recalculates to July 18 (28 days later).

**Checkpoints:**
- ✅ UI updates < 100ms.
- ✅ SQLite `cycle_entries` has a record for June 15–19 (Dark Pink).
- ✅ `prediction_error_days` logged as 0.
- ✅ EncryptedStorage (offline queue) is empty for this operation.
- ✅ Sticky Card disappears.

---

## Scenario 2: Priya logs a period manually (Ignores Sticky Card, Day 2 of bleeding)

**Pre-condition:**

- System predicted June 15 (Light Pink).
- It is June 17 (State B: Active / Within Average).

**Action:**

- Priya ignores the Sticky Card. Opens `LogPeriodScreen`.
- Selects Start Date: June 15. Leaves End Date empty.

**System Behavior:**

- **UI:** The system auto-fills `period_end_date = June 19` (using her 5-day average).
- **API Call:** Fires `POST /cycle/entries` with start: June 15, end: June 19.
- **Auto-Link (Backend):** Since start is within ±5 days of the prediction, the backend sets `corrected_prediction_id` automatically (silent correction).
- **Server Returns:** The server returns the definitive entry with `prediction_error_days = 0`.
- **SQLite Write:** `localDb.cycle.upsert(server_data)` is called.
- **React Query:** In-memory cache invalidated; UI re-renders with Dark Pink (`P`) for June 15–19.

**Checkpoints:**
- ✅ Auto-linking triggers silently.
- ✅ Average Period Length remains stable (no manual override).
- ✅ SQLite stores the `cycle_entry` with `is_correction = false`.

---

## Scenario 2B: Priya overrides the End Date (Correcting the Average)

**Pre-condition:**

- Dark Pink block set for June 15–19 (5 days average).
- Reality: She bleeds for 7 days (June 15–June 21).
- It is June 22 (State C: Exceeded Average).

**Action:**

- Opens `LogPeriodScreen`.
- Enters Start: June 15. The "End Date" field is mandatory (red asterisk). Enters End: June 21.

**System Behavior:**

- **UI:** Form validates and submits.
- **API Call:** `PUT /cycle/entries/{id}` with `period_end_date = 2025-06-21`.
- **SQLite Write:** `localDb.cycle.upsert(server_data)` overrides the existing record.
- **Average Recalculation:** The server updates `avg_period_length = (5*5 + 7) / 6 = 5.33` and returns this in the response.
- **Local Sync:** `syncEngine` updates the local `avg_period_length` in the `users` table in SQLite.

**Checkpoints:**
- ✅ UI shows Dark Pink extending to June 21.
- ✅ SQLite `period_end_date` is stored as `2025-06-21`.
- ✅ `avg_period_length` in SQLite is updated to 5.33.

---

## Scenario 2C: Priya forgot to log her period entirely (1 week later)

**Pre-condition:**

- Period ended June 21. It is June 28 (State C: Long Past Average).

**Action:**

- Opens `LogPeriodScreen`.
- Enters Start: June 15. System forces End Date (mandatory). Enters End: June 21.

**System Behavior:**

- **SQLite:** The app checks local SQLite for any existing entry. Finds none.
- **API Call:** `POST /cycle/entries`.
- **Server Linking:** Server detects that June 15 is within ±5 days of the predicted block (even though it's past the window). It links to the old prediction.
- **SQLite Write:** Upserted with the corrected date range.
- **Prediction Error:** The server calculates `prediction_error_days` based on the Start Date. (If predicted was June 15, error = 0).

**Checkpoints:**
- ✅ System accepts the historical log.
- ✅ SQLite stores the past period accurately.
- ✅ `avg_cycle_length` recalculated based on the gap.

---

## Scenario 3: Ananya corrects a date (Late by 4 days) via Sticky Card

**Pre-condition:**

- Prediction: June 10. Reality: June 14.
- It is June 16 (State C: Exceeded Average, End Date mandatory but not needed here since she is correcting the start).

**Action:**

- Taps Sticky Card → "No, adjust date" → Selects June 14.

**System Behavior:**

- **Optimistic UI:** Old block (June 10–14) turns Greyed out (`c`). New block (June 14–18) turns Dark Pink (`P`).
- **Offline Queue:** If offline, the mutation fails and writes to EncryptedStorage (type: `cycle/correction`).
- **Sync:** When online, `syncEngine` sends to server.
- **Server Response:** `prediction_error_days = +4`. `avg_prediction_error_days` shifts.
- **SQLite Overwrite:** `localDb.cycle.upsert(server_data)` stores the corrected June 14 block and updates the `avg_error`.

**Checkpoints:**
- ✅ Calendar shows June 10–13 as `c` (grey) and June 14–18 as `P`.
- ✅ SQLite stores the `prediction_error_days = 4`.
- ✅ `avg_prediction_error_days` updates to +4.

---

## Scenario 4: Sneha uses "Snooze" repeatedly

**Pre-condition:**

- Prediction: June 10.

**Action:**

- June 10: Taps "Not Yet" (`day_offset = 0`).
- June 11: Taps "Not Yet" (`day_offset = 1`).
- June 12: Logs period (June 12).

**System Behavior:**

- **SQLite Snooze Logging:** Each "Not Yet" tap calls `POST /cycle/snooze`.
- **SQLite Write:** `localDb.snooze.upsert()` writes `{ predicted_cycle_id, day_offset: 0 }` and `{ day_offset: 1 }` to SQLite.
- **Sticky Card Logic:** The UI checks the `snooze_events` table. If a `day_offset` exists for today, the Sticky Card hides for 24 hours.
- **Confirmation:** When she finally logs June 12, `prediction_error_days = +2` is calculated.

**Checkpoints:**
- ✅ SQLite `snooze_events` contains both entries.
- ✅ Sticky Card disappears and reappears daily.

---

## Scenario 5: Ananya logs a period entirely offline (Airplane Mode)

**Pre-condition:**

- No network.
- SQLite has no entry for this period yet.

**Action:**

- Opens `LogPeriodScreen`. Logs Start: June 20.

**System Behavior:**

- **Optimistic UI:** Calendar instantly shows Dark Pink. React Query cache updated optimistically.
- **Mutation Failure:** Network error occurs.
- **Offline Queue:** `offlineStore.enqueue()` writes the operation to EncryptedStorage (with `temp_id`).
- **SQLite (Read):** The `queryFn` for the calendar does not read this un-synced operation yet (because SQLite is a server-cache). However, React Query holds it in memory.
- **App Restart:** React Query cache resets (in-memory). The UI will not show the pending period until the user syncs. However, the EncryptedStorage queue still holds the operation.
- **Reconnect:** `syncEngine` pushes the queue. Server returns 200. **SQLite Hydration:** `localDb.cycle.upsert(server_data)` writes it permanently.

**Checkpoints:**
- ✅ EncryptedStorage queue has a pending operation.
- ✅ SQLite is not updated yet (preventing "ghost" data).
- ✅ On sync, SQLite is correctly hydrated.

---

## Scenario 6: Offline logs + online log before sync (FIFO Order)

**Pre-condition:**

- Day 1 (Offline): Logs Period A (June 20).
- Day 3 (Online at cafe): Logs Period B (July 18) before the phone syncs Period A.

**System Behavior:**

- **Queue Ordering:** EncryptedStorage holds `[A, B]`.
- **Sync Engine (FIFO):** `syncEngine` grabs A first, sends to server. Server accepts.
- **Success:** `offlineStore.remove(A)`. SQLite gets A.
- **Next Item:** Sync engine processes B (which was created online). Sends B to server.

**Checkpoints:**
- ✅ Server receives Period A before Period B.
- ✅ SQLite stores both Period A and Period B.
- ✅ No timestamp/order conflict.

---

## Scenario 7: Multi-Device War (Conflict on SAME period)

**Pre-condition:**

- Device A (Offline): Corrects period to June 12 (9:00 AM client timestamp).
- Device B (Web): Corrects period to June 14 (10:00 AM server timestamp).

**Action:**

- Device A reconnects to Wi-Fi.

**System Behavior:**

- **Push:** Device A sends its June 12 correction with `X-Client-Updated-At: 9:00 AM`.
- **Server Check:** Server sees its own `updated_at` is 10:00 AM (newer).
- **Conflict (409):** Server returns 409 with `server_data` (June 14).
- **SQLite Overwrite:** `syncEngine` calls `localDb.cycle.upsert(server_data)`.
- **React Query Invalidation:** UI re-reads SQLite, shows June 14. A toast appears: "Updated from another device."

**Checkpoints:**
- ✅ SQLite overwritten with June 14.
- ✅ Offline queue discards the June 12 entry.

---

## Scenario 8: Multi-Device (DIFFERENT periods, No conflict)

**Action:**

- Device A corrects Period A (June 10).
- Device B corrects Period B (July 15).

**System Behavior:**

- Both sync to server.
- Server processes both without conflict (different primary keys).
- SQLite gets updated for both entries.

**Checkpoints:**
- ✅ No 409 conflict.
- ✅ SQLite holds both corrections.

---

## Scenario 9: Maya (Perimenopausal) has a 60-day gap

**Action:**

- Logs Jan 1.
- Logs March 2 (60-day gap).

**System Behavior:**

- **SQLite Storage:** Stores the 60-day gap in `cycle_entries` (`cycle_length = 60`).
- **Std Deviation:** `cycle_length_std_dev` jumps > 10.
- **UI Shift:** The model confidence drops below 30%. The dashboard switches from "single date" to a Prediction Window (e.g., "Your period may start between March 28 and April 5").
- **Fallback Logic:** The ML falls back to Median (ignoring the 60-day outlier if >45).

**Checkpoints:**
- ✅ SQLite contains the historical extreme data.
- ✅ UI renders a Prediction Window.

---

## Scenario 10: Rita (Postpartum) has NO periods

**Action:**

- Opens the app. Has never logged a period.

**System Behavior:**

- **SQLite Read:** `localDb.cycle.getHistory()` returns `[]` for her `user_id`.
- **React Query:** Since data is `[]`, the UI renders the Empty State.
- **Predictions Endpoint:** `GET /cycle/predictions` returns `null`.
- **UI:** `CyclePredictionsScreen` shows the "Your cycle story begins here" illustration. No countdown card.

**Checkpoints:**
- ✅ App does not crash.
- ✅ Empty state renders beautifully.
