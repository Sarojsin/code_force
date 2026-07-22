# System Tests 1 — SheCare

> **Scope:** Backfill flow, 3-state buffer logic, missed-cycle detection, and dashboard recovery.
> **Goal:** Validate period confirmation, manual logging, end-date rules, early/late logging, and forgotten-period recovery.
> **Pass Criteria:** All backfill scenarios must respect the 3-state buffer rule and maintain data integrity.

---

## Scenario 5 (Revised): The "Backfill" Flow — Solving the Missing Cycle Problem

### Core Concept: The "Sticky Backfill" Cards

**The Problem:** If a user forgets to log a period for 3+ months, the system loses its "Last 3 Cycles" data required for the ML fallback chain (Median/Heuristic).

**The Solution:** The system detects missing periods and persistently displays 3 Sticky Backfill Cards on the Dashboard until the user fills them in. These cards are distinct from the regular Sticky Card (which is for current period confirmation). They are designed to help the user backfill history.

**The Rule:** The app always needs the last 3 logged period start dates to run the prediction engine. If the gap between the last logged period and today exceeds 90 days (or the user has missed more than 3 cycles), the system assumes data is stale and forces a backfill.

---

### Detailed Flow: Scenario 5 (Complete Backfill)

#### Pre-condition (The Gap)

- **Last Logged Period:** May 10–14, 2025.
- **Today:** August 20, 2025 (102 days since the start of her last period).
- **Missing Periods:** She missed June (June 11–15) and July (July 13–17).
- **System State:** SQLite only has the May 10 record. `avg_cycle_length` is 28 days (from previous logs).

---

#### Step 1: System Detects the Gap (App Launch)

**User Action:** Opens the app on August 20.

**System Check:** `Today - Last_Period_Start > 90 Days`.

**Decision:** The system marks the user as "Out of Sync."

**UI Action:** The Dashboard displays 3 Backfill Cards at the top (below the Hero Profile Card, above the "Next Period" stat card).

**Card Text:** "We noticed you haven't logged a period in a while. Help us get back on track."

---

#### Step 2: The 3 Backfill Cards (UI Layout)

The cards appear in reverse chronological order (newest first).

| Card | Title | Fields | Behavior |
|------|-------|--------|----------|
| **Card 1** (Most Recent) | "Did you have a period in August?" | Start Date [Picker], End Date [Picker] | Mandatory. Must be filled before Card 2 becomes active. |
| **Card 2** | "Did you have a period in July?" | Start Date [Picker], End Date [Picker] | Disabled until Card 1 is filled. |
| **Card 3** | "Did you have a period in June?" | Start Date [Picker], End Date [Picker] | Disabled until Card 2 is filled. |

> **Note:** If she had periods in all 3 months, she fills all 3. If she had no period at all (e.g., postpartum), there is a small "Skip / No period" toggle on each card.

---

#### Step 3: User Fills the Cards

**Action 3A: She logs August (Most Recent)**

- **Date Picker:** Selects Start: Aug 14, End: Aug 18 (5 days).
- **System Validate:** Aug 14 is within the last 30 days → Valid.
- **SQLite Write:** `localDb.cycle.upsert({ period_start: '2025-08-14', period_end: '2025-08-18' })`.
- **UI:** Card 1 disappears. Card 2 becomes active.

**Action 3B: She logs July**

- **Date Picker:** Selects Start: Jul 13, End: Jul 17 (5 days).
- **System Validate:** Jul 13 is before Aug 14 → Valid.
- **SQLite Write:** `localDb.cycle.upsert({ period_start: '2025-07-13', period_end: '2025-07-17' })`.
- **UI:** Card 2 disappears. Card 3 becomes active.

**Action 3C: She logs June**

- **Date Picker:** Selects Start: Jun 11, End: Jun 15 (5 days).
- **System Validate:** Jun 11 is before Jul 13 → Valid.
- **SQLite Write:** `localDb.cycle.upsert({ period_start: '2025-06-11', period_end: '2025-06-15' })`.
- **UI:** Card 3 disappears.

---

#### Step 4: System Recalculates (The "Backfill" Resolution)

**New Data Set (Last 3 Cycles):**

- Jun 11 – 15 (Length: 5 days)
- Jul 13 – 17 (Cycle Length: 32 days from Jun 11 to Jul 13)
- Aug 14 – 18 (Cycle Length: 32 days from Jul 13 to Aug 14)

**New Average Cycle Length:** `(28 + 32 + 32) / 3 = 30.6` days.

**Last Period Start:** Aug 14.

**New Prediction:** Aug 14 + 30.6 days = Sep 13 (Displayed as a Light Pink block).

**Confidence Restoration:** Since she now has 3 recent cycles, confidence moves from 0.20 (Heuristic) back to 0.40+ (Median).

---

#### Step 5: UI Updates (Final State)

- **Dashboard:** The Backfill Cards disappear. The normal "Next period in X days" stat card reappears (e.g., "Next period in 24 days").
- **Calendar:** Dark Pink for Jun, Jul, Aug. Light Pink for Sep 13–17.
- **ML Pipeline:** The CyclePredictor now has valid data to run the fallback chain.

---

### Behavior Table: When do Backfill Cards Appear?

| Condition | System Action |
|-----------|---------------|
| Gap < 60 days (e.g., missed 1 cycle) | Do NOT show Backfill cards. The user can log the single missing period normally via the LogPeriodScreen. The system auto-adjusts the average. |
| Gap >= 60 days (missed 2 cycles) | Show 2 Backfill Cards (for the most recent 2 missing cycles). |
| Gap >= 90 days (missed 3+ cycles) | Show 3 Backfill Cards (for the most recent 3 missing cycles). |
| User logs 1 period but skips the others | The cards adjust dynamically. If she fills August but skips July, the card for July will remain but be marked "Optional". However, if July is missing, the ML model will use only 2 cycles, which lowers confidence. |
| No period for 6 months (postpartum / medical) | Backfill cards appear with a "No period (Breastfeeding/Medical)" toggle. If she toggles "No period", the system logs a special `cycle_type = 'anovulatory'` and does not predict the next period until she logs a real one. |

---

### Updated Checkpoints for Scenario 5 (Backfill Version)

| # | Checkpoint | Expected |
|---|------------|----------|
| 1 | User opens app after 102-day gap | 3 Backfill Cards appear on Dashboard. |
| 2 | User fills August card | Card 1 disappears; Card 2 becomes active. SQLite has Aug 14–18. |
| 3 | User fills July card | Card 2 disappears; Card 3 becomes active. SQLite has Jul 13–17. |
| 4 | User fills June card | Card 3 disappears. All 3 cards gone. |
| 5 | ML Recalculation | New average = 30.6 days. New prediction date = Sep 13. |
| 6 | Confidence Score | Confidence increases from 0.20 to 0.40+. |
| 7 | UI | Dashboard shows "Next period in 24 days" stat card. Calendar has Dark Pink for past months. |

---

## The Definitive "Backfill Cards" Logic

### Core Rule

The system calculates the number of missed cycles since the last logged period.

```
Missed Cycles Count = floor( (Days_Since_Last_Logged_Start) / (User_Avg_Cycle_Length OR 28) ) - 1
```

- **Display Cap:** Maximum of 3 cards (the most recent 3 missing cycles).
- **Sliding Window:** If she missed 4 cycles, the oldest card disappears, and only the most recent 3 remain visible.

---

### The Clear Table

| Days Since Last Logged Period | Estimated Missed Cycles (using Avg Length ~28–30 days) | Cards Displayed | What the User Must Do |
|-------------------------------|--------------------------------------------------------|-----------------|----------------------|
| < 28 days | 0 | 0 cards | Log normally via LogPeriodScreen (or Sticky Card). No backfill needed. |
| 28 – 55 days | 1 | 1 card | Fill the most recent missing cycle. |
| 56 – 85 days | 2 | 2 cards | Fill the most recent 2 missing cycles. |
| 86 – 115 days | 3 | 3 cards | Fill the most recent 3 missing cycles. |
| 116 – 145 days | 4 | 3 cards (Months 4, 5, 6) | Sliding (Oldest dropped) |
| 146+ days | 5+ | 3 cards (Most Recent) | Sliding (Always recent 3) |

---

### Example of the Sliding Window (The "4th Cycle Disappears")

**Scenario:** User's last logged period was January 1. Today is July 1.

**Missed Cycles:**

- Feb 1 (Missed #1)
- Mar 1 (Missed #2)
- Apr 1 (Missed #3)
- May 1 (Missed #4)
- Jun 1 (Missed #5)

**System Behavior:**

The user sees 3 cards:

- **Card 1:** "Did you have a period in June?" (Most Recent)
- **Card 2:** "Did you have a period in May?"
- **Card 3:** "Did you have a period in April?"

The February and March cards are GONE. The system assumes she either had no period or she will backfill them later, but they are not required for the ML model to function (the model only needs the last 3).

**User Fills June (Card 1):**

- Card 1 disappears.
- New Card Appears: Since she still missed May, April, and March, the system now slides the window: Card 2 (May), Card 3 (April), and Card 4 (March reappears).

> **Wait, crucial nuance:** We need to decide if the window slides downward.

**Design Decision:** The system shows the most recent 3 missing periods. If she fills June, the most recent 3 missing are now May, April, March. So March should reappear.

**Why this is great UX:** She doesn't have to search for old dates. The app guides her chronologically backward until the last 3 are filled.

---

### Special Case: "No Period" (Postpartum / Medical)

| Condition | Cards Displayed | User Action Required |
|-----------|-----------------|----------------------|
| > 180 days gap (e.g., postpartum) | 3 cards + a "No period (Breastfeeding/Medical)" toggle at the bottom | She can either fill the last 3 cycles, or tap "No period" to clear the cards and stop predictions until she logs a real period. |

---

## Summary Cheat Sheet (Final)

| Gap (Days) | Missed Cycles | Cards Shown | Window Type |
|------------|---------------|-------------|-------------|
| 0–27 | 0 | 0 | N/A |
| 28–55 | 1 | 1 | Static |
| 56–85 | 2 | 2 | Static |
| 86–115 | 3 | 3 | Static |
| 116–145 | 4 | 3 (Months 4, 5, 6) | Sliding (Oldest dropped) |
| 146+ | 5+ | 3 (Most Recent) | Sliding (Always recent 3) |

---

## Implementation Logic for Devs

```typescript
function getBackfillCards(lastLoggedStart: Date, avgCycleLength: number): number {
  const today = new Date();
  const daysSinceLast = daysBetween(lastLoggedStart, today);
  const missedCycles = Math.floor(daysSinceLast / avgCycleLength) - 1;

  // If she has logged in the last month, show 0.
  if (missedCycles <= 0) return 0;

  // Cap at 3 cards.
  return Math.min(missedCycles, 3);
}
```

This ensures the ML model always has the last 3 cycles to calculate a reasonable median/fallback prediction, and the user never feels overwhelmed by a 5-year backlog of periods. 🌸🚀

---

## The Check: Missed Cycles Calculation

The system calculates the number of cycles you have missed since your last log:

```
Days Since Last Log = Today - Last_Period_Start
Estimated Missed Cycles = floor(Days Since Last Log / Avg_Cycle_Length) - 1
```

**The Rule:** If `Estimated Missed Cycles <= 0`, the Catch-up Card does not appear.

---

### Timeline Example (Regular Logger)

| Date | Action | Last Period Start | Days Since | Avg Length | Missed Cycles Calculation | Catch-up Card Appears? |
|------|--------|-------------------|------------|------------|---------------------------|------------------------|
| July 15 | Logs period start | July 15 | 0 | 30 | `floor(0/30) - 1 = -1` | ❌ No |
| August 12 | Logs period start (28 days later) | August 12 | 28 | 30 | `floor(28/30) - 1 = 0` | ❌ No |
| September 10 | Logs period start (29 days later) | Sept 10 | 29 | 30 | `floor(29/30) - 1 = 0` | ❌ No |
| October 8 | Logs period start (28 days later) | Oct 8 | 28 | 30 | `floor(28/30) - 1 = 0` | ❌ No |

**Result:** Because she logs before or on the day her average cycle length would end, the `floor(days / avg)` always equals exactly 1 (or less). Subtract 1, and you get 0. The card never appears.

---

### Timeline Example (Misses One Cycle)

| Date | Action | Last Period Start | Days Since | Avg Length | Missed Cycles Calculation | Catch-up Card Appears? |
|------|--------|-------------------|------------|------------|---------------------------|------------------------|
| July 15 | Logs period start | July 15 | 0 | 30 | -1 | ❌ No |
| September 1 | (No log in August) Opens app | July 15 | 48 | 30 | `floor(48/30) - 1 = 1 - 1 = 0` | ❌ Still No (Just barely missed it, we wait) |
| September 15 | Opens app (60 days since last log) | July 15 | 62 | 30 | `floor(62/30) - 1 = 2 - 1 = 1` | ✅ Yes (1 Card appears for the missed August cycle) |

**Result:** Once the gap exceeds `Avg_Cycle_Length + (Avg_Cycle_Length / 2)` (roughly 45 days), the floor value hits 2, and `2 - 1 = 1`. The system detects a missed cycle.

---

## The Reset Logic

**Crucially:** The moment she logs a period (even if it's late), the `Last_Period_Start` resets to the new date.

**Scenario:** She missed August, but logs September 15.

- **Before Logging:** Days Since = 62 → 1 Card appears.
- **After Logging:** `Last_Period_Start = September 15`.
- **New Calculation:** Days Since = 0 → Missed Cycles = -1 → Cards disappear immediately.

---

## Summary (The "Check")

| Condition | Catch-up Card Status |
|-----------|----------------------|
| User logs at least once every ~28–35 days | `floor(Days / Avg) - 1 = 0` → No cards |
| User misses 1 full cycle (~60 days gap) | `floor(Days / Avg) - 1 = 1` → 1 card appears |
| User misses 2 full cycles (~90 days gap) | `floor(Days / Avg) - 1 = 2` → 2 cards appear |
| User misses 3+ full cycles | `floor(Days / Avg) - 1 ≥ 3` → 3 cards appear (sliding window) |

---

## Database Responsibilities & Data Flow

### 1. The Source of Truth for the UI (Local SQLite)

The Mobile App (Local SQLite) is the active engine that decides whether to show the cards. It does not ask the server, "Should I show a Catch-up card?" It computes this entirely locally.

**Read Path (App startup / Screen Focus):**

- `queryFn` queries SQLite:
  - `SELECT period_start_date FROM cycle_entries WHERE user_id = X ORDER BY period_start_date DESC LIMIT 1` (Gets the last logged start date).
  - `SELECT avg_cycle_length FROM user_metrics WHERE user_id = X` (Gets the average).
- Calculates `Days_Since_Last_Log` and `Missed_Cycles`.
- Renders 0, 1, 2, or 3 Catch-up Cards.

**Write Path (User fills a Catch-up Card):**

- User enters `start_date` and `end_date` for a past month.
- **Optimistic Update:** The app immediately saves the period to SQLite (local cache).
- **Crucial Step:** The app then immediately recalculates `Days_Since_Last_Log`. If the gap is now closed (e.g., `Missed_Cycles` drops from 3 to 2), the corresponding card disappears instantly—without waiting for the server.
- **Background Sync:** The app enqueues the operation in EncryptedStorage and tries to POST to the server.

---

### 2. The Source of Truth for Multi-Device (Server PostgreSQL)

The Server (PostgreSQL) acts as the authoritative backup. It ensures that if the user logs a period on the Web App or another phone, the mobile app eventually gets the correct data.

**Write Path (Sync Engine):**

- When the mobile app comes online, `syncEngine` pushes the queued historical periods to `POST /sync/batch`.
- Server validates the dates and stores them in `cycle_entries` (PostgreSQL).

**Read Path (Pull Mechanism):**

- The mobile app periodically calls `GET /sync/changes?since=....`
- The server returns any new `cycle_entries` that were created on other devices.
- **Local Update:** The app upserts these records into Local SQLite.

**Conflict Resolution (The "Server Wins" Rule):**

- **Scenario:** Device A (offline) logs a period starting Aug 15. Device B (online) logs a period starting Aug 10.
- When Device A syncs, the server detects a conflict (the `updated_at` timestamp on Device B's entry is newer).
- The server returns a `409 Conflict` with `server_data` (Aug 10).
- **SQLite Overwrite:** The local SQLite record is overwritten with the server's Aug 10 date.
- **UI Recalculation:** Since the `last_period_start` in SQLite is now Aug 10, the `Days_Since_Last_Log` decreases. The Catch-up Cards automatically adjust (or disappear) on the next render.

---

### 3. How the "Check-in" Card Uses the Databases

| Action | Local SQLite | Server PostgreSQL |
|--------|--------------|-------------------|
| Show "Check-in" Card | Reads `predicted_cycles` table to check `predicted_start_date` and P-3 window. | Not used for visibility (computed locally). |
| User taps "Yes" | Immediately writes confirmation to SQLite (`cycle_entries`). | Receives `POST /corrections`. Stores the definitive period. |
| Sync (Multi-device) | Gets overwritten by server data if a newer entry exists on PostgreSQL. | Returns 409 conflict if another device edited it first. |

---

### 4. The "Missing Link" (Where the Avg Cycle Length comes from)

- **SQLite:** The `avg_cycle_length` is stored locally in the `users` or `user_metrics` table.
- **PostgreSQL:** Computes this average on the server side whenever a new period is logged.
- **Sync:** When the mobile app syncs, it receives the updated `avg_cycle_length` from the server and upserts it into SQLite.

---

### 5. Summary Table (Database Responsibilities)

| Feature | Local SQLite (Mobile) | Server PostgreSQL (Backend) |
|---------|-----------------------|----------------------------|
| Decides to show Catch-up Card | ✅ YES (Calculates missed cycles locally). | ❌ NO (Passively stores data). |
| Stores historical periods | ✅ YES (Permanent cache). | ✅ YES (Authoritative source). |
| Handles multi-device conflicts | ❌ NO (Gets overwritten by server). | ✅ YES (Compares timestamps, returns 409). |
| Provides `avg_cycle_length` | ✅ Reads locally (synced from server). | ✅ Computes definitively. |
| Triggers immediate UI update | ✅ YES (Optimistic update on local SQLite). | ❌ NO (Requires network round-trip). |

---

## Final Guarantee

- If the user logs every month: Local SQLite will always have a `last_period_start` within < 35 days. `Missed_Cycles = 0`. The Catch-up Card will never appear, even if the phone is in Airplane mode.
- If she misses 2 cycles (offline): Local SQLite shows a gap of ~60 days. The app calculates `Missed_Cycles = 2` locally and shows 2 cards immediately—no server API call required.
- When she finally syncs: The server might have newer data. If the server has a period she forgot about, SQLite gets overwritten, and the cards recalculate based on the new truth.

This ensures the system is instant, private, and resilient, relying on local computation for UX and server sync for consistency. 🌸📊

---

## Minor Clarification: "No Period" Toggle for Postpartum (Non-Blocking)

The spec on line 119 says: *"If she toggles 'No period', the system logs a special `cycle_type = 'anovulatory'`"*.

### Clarification: Where `cycle_type` lives & how predictions behave

| Question | Answer |
|----------|--------|
| **Where is `cycle_type` stored?** | Both places: **SQLite locally** (for instant UI feedback) **and synced to PostgreSQL** (so other devices know she's in an anovulatory state). On the mobile side, the field lives in the `cycle_entries` table alongside `period_start_date` / `period_end_date`. |
| **Does the system suspend predictions or just lower confidence?** | **Suspend all predictions.** When the *last* logged period has `cycle_type = 'anovulatory'`, the prediction engine must not generate a new prediction. The UI shows: *"No active prediction. We'll start predicting again when you log your next period."* Lowering confidence to `0.0` but still showing a date is misleading — the user is not cycling, so no date should appear. |
| **When do predictions resume?** | As soon as the user logs a period with `cycle_type = 'menstrual'` (the default, or explicitly selected). That entry becomes the new `last_period_start`, and the prediction engine recalculates normally. |

### Recommended implementation notes

1. **Backend:** Add `cycle_type: str` (default `"menstrual"`, can be `"anovulatory"`) to `CycleEntryCreate`, `CycleEntryResponse`, and the `CycleEntry` model. Add a CHECK constraint: `IN ('menstrual', 'anovulatory')`.
2. **Prediction engine (`compute_predictions`):** Before generating a new prediction, query the most recent entry. If `cycle_type == 'anovulatory'`, return `None` (no prediction).
3. **Mobile:** The backfill card's "No period" toggle sets `cycle_type = 'anovulatory'` with `period_start_date` and `period_end_date` as the expected window for that missed month (e.g., the card's projected dates). This preserves the cycle log for reference while signalling the engine to pause.
4. **Calendar behaviour:** Anovulatory entries still render as Dark Pink on the calendar — the user did have "a period experience" (bleeding / spotting), even if it was anovulatory. The Light Pink prediction block simply does not appear for the next cycle.