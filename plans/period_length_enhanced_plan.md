# Period Length — Enhanced End-Date Confirmation Flow

## Overview

Replace the hardcoded +5 day assumption for correction flows with a user-driven end-date confirmation system. When a user marks a period start without providing an end date, the system collects the end date via a P+avg notification + dashboard prompt, improving data accuracy for predictions.

---

## PR 1: Backend / API — Nullable End Date + Smart Logic

### 1A. Model: Already nullable, no schema change needed

`period_end_date: Mapped[date | None]` — already `nullable=True` on `CycleEntry`. Confirmed in `models.py:34`.

### 1B. Correction flow: store `NULL` when end date not provided

**File:** `backend/app/modules/cycle/services.py:674`

When `log_correction` receives no `period_end_date`, store `NULL` instead of computing a smart fallback:

```python
# Replace the current _compute_smart_end_date call:
period_end_date=period_end_date,  # simply store None
```

**Why:** The smart fallback (`_compute_smart_end_date`) was a bridge solution. Once we have the notification flow, we want `NULL` to signal "pending confirmation." During the gap between PR1 and PR2, the existing `_compute_average_period_length` fallback in calendar rendering handles display.

### 1C. Auto-close open-ended entries on next period start

**File:** `backend/app/modules/cycle/services.py`

Add new method and call it in both `log_correction` and `create_entry`:

```python
async def _auto_close_open_entry(self, user_id: uuid.UUID, new_start: date) -> None:
    """If there's an entry with NULL period_end_date before new_start, close it."""
    stmt = (
        select(CycleEntry)
        .where(CycleEntry.user_id == user_id)
        .where(CycleEntry.is_active.is_(True))
        .where(CycleEntry.period_end_date.is_(None))
        .order_by(CycleEntry.period_start_date.desc())
        .limit(1)
    )
    open_entry = (await self.db.execute(stmt)).scalar_one_or_none()
    if open_entry and open_entry.period_start_date < new_start:
        avg = self._compute_average_period_length(
            await self._get_recent_entries(user_id, limit=12)
        )
        open_entry.period_end_date = open_entry.period_start_date + timedelta(days=avg - 1)
        await self.db.flush()
```

Call site:
```python
# In log_correction (after creating entry):
await self._auto_close_open_entry(user_id, period_start_date)

# In create_entry (before commit):
await self._auto_close_open_entry(user_id, data.period_start_date)
```

### 1D. Calendar rendering — pending visual indicator

**File:** `backend/app/modules/cycle/services.py` (in `get_calendar`)

When rendering a confirmed cycle entry that has `period_end_date IS NULL`, use a new type code `u` (unconfirmed period) for the estimated range instead of `P`:

```python
# In _apply_confirmed_phases — currently always applies 'P'
# For entries with period_end_date=None, apply 'u' instead of 'P'
```

**New static method:**
```python
@staticmethod
def _apply_pending_phases(days: dict[str, str], phases: dict[str, date]) -> None:
    for d in CycleService._iter_date_range(phases["period_start"], phases["period_end"]):
        key = d.isoformat()
        if key not in days:
            days[key] = "u"
    # No fertile/ovulation/luteal for unconfirmed periods
```

**In `get_calendar` loop (line 465-469), split the entry rendering:**
```python
for i, entry in enumerate(entries):
    cycle_len = self._entry_cycle_length(list(entries), i, avg_cycle_length)
    per_len = self._entry_period_length(entry, avg_period_length)
    phases = calculate_cycle_phases(entry.period_start_date, cycle_len, per_len)
    if entry.period_end_date is None:
        self._apply_pending_phases(days, phases)
    else:
        self._apply_confirmed_phases(days, phases)
```

### 1E. Return cycle entry ID AND avg_period_length from correction response

**File:** `backend/app/modules/cycle/schemas.py`

`CorrectionResponse` already includes `id` (UUID). Add `avg_period_length` so the mobile client gets the authoritative average without computing it locally or making an extra API call:

```python
class CorrectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    period_start_date: date
    period_end_date: date | None
    symptoms: list[str]
    is_correction: bool
    corrected_prediction_id: uuid.UUID | None
    created_at: datetime
    avg_period_length: int = 5  # NEW — user's current average, for mobile notification scheduling
```

**File:** `backend/app/modules/cycle/routes.py` (in `create_correction`)

After `log_correction` succeeds, compute `avg_period_length` and include it:

```python
avg_length = svc._compute_average_period_length(
    await svc._get_recent_entries(current_user.id, limit=12)
)
entry.avg_period_length = avg_length  # computed field, not on model
```

Or better: return it as an additional field in the response dict, not on the ORM model:

```python
result = CorrectionResponse.model_validate(entry)
result.avg_period_length = avg_length
return result
```

**Mobile API** (`mobile/src/services/api/cycle.ts`):
```typescript
export interface CorrectionResponse {
  id: string;
  period_start_date: string;
  period_end_date?: string | null;
  symptoms: string[];
  is_correction: boolean;
  corrected_prediction_id?: string | null;
  created_at: string;
  avg_period_length: number;
}
```

### 1F. Smart notification timing function (backend utility)

**File:** `backend/app/modules/cycle/phase_utils.py`

```python
def compute_notification_day(user_avg_period_length: int | None, fallback: int = 3) -> int:
    """Return the day number (0-indexed from period start) to prompt for end date."""
    if user_avg_period_length and user_avg_period_length >= 3:
        return max(fallback, user_avg_period_length - 2)
    return fallback
```

This means: if average period length is 5, notify on day 3 (morning of day 4). If average is 7, notify on day 5. Minimum day 3.

---

## PR 2: Mobile — Notification UI + Pending Visual

### 2A. Mobile mirror of compute_notification_day

**File:** `mobile/src/utils/cyclePhases.ts`

Duplicate the pure function (no API dependency — works offline):

```typescript
export function computeNotificationDay(avgPeriodLength: number | null, fallback = 3): number {
  if (avgPeriodLength && avgPeriodLength >= 3) return Math.max(fallback, avgPeriodLength - 2);
  return fallback;
}
```

**Rationale:** This is a pure mathematical function with no external dependencies. The mobile schedules notifications locally (offline-first) and cannot call the backend at the moment of scheduling. Duplication is safer than adding an API dependency.

### 2B. Notification prerequisites

**File:** `mobile/src/app/App.tsx`

Add `setNotificationHandler` for foreground behavior:

```typescript
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,  // Don't show system banner — the prompt card handles in-app
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
```

### 2B. Notification permission request

**File:** `mobile/src/services/notifications.ts` (new file)

```typescript
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function requestEndDatePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('period-end', {
      name: 'Period End Reminder',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}
```

### 2C. Schedule end-date reminder

**File:** `mobile/src/services/notifications.ts`

```typescript
export async function scheduleEndDateReminder(
  entryId: string,
  startDate: Date,
  avgPeriodLength: number | null,
): Promise<string> {
  const dayOffset = Math.max(3, (avgPeriodLength ?? 5) - 2);
  const fireDate = new Date(startDate);
  fireDate.setDate(fireDate.getDate() + dayOffset);
  fireDate.setHours(9, 0, 0, 0);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Has your period ended?',
      body: 'Tap to mark the end date.',
      data: { type: 'mark-end-date', entryId },
    },
    trigger: { type: 'dateTrigger', date: fireDate },
  });
  return id;
}

export async function cancelEndDateReminder(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
```

### 2D. Store pending end-date state locally

**File:** `mobile/src/stores/cycleStore.ts`

Add to existing Zustand store with encrypted persistence:

```typescript
export interface PendingEndDate {
  entryId: string;
  startDate: string;
  notificationId: string | null;
}

// In cycleStore:
pendingEndDate: PendingEndDate | null;
setPendingEndDate: (pending: PendingEndDate | null) => void;
```

**Critical — survive force-quit:** Ensure `pendingEndDate` is included in the persist `partialize` list so it survives app restart. If the notification has already fired, the Dashboard prompt card will still show on restart and allow the user to mark the end date manually.

```typescript
// cycleStore persist config:
partialize: (state) => ({
  localCorrectionDelta: state.localCorrectionDelta,
  pendingEndDate: state.pendingEndDate,  // ADD THIS
}),
```

### 2E. Update correction flow to capture entry ID

**File:** `mobile/src/services/queries/cycle.ts`

In `useLogCorrection` `onSuccess`:

```typescript
onSuccess: async (result, variables) => {
  // result includes avg_period_length from CorrectionResponse (PR 1, §1E)
  if (!variables.period_end_date && result?.id) {
    const avgLen = result.avg_period_length ?? 5;
    const granted = await requestEndDatePermission();
    if (granted) {
      const notifId = await scheduleEndDateReminder(
        result.id, new Date(variables.period_start_date), avgLen,
        computeNotificationDay(avgLen),
      );
      useCycleStore.getState().setPendingEndDate({
        entryId: result.id,
        startDate: variables.period_start_date,
        notificationId: notifId,
      });
    }
  }
  // existing invalidation...
}
```

**Where `avgLen` comes from:** The `CorrectionResponse` now includes `avg_period_length` (returned by the backend in PR 1 §1E). No local calculation or extra API call needed. Works offline because the value was fetched during the correction API call that succeeded.
```

### 2F. Mark End Date modal

**File:** `mobile/src/components/ui/MarkEndDateModal.tsx` (new component)

- Opens on notification tap (deep-link `type === 'mark-end-date'`)
- Also accessible from CycleDashboard prompt card
- Date picker pre-filled with today
- Max date = today (can't end in the future)
- Min date = entry start date (can't end before start)
- On confirm: calls `PUT /cycle/entries/{entryId}` with `{ period_end_date: selectedDate }`
- On success: clears `pendingEndDate`, cancels notification, invalidates calendar cache

**Optional Enhancement — refresh calendar + avg on end-date confirm:**
After `PUT /cycle/entries/{entryId}` succeeds, the backend returns the updated entry. Invalidate `cycleKeys.calendar` and `cycleKeys.entries` immediately so the calendar re-renders the confirmed `P` (dark pink) block. The updated `period_end_date` also feeds into `_compute_average_period_length` on the next prediction run.

### 2G. Dashboard prompt card

**File:** `mobile/src/screens/cycle/CycleDashboardScreen.tsx`

Add a new card below the PredictionDetailCard:

```tsx
{pendingEndDate && (
  <Card style={[styles.endDateCard, { borderStyle: 'dashed', borderColor: theme.colors.primary }]}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text>Have your periods ended? Tap to mark the end date.</Text>
      <Button label="Skip" size="sm" variant="ghost" onPress={handleDismissEndDate} />
    </View>
    <Button label="Mark End Date" size="sm" onPress={() => setShowEndDateModal(true)} />
  </Card>
)}
```

Visibility logic:
- `pendingEndDate` is non-null (stored in Zustand)
- Today >= `pendingEndDate.startDate + max(3, avgPeriodLength - 2)`

**Optional Enhancement — "Skip" button:** Tapping "Skip" dismisses the prompt for the current cycle without setting an end date. It clears `pendingEndDate` from the store (so the card disappears) but does NOT call any API. The system falls back to the historical average when the next period starts (auto-close from PR 1 §1C).

```typescript
const handleDismissEndDate = useCallback(() => {
  const state = useCycleStore.getState();
  if (state.pendingEndDate?.notificationId) {
    cancelEndDateReminder(state.pendingEndDate.notificationId);
  }
  state.setPendingEndDate(null);
}, []);
```

### 2H. Calendar pending visual

**File:** `mobile/src/components/ui/Calendar.tsx` and `mobile/src/screens/calendar/CalendarScreen.tsx`

Add `u` to the day type map with a dashed/pending style:

```typescript
const DAY_TYPE_COLORS: Record<string, { bg: string; text: string; dashed?: boolean }> = {
  P: { bg: '#FF6B8A', text: '#FFFFFF' },
  u: { bg: '#FFB3C1', text: '#CC3355', dashed: true },  // pending — lighter, dashed
  // ... rest unchanged
};
```

In the cell renderer, apply dashed border when `dashed: true`.

### 2I. Notification deep-link handler

**File:** `mobile/src/app/App.tsx`

Add `mark-end-date` case alongside existing `checkin`:

```typescript
if (data?.type === 'mark-end-date') {
  navigate('Main', { screen: 'Calendar', params: { screen: 'CycleDashboard', params: { markEndDate: true } } });
}
```

### 2J. Handle pre-emptive end date mark

When the user marks the end date via LogPeriodScreen (providing both start and end):
- Cancel any pending notification via `cancelEndDateReminder`
- Clear `pendingEndDate` from store
- No end-date card shown

---

## Affected Files Summary

### PR 1: Backend

| File | Change |
|------|--------|
| `app/modules/cycle/phase_utils.py` | Add `compute_notification_day()` |
| `app/modules/cycle/schemas.py` | Add `avg_period_length` to `CorrectionResponse` |
| `app/modules/cycle/routes.py` | Set `avg_period_length` in correction response handler |
| `app/modules/cycle/services.py` | `log_correction` stores NULL end date; add `_auto_close_open_entry`; add `_apply_pending_phases`; update `get_calendar` rendering loop |

### PR 2: Mobile

| File | Change |
|------|--------|
| `src/app/App.tsx` | Add `setNotificationHandler`; add `mark-end-date` deep-link case |
| `src/utils/cyclePhases.ts` | Add `computeNotificationDay()` (offline-safe pure function) |
| `src/services/notifications.ts` | New — permission, schedule, cancel |
| `src/stores/cycleStore.ts` | Add `pendingEndDate` state (persisted) |
| `src/services/api/cycle.ts` | Add `avg_period_length` to `CorrectionResponse` interface |
| `src/services/queries/cycle.ts` | Capture entry ID + `avg_period_length` in `onSuccess`; schedule notification |
| `src/components/ui/MarkEndDateModal.tsx` | New — end date confirmation modal + calendar refresh on confirm |
| `src/screens/cycle/CycleDashboardScreen.tsx` | Add pending end-date prompt card with "Skip" dismiss |
| `src/components/ui/Calendar.tsx` | Add `u` type code with dashed style |
| `src/screens/calendar/CalendarScreen.tsx` | Add `u` to day type map |

---

## Verification Checklist

### PR 1
- [ ] Correction with no end date stores `NULL` instead of smart fallback
- [ ] Calendar renders pending period as `u` (lighter, dashed) instead of `P`
- [ ] Auto-close: logging a new period start closes any open-ended prior entry
- [ ] `compute_notification_day(5)` returns 3; `compute_notification_day(7)` returns 5
- [ ] Correction with explicit `period_end_date` stores it as-is (backward compatible)
- [ ] `_compute_average_period_length` still skips NULL end-date entries
- [ ] `CorrectionResponse` includes `avg_period_length` field
- [ ] Mobile `onSuccess` receives `avg_period_length` from correction response

### PR 2
- [ ] `computeNotificationDay` mirrors backend formula exactly
- [ ] Notification permission requested only when marking a period start
- [ ] Notification fires at 9 AM on the correct day (P + max(3, avg-2))
- [ ] Deep-link opens MarkEndDateModal
- [ ] Dashboard prompt card shows only when `pendingEndDate` exists + timing condition
- [ ] "Skip" dismisses prompt, cancels notification, clears pendingEndDate
- [ ] Pre-emptive end date via LogPeriodScreen cancels pending notification
- [ ] Calendar shows `u` cells with dashed border for unconfirmed periods
- [ ] Modal rejects end date before start date
- [ ] Modal confirm invalidates calendar + entries cache (re-renders `P`)
- [ ] `pendingEndDate` survives app restart (persisted in encrypted store)
- [ ] Offline: end date mark is queued, synced when online
