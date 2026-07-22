## Section 4: The "Multi-Device War" (Conflict Resolution)

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

### Scenario 8: Sneha edits DIFFERENT periods on two devices (No conflict)

**Action:** Phone corrects Period A (June 10). Web corrects Period B (July 15).

**Expected System Behavior:**

- Both sync independently. SQLite gets both updates.

**Checkpoints:**
- ✅ No false conflicts.

---

## Section 5: The "Irregular & Outlier" Edge Cases

### Scenario 9: Maya (Perimenopausal) has a 60-day gap

**Action:** Logs Jan 1, then March 2 (60 days).

**Expected System Behavior:**

- **SQLite:** Stores the 60-day gap in `cycle_entries`.
- **UI:** Prediction window appears (confidence drops). SQLite stores the `std_dev` and `avg_error` recalculated by the backend.

**Checkpoints:**
- ✅ SQLite holds the historical extreme data.
- ✅ Prediction window displayed.

---

### Scenario 10: Rita (Postpartum) has NO periods

**Action:** Opens app. No cycle data.

**Expected System Behavior:**

- **SQLite:** Returns `[]` for `user_id`.
- **UI:** Shows empty state.

**Checkpoints:**
- ✅ App doesn't crash.
- ✅ Empty state renders beautifully.

---

### Scenario 11: User logs a period in the FUTURE

**Action:** Today is July 20. User logs start date July 25.

**Expected System Behavior:**

- **SQLite:** Stores the future date.
- **UI:** Renders in Light Pink (predicted).

**Checkpoints:**
- ✅ Future dates are not treated as "Confirmed Reality."

---

### Scenario 12: User tries to mark End Date BEFORE Start Date

**Action:** Start June 10. Tries to end June 8.

**Expected System Behavior:**

- **UI Validation:** Rejects with error.
- **SQLite:** No invalid data written.

**Checkpoints:**
- ✅ Validation catches the logical error.

---