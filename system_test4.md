# System Tests 4 — SheCare

> **Scope:** Calendar 4-phase color rollover, BS calendar switch, and display-layer independence.
> **Goal:** Validate that period start date corrections shift the entire cycle map correctly, and that BS/AD calendar switching is purely a UI transformation without affecting storage or sync.
> **Pass Criteria:** Calendar must be visually and mathematically sound across corrections and calendar system toggles.

---

## Scenario 13: Calendar 4-Phase Color Rollover — Detailed Explanation

This is the most visually critical test for the offline-first AI. It validates that when a user corrects a period start date, the entire 4-phase cycle map (Menstrual, Follicular, Ovulation, Luteal) shifts in real-time, updating the colors appropriately on the calendar.

---

### 1. Pre-Condition (The "Before" State)

- **AI Prediction:** The system predicted the user's next period would start on June 1.
- **Calendar Rendering (Before Correction):**
  - The calendar shows a Light Pink (`p`) block for June 1 – June 5 (based on her average period length of 5 days).
  - The fertile window and ovulation days are also rendered in Light Purple (`f`) and Light Green (`o`) for this predicted cycle.
- **Local SQLite (Before):**
  - The `predicted_cycles` table contains a record: `{ predicted_next_period_start: '2025-06-01', is_active: true }`.
  - The `cycle_entries` table does not have a record for this period yet (it's only a prediction).

---

### 2. User Action (The Correction)

**Action:** The user gets her period on June 5 (4 days late).

**Trigger:** She taps the Sticky Card → "No, adjust date" → selects June 5.

**Optimistic UI (Immediate, < 100ms):**

| Date Range | Before (Predicted) | After (Optimistic Correction) | Color Logic |
|------------|---------------------|-------------------------------|-------------|
| June 1 – 4 | Light Pink (`p`) | Greyed Out (`c`) | The system marks the old predicted days as "Cancelled." |
| June 5 – 9 | Normal (unmarked) | Dark Pink (`P`) | The system shifts the 5-day period block to start on June 5. |

---

### 3. The Phase Recalculation (The Math)

Simultaneously, the app runs the `calculateCyclePhases()` function locally (no server needed for this UI update).

**Inputs:** New Period Start = June 5, Cycle Length = 28 days (from her average), Period Length = 5 days.

**Formula:**

- **Ovulation Date:** `June 5 + (28 - 14) = June 19`
- **Fertile Window:** `June 19 - 5` to `June 19 + 1` = `June 14 – 20`
- **Luteal Phase:** `June 20` to `June 28` (day before the next predicted period)

**UI Update (The "Dark" vs "Light" Rule):**

Because the start date is now confirmed (the user physically selected it), the system marks these phases as **DARK COLORS**:

| Phase | Date Range | Color Code (Before) | Color Code (After Correction) |
|-------|------------|---------------------|-------------------------------|
| Menstrual | June 5 – 9 | `p` (Light Pink) | `P` (Dark Pink) |
| Fertile Window | June 14 – 20 | `f` (Light Purple) | `F` (Dark Purple) |
| Ovulation | June 19 | `o` (Light Green) | `O` (Dark Green) |
| Luteal | June 20 – 28 | `l` (Light Blue) | `L` (Dark Blue) |

---

### 4. The "Rollover" Effect (The Next Cycle)

Since the current cycle is now "Confirmed" (Dark colors), the AI automatically generates the next predicted cycle.

- **Next Period Start:** `June 5 + 28 days = July 3`
- **Next Phases:** Calculated using the same formula, but marked as **LIGHT COLORS** (`p`, `f`, `o`, `l`) because they are still predictions.

**Result:** The July 3 – July 7 block appears as Light Pink (`p`).

---

### 5. SQLite & Backend Processing (The Permanent State)

#### Step A: Local SQLite Write

The optimistic UI is now backed by a local database write.

`localDb.cycle.upsert()` is called with the new data:

```typescript
{
  period_start_date: '2025-06-05',
  period_end_date: '2025-06-09',
  is_correction: true,
  corrected_prediction_id: 'pred-123' // links to the old prediction
}
```

**Crucially:** The `calculate_cycle_phases` logic is not stored directly as phases in SQLite. Instead, SQLite stores the `period_start_date`. The app recalculates the phases on-the-fly every time the calendar renders (using `period_start_date + cycle_length`). This ensures the phases always reflect the latest start date without storing redundant phase data.

---

#### Step B: Prediction Archiving (The "Correction" Link)

The old `predicted_cycles` record (for June 1) is updated:

- `is_active = false` (archived).
- `actual_cycle_entry_id = <new_entry_id>` (links to the new confirmation).
- `prediction_error_days = +4` (she was 4 days late).

---

#### Step C: Server Sync (Background)

The mutation fires `POST /cycle/corrections` to the server.

- On success, the server updates the authoritative PostgreSQL database.
- The local SQLite is already updated, so the user sees the change instantly. If offline, the operation is queued in EncryptedStorage and synced later.

---

### 6. Checkpoints Verification (Detailed)

| Checkpoint | Verification Method | Why It Matters |
|------------|---------------------|----------------|
| ✅ SQLite data drives phase calculation. | Open the app offline, correct the date, force-quit, reopen. The calendar still shows the corrected phases (Dark Pink for June 5, not the old Light Pink). | Proves that the UI is not relying on a volatile in-memory cache. The correction is permanently stored in SQLite. |
| ✅ Dark colors for this cycle. | Verify that June 5–9 is Dark Pink (`P`), June 14–20 is Dark Purple (`F`), etc. | Confirms the "Confirmed vs Predicted" visual distinction is applied correctly. |
| ✅ Light colors for the next cycle. | Verify that July 3–7 is Light Pink (`p`), and the corresponding future phases are Light Purple (`f`), etc. | Confirms the "Rollover" mechanism works—the AI projects the next cycle in Light colors. |
| ✅ Cancelled dates are distinct. | Verify that June 1–4 is Grey (`c`) with a strikethrough. | Ensures the user doesn't confuse the old prediction with the new reality. |

---

### 7. Edge Case: What if the user corrects the date after the old predicted window?

**Scenario:** She corrects June 1 → June 10 (9 days late).

**System Behavior:**

- June 1–9 turn Grey (`c`).
- June 10–14 turn Dark Pink (`P`).
- The "Next Cycle" still generates correctly from June 10.
- Confidence score drops (because `prediction_error_days = +9` is high).
- **SQLite:** Stores the June 10 start date. The `cycle_entries` record is updated.

---

### Summary

This scenario is the acid test for your offline-first AI. It proves that:

- The UI updates instantly without waiting for the server.
- The phases recalculate correctly using the mathematical formula (`ovulation = start + (cycle_length - 14)`).
- SQLite persists the correction so it survives app restarts.
- The "Rollover" mechanism seamlessly shifts the user's focus from the current confirmed cycle to the next predicted cycle.

If this scenario passes, your calendar is visually and mathematically sound. 🌸📅

---

## Scenario 14: BS Calendar Switch (Bikram Sambat) — Detailed Explanation

This scenario validates the display-layer independence of your offline-first architecture. It proves that your app can support region-specific calendar systems without altering the underlying data, which is critical for data consistency, cross-device sync, and machine learning accuracy.

---

### 1. Pre-Condition (The "Before" State)

- **User Setting:** The `calendarSystemStore` (Zustand) is set to `'AD'`.
- **Storage (SQLite):** All date fields (`period_start_date`, `period_end_date`, `created_at`, etc.) are stored as ISO 8601 strings (e.g., `2025-07-22`). No BS dates exist in the database.
- **UI Rendering:** The app uses `formatDisplayDate(date, 'AD')` everywhere, which outputs "July 22, 2025".
- **Date Picker:** The app uses the native `@react-native-community/datetimepicker` (which works with JS Date objects).

---

### 2. User Action (The Toggle)

**Action:** The user taps the chip (e.g., `[AD|BS]`) on the Home screen header.

**State Change (Immediate, < 50ms):**

- `useCalendarSystemStore.getState().toggle()` switches the state from `'AD'` to `'BS'`.
- The store is persisted to EncryptedStorage (so the preference survives app restarts).
- Zustand's reactivity triggers a re-render of all components that subscribe to this store (which includes every screen that displays dates).

---

### 3. The Centralized Formatting Function (The Core Engine)

**The Single Source of Truth:**
Every date in the app is rendered via `formatDisplayDate(date, calendarSystem)`. When the store switches to `'BS'`, this function changes its output without changing the input.

**Step-by-Step Execution of `formatDisplayDate()`:**

1. The function receives the ISO date (e.g., `'2025-07-22'`).
2. It checks the active calendar system from the Zustand store.
3. If `calendarSystem === 'BS'`:
   - It calls the conversion library: `const bs = adToBs('2025-07-22')`.
   - The library (wrapped in `bsDateUtils.ts`) maps the AD date to BS.
   - Result: `{ year: 2081, month: 4, day: 15, monthName: 'Shrawan' }`.
   - It formats the string: `"Shrawan 15, 2081 | July 22, 2025"`.
4. If `calendarSystem === 'AD'`:
   - It formats using standard `date-fns` or `toLocaleDateString`: `"July 22, 2025"`.

---

### 4. The Calendar Grid & UI Impact

The `Calendar.tsx` component is the most visually complex part of this switch.

#### A. Month/Year Header

- **AD Mode:** `"July 2025"`
- **BS Mode:** The header reads `formatMonthYear(currentMonth, 'BS')`. `formatMonthYear` converts the current AD month (e.g., July 22) to BS (Shrawan 2081) and displays `"Shrawan 2081 | July 2025"`.

#### B. Day Cells (The Dual-Display)

In BS mode, each day cell shows two numbers:

```
┌─────┐
│ १५  │   ← BS day number (large, primary)
│ 22  │   ← AD day number (smaller, muted)
└─────┘
```

**How it works:**

- The Calendar component iterates through the AD dates for the month (e.g., July 1–31).
- For each date (e.g., `2025-07-22`), it calls `formatDisplayDate(date, 'BS', 'day')` to get the BS day number (15).
- It renders the BS number prominently and the AD number (22) as secondary text.
- Phase dots (`P`, `F`, `O`, `L`, `p`, `f`, etc.) are completely unaffected because they are tied to the ISO date keys (e.g., `"2025-07-22"`), not the displayed number.

#### C. Phase Colors (Dark vs Light)

The calendar's days map is a `Record<string, string>` (e.g., `{ "2025-07-22": "P" }`).

The switch does not change this map. The color logic is completely independent of the display logic.

**Result:** The period dates remain Dark Pink (`P`) or Light Pink (`p`), but the day number inside that pink circle switches from 22 to 15.

---

### 5. Date Input (The Picker Switch)

The `DatePickerField` component must support both AD and BS input.

- **AD Mode:** Renders the native `@react-native-community/datetimepicker` (standard iOS/Android wheel picker).
- **BS Mode:** Renders a 3-dropdown custom picker (Year, Month, Day in BS).
- **Pre-fill:** When the user opens the picker, it converts the current AD date to BS and pre-selects those values.
- **On Change:** The user selects BS Year/Month/Day. The component converts it back to AD via `bsToAdDate()` and stores the result as an ISO string (`YYYY-MM-DD`) in the form state.

**Result:** The rest of the app (API calls, SQLite writes) receives the same ISO format it always expects.

---

### 6. The "Source of Truth" Rule (SQLite Remains Unaffected)

This is the most critical takeaway:

- **SQLite (Local):** The `period_start_date` column stores `'2025-07-22'`.
- **PostgreSQL (Server):** Stores `'2025-07-22'`.
- **React Query Cache:** The query keys use ISO dates.
- **The BS Switch:** Does **NOT** trigger a new API call, does **NOT** rewrite SQLite, and does **NOT** change the cache.

It is a pure UI transformation. The user is simply changing the lens through which they view the underlying ISO data.

---

### 7. Multi-Device & Offline Behavior

- **Multi-Device:** Since the calendar preference is stored locally (EncryptedStorage), switching to BS on the phone does not affect the Web Dashboard or another device. Each device remembers its own display preference.
- **Offline:** The conversion library (`@sbmdkl/nepali-date-converter`) is embedded in the app bundle (no network requests). The toggle works instantly, even in Airplane mode.

---

### 8. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ All 20+ date displays switch instantly. | Toggle the chip. Check the Calendar header, the Prediction Card, the Journal List, and the Sticky Card. | Proves that `formatDisplayDate` is the single source of truth for date formatting across the entire app. If one screen still shows AD, the centralized formatting rule is broken. |
| ✅ SQLite unaffected (storage remains ISO). | Toggle to BS. Log a new period. Check the `cycle_entries` table in SQLite (via dev tools). The `period_start_date` is `'2025-07-22'` (ISO). | Proves that we are not accidentally converting the database to BS. The server and local DB remain consistent. |
| ✅ Date picker switches to 3-dropdown in BS mode. | Open `LogPeriodScreen` in BS mode. The picker shows Year/Month/Day in BS. | Proves that the input layer correctly handles BS input and converts it to ISO before saving. |
| ✅ Multi-device sync unaffected. | Switch to BS on mobile. Log a period. Sync. Check the Web Dashboard (which is in AD). The period shows the correct date in AD. | Proves that the ISO storage is the source of truth for sync. Display settings do not break data exchange. |

---

### 9. Visual Summary (Before vs After)

| Element | AD Mode | BS Mode (After Toggle) |
|---------|---------|------------------------|
| Month Header | `"July 2025"` | `"Shrawan 2081 | July 2025"` |
| Day Cell | `"22"` | `"१५ \n 22"` |
| Prediction Card | `"Next period: July 15, 2025"` | `"Next period: Shrawan 15, 2081 | July 15, 2025"` |
| Date Picker | Native iOS/Android picker | 3-column BS dropdown (Year/Month/Day) |
| SQLite | `period_start_date: '2025-07-15'` | `period_start_date: '2025-07-15'` (Unchanged!) |
| API Payload | `{ "period_start_date": "2025-07-15" }` | `{ "period_start_date": "2025-07-15" }` (Unchanged!) |

---

### Summary

This scenario validates that your app can support region-specific calendar systems without sacrificing data integrity. The toggle is instant, offline-proof, and completely decoupled from the storage layer. It proves that your "display layer" architecture is robust enough to handle localization, BS support, and future calendar switches without rewriting the backend or corrupting user data. 🌸📅
