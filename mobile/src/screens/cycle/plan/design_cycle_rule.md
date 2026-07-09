# Mobile Implementation Plan: Correction Notification & Manual Override

> Based on `backend/app/modules/cycle/plan/cycle_rule_rawplan.md` and
> `backend/app/modules/cycle/plan/cycle_rule_plan.md`.

---

## Overview

Three mobile-side features:

| Feature | Description |
|---------|-------------|
| **Sticky Card** | Persistent card on Cycle Dashboard during `P-3` to `P+6` |
| **Permanent Override** | Always-visible "Adjust Period Date" button on Cycle Dashboard |
| **Push Notification** | Handle deep-link from backend's daily check-in notification |

---

## 1. Sticky Card

### 1.1 Visibility Logic

```
window_start = predicted_next_period_start - 3 days
window_end   = predicted_next_period_start + 6 days
today in [window_start, window_end] AND not yet corrected → show card
```

### 1.2 Card Layout

```
┌──────────────────────────────────────────────┐
│  🔔 Period Check-in                          │
│                                              │
│  We expected your period around Jun 30.      │
│  Did it arrive?                              │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ Yes, on  │  │ No, adj  │  │ Not yet    │ │
│  │ Jun 30   │  │ ─ust date│  │ (Snooze)   │ │
│  └──────────┘  └──────────┘  └────────────┘ │
└──────────────────────────────────────────────┘
```

### 1.3 User Actions

| Action | Implementation |
|--------|---------------|
| "Yes, started on [Predicted Date]" | Calls `logCorrection()` with `corrected_prediction_id` and `period_start_date = predicted_next_period_start`. Card dismissed. |
| "No, adjust date" | Opens a `BottomSheet` with `DatePickerField`. User picks actual date. Calls `logCorrection()`. Card dismissed. |
| "Not yet" (Snooze) | Calls `logSnooze()` with `day_offset` incremented each time. Card dismissed. Reappears next day if still within window. |

### 1.4 Dismissal

- Card auto-dismisses when `today > P + 6`
- Card dismisses immediately after any action (correction or snooze)
- If snoozed, card re-appears next day (day_offset + 1) if still within window

---

## 2. Permanent "Adjust Period Date" Button

### 2.1 Placement

Always visible at the bottom of the Cycle Dashboard, below the action grid.

### 2.2 Behavior

- Icon: pencil/edit icon
- Press → opens `BottomSheet` with:
  - Title: "Adjust Period Date"
  - `DatePickerField` (no min/max restrictions)
  - Optional: period end date field
  - "Confirm" button → calls `logCorrection()` without `corrected_prediction_id`
  - If a prediction exists, pass its `id` as `corrected_prediction_id` so the error is tracked

### 2.3 Edge Cases

- **Early period:** User picks a date before predicted start → `prediction_error_days` is negative
- **Late period:** User picks a date after predicted start → `prediction_error_days` is positive
- **No prediction:** Works fine without `corrected_prediction_id`

---

## 3. Push Notification Deep-Link

### 3.1 Notification Payload

Backend sends:
```json
{
  "type": "checkin",
  "prediction_id": "uuid-here",
  "screen": "CycleDashboard"
}
```

### 3.2 Handling

- Register notification tap handler in `App.tsx` or `RootNavigator.tsx`
- Parse `data` payload
- If `type === "checkin"`, navigate to `CycleDashboard` screen
- Uses `navigationRef.navigate('MainTabs', { screen: 'CalendarTab', params: { screen: 'CycleDashboard' } })`

### 3.3 FCM Token Registration

- On login, register the device FCM token via `POST /api/v1/auth/fcm/register`
- Use `expo-notifications` or platform-specific FCM SDK

---

## 4. Files to Modify

| File | Change |
|------|--------|
| `src/services/queries/cycle.ts` | Add `useCycleCalendar` query, `useLogCorrection` mutation, `useLogSnooze` mutation |
| `src/services/api/cycle.ts` | No changes needed — `logCorrection` and `logSnooze` already exist |
| `src/screens/cycle/CycleDashboardScreen.tsx` | Add sticky card logic, permanent override button, React Query for calendar |
| `src/components/ui/StickyCard.tsx` | **New** — reusable sticky card component for the check-in |
| `src/navigation/rootNavigation.ts` | Add notification tap handler for deep-linking |

---

## 5. Behavior Flow Diagram

```
App opens (foreground or background)
  │
  ├─ Notification tap (type=checkin) ──→ Navigate to CycleDashboard
  │
  └─ Normal launch ──→ CycleDashboard loads
                         │
                         ├─ Fetch calendar/predictions
                         │
                         ├─ Compute window: [P-3, P+6]
                         │
                         ├─ today in window AND not corrected?
                         │   ├─ YES → Show Sticky Card
                         │   │          ├─ "Yes" → logCorrection → dismiss
                         │   │          ├─ "Adjust" → BottomSheet → logCorrection → dismiss
                         │   │          └─ "Not yet" → logSnooze → dismiss (reappears tomorrow)
                         │   └─ NO → Hide card
                         │
                         └─ Always show "Adjust Period Date" button
```

---

## 6. API Contract Usage

| Mobile Action | API Endpoint | Request Body |
|--------------|-------------|--------------|
| Confirm period on predicted date | `POST /cycle/corrections` | `{ period_start_date, corrected_prediction_id, period_end_date }` |
| Adjust to actual date | `POST /cycle/corrections` | `{ period_start_date, period_end_date, corrected_prediction_id }` |
| Snooze | `POST /cycle/snooze` | `{ predicted_cycle_id, day_offset }` |
| Get calendar data | `GET /cycle/calendar` | Query: `months_back=3&months_forward=3` |
| Register FCM token | `POST /auth/fcm/register` | `{ fcm_token }` |
