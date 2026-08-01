# Feature: Period Start/End Date Flagging on Calendar — Complete Implementation Plan

**Status:** Planned  
**Priority:** High  
**Module:** Cycle  
**Dependencies:** Calendar Bottom Sheet, Offline Queue, Optimistic UI  
**Last Updated:** 2026-08-01

---

## Overview

Enable users to directly flag a date on the calendar as the Period Start or Period End, without navigating to a separate screen. Currently, tapping a date opens a bottom sheet with symptoms, notes, and mood logging.

---

## 1. The New User Flow

### 1.1 User Taps a Date on the Calendar

**Current Behavior:**

Tapping a date opens a Bottom Sheet with:

- Symptoms selection
- Notes field
- Mood logging
- "Log Period" / "Add Entry" button

**New Behavior:**

The Bottom Sheet gains two prominent Flag buttons at the top:

- "Mark as Period Start" (Dark Pink pill, left-aligned)
- "Mark as Period End" (Light Pink pill, right-aligned)

Below the flag buttons, the existing Symptoms, Notes, and Mood sections remain.

---

### 1.2 User Marks "Period Start"

| Step | Action | System Behavior |
| --- | --- | --- |
| 1 | User taps a date on the calendar (e.g., June 20). | Bottom Sheet opens. |
| 2 | User taps "Mark as Period Start". | The date is saved as `period_start_date` in `cycle_entries`. The End Date is auto-calculated using `avg_period_length` (if not explicitly set). |
| 3 | The calendar updates instantly: | That date turns Dark Pink (P). The subsequent days (Start + Avg_Period_Length) also turn Dark Pink. |
| 4 | The Sticky Card | Disappears (because the period is now confirmed). |
| 5 | The End Date Notification | Is scheduled for Start + (Avg_Period_Length - 2) days later (existing behavior). |
| 6 | The next cycle prediction | Is instantly generated (Light Pink) for the next month. |

---

### 1.3 User Marks "Period End"

| Step | Action | System Behavior |
| --- | --- | --- |
| 1 | User taps a date on the calendar. | Bottom Sheet opens. |
| 2 | User taps "Mark as Period End". | The date is saved as `period_end_date` in the existing `cycle_entry` (the period currently active). |
| 3 | If no `period_start_date` exists yet for that cycle: | The End Date is stored but the calendar does not render a period block. The user must also mark a Start Date for it to appear. |
| 4 | The calendar updates instantly: | The Dark Pink block extends to the selected End Date. If the End Date was earlier than the Start Date, the system displays a validation error. |
| 5 | The End Date Notification | Is cancelled (since the user manually marked the end). |
| 6 | `avg_period_length` | Is recalculated using the explicit End Date. |

---

## 2. Mobile Implementation (UI & Logic)

### 2.1 The Bottom Sheet Update

**File:** `src/screens/calendar/CalendarScreen.tsx` (or the bottom sheet component inside it)

Add Flag Buttons:

```tsx
// Inside the Bottom Sheet (above the form fields)
<View style={styles.flagContainer}>
  <Pressable
    style={[styles.flagButton, styles.startFlag]}
    onPress={() => handleFlag('start')}
    accessibilityLabel="Mark this day as the start of your period"
  >
    <Text style={styles.flagText}>🩸 Mark as Period Start</Text>
  </Pressable>
  <Pressable
    style={[styles.flagButton, styles.endFlag]}
    onPress={() => handleFlag('end')}
    accessibilityLabel="Mark this day as the end of your period"
  >
    <Text style={styles.flagText}>✅ Mark as Period End</Text>
  </Pressable>
</View>
```

---

### 2.2 Flag Handling Logic

**File:** `src/screens/calendar/CalendarScreen.tsx` (or the hook managing the bottom sheet)

```typescript
const handleFlag = async (flagType: 'start' | 'end') => {
  const selectedDate = selectedDay; // The date the user tapped
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return;

  if (flagType === 'start') {
    // 1. Check if a period already exists for this date
    const existing = await localDb.cycle.getByDate(userId, selectedDate);
    if (existing) {
      Toast.show({ type: 'info', text1: 'Period already logged for this date' });
      return;
    }

    // 2. Create/Update cycle entry
    const avgPeriodLength = await localDb.user.getAvgPeriodLength(userId);
    const endDate = addDays(selectedDate, avgPeriodLength - 1);
    
    await logPeriodStart(selectedDate, endDate);
    
    // 3. Emit event for Luna
    eventBus.emit('period_logged', { userId, date: selectedDate });
    
    // 4. Optimistic UI update
    updateCalendarOptimistically(selectedDate, 'start');
    
  } else if (flagType === 'end') {
    // 1. Find the active open period (start date without end date)
    const openPeriod = await localDb.cycle.getOpenPeriod(userId);
    if (!openPeriod) {
      Toast.show({ type: 'info', text1: 'No active period to end' });
      return;
    }

    // 2. Validate: End Date must be after Start Date
    if (selectedDate <= openPeriod.period_start_date) {
      Toast.show({ type: 'error', text1: 'End date must be after start date' });
      return;
    }

    // 3. Update the entry with end date
    await updatePeriodEnd(openPeriod.id, selectedDate);
    
    // 4. Optimistic UI update
    updateCalendarOptimistically(selectedDate, 'end');
    
    // 5. Cancel any pending end-date notification
    await cancelEndDateNotification(openPeriod.id);
  }
};
```

---

### 2.3 Optimistic Calendar Update

**File:** `src/screens/calendar/CalendarScreen.tsx` (or a helper in `cyclePhases.ts`)

```typescript
const updateCalendarOptimistically = (date: Date, flagType: 'start' | 'end') => {
  // Get the current calendar cache
  const oldDays = queryClient.getQueryData(['cycle', 'calendar', ...]);
  
  // Create a new days object
  const newDays = { ...oldDays };
  const dateStr = toDateStr(date);
  
  if (flagType === 'start') {
    // Find the predicted period block and turn it into confirmed
    // (or create a new period block)
    const avgLength = getAvgPeriodLength();
    for (let i = 0; i < avgLength; i++) {
      const d = addDays(date, i);
      const key = toDateStr(d);
      newDays[key] = 'P';
    }
    // Cancel old prediction blocks in the same window
    // ...
  } else if (flagType === 'end') {
    // Extend the existing period block to the new end date
    // ...
  }
  
  // Update the cache
  queryClient.setQueryData(['cycle', 'calendar', ...], newDays);
};
```

---

## 3. Backend Implementation

### 3.1 New Endpoint (or Reuse Existing)

Reuse: `POST /api/v1/cycle/entries` already handles creating a period entry with `period_start_date` and `period_end_date`. No new endpoint needed.

Ensure the endpoint supports:

- Creating an entry with `period_start_date` only (auto-calculates end date).
- Creating an entry with `period_end_date` only (if a start date exists in the same cycle window).
- Updating an existing entry with a new `period_end_date`.

---

### 3.2 Auto-Link Logic (Existing)

When the user marks a Start Date, the system should attempt to auto-link it to any existing active prediction (via `_try_auto_link_prediction`). If the Start Date falls within ±`max(3, prediction_window_days)` of the predicted date, it is automatically linked, and `prediction_error_days` is calculated.

---

## 4. Offline Handling (Critical)

| Scenario | System Behavior |
| --- | --- |
| User flags Start Date offline | The operation is enqueued to `offlineStore` with type: `cycle/create`. The calendar updates instantly (optimistic). When online, the sync engine pushes it to the server. |
| User flags End Date offline | The operation is enqueued with type: `cycle/update`. The calendar updates instantly. When online, the sync engine pushes it to the server. |
| Conflict (Multi-Device) | The server uses Client Timestamp Authority (LWW). If the server has a newer edit, it returns a 409 Conflict with `server_data`. The mobile overwrites the local state. |

---

## 5. Edge Cases & Safeguards

| Scenario | System Behavior |
| --- | --- |
| User flags Start Date on a date that already has a period logged | Toast: "Period already logged for this date." No action. |
| User flags End Date without a Start Date | Toast: "Please log the start date first." Store the End Date but do not render a period block until Start Date is set. |
| User flags End Date before Start Date | Toast: "End date must be after start date." No action. |
| User flags Start Date but there is an open period already | Auto-close the previous period (using `_auto_close_open_entry`). |
| User flags End Date but the period is already closed | Toast: "Period already ended." No action. |

---

## 6. Validation Criteria

- [ ] Tapping a date opens the bottom sheet with "Mark as Period Start" and "Mark as Period End" buttons.
- [ ] Tapping "Mark as Period Start" instantly updates the calendar to Dark Pink (P).
- [ ] Tapping "Mark as Period End" extends the Dark Pink block to the selected date.
- [ ] The End Date Notification is scheduled (or cancelled) correctly.
- [ ] Offline: Flagging a date queues the operation to `offlineStore`.
- [ ] Online: Flagging a date syncs to the server.
- [ ] Multi-Device: Conflict resolution works correctly.
- [ ] The Sticky Card disappears after a Start Date is flagged.
- [ ] The Prediction Detail Card updates with the new dates.

---

## 7. Summary

| Feature | Status |
| --- | --- |
| Flag Start Date | ✅ Planned |
| Flag End Date | ✅ Planned |
| Auto-Schedule End Notification | ✅ Existing |
| Optimistic UI Update | ✅ Planned |
| Offline Queue | ✅ Existing |
| Multi-Device Conflict | ✅ Existing |

---

Proceed with implementation. This feature transforms the calendar from a passive viewer into an active logging tool. 🌸📅
