# Period Check-in Card — Phase-Aware Implementation Plan

## Problem

The check-in card currently shows a static message ("We expected your period around Aug 5. Did it arrive?") regardless of whether it's P-3, P+0, or P+5. The card should:

1. Change its message tone based on the phase (expectation → day-of → delay)
2. Expire at P+6 and be replaced by a passive "log manually" banner
3. Store `correction_delta` on the cycle entry for future ML training
4. Capture corrections from ALL logging paths (Sticky Card, Calendar manual, LogPeriodScreen)

---

## Current State (What Already Works)

- `prediction_error_days` on `PredictedCycle` stores `actual - predicted` (services.py:906)
- `needs_checkin` window is computed server-side (services.py:628-662)
- The confirm button already uses today's date (StickyCard fix applied)
- `log_correction()` already links corrections to predictions and recomputes next prediction
- `_try_auto_link_prediction()` auto-links entries to predictions within a window

### How Periods Are Logged Today (3 Paths)

| Path | Screen | Endpoint | Links to prediction? | Stores correction_delta? |
|------|--------|----------|---------------------|------------------------|
| **Sticky Card "Yes"** | CheckInCard → StickyCard | `POST /cycle/corrections` | Explicitly via `corrected_prediction_id` | **NO** (not yet) |
| **Calendar "Start Period"** | DayDetailSheet → CalendarScreen | `POST /cycle/corrections` | Explicitly via `corrected_prediction_id` | **NO** (not yet) |
| **LogPeriodScreen "Save"** | LogPeriodScreen | `POST /cycle/entries` | Auto-link via `_try_auto_link_prediction()` (within 3-day or pwd window) | **NO** (not yet) |

**The blind spot:** `correction_delta` is never stored on any path today. We need to add it to BOTH `log_correction()` AND `_try_auto_link_prediction()`.

---

## Backend Changes

### 1. Tighten `needs_checkin` window → P-3 to P+5

**File:** `backend/app/modules/cycle/services.py:628-639`

Current code uses `pwd` (prediction_window_days) to scale the window:
```python
window_start = pred_date - timedelta(days=max(3, pwd))
window_end = pred_date + timedelta(days=max(6, pwd + 1))
```

Change to fixed P-3 to P+5:
```python
window_start = pred_date - timedelta(days=3)
window_end = pred_date + timedelta(days=5)
```

**Why:** The card should disappear at P+6, not P+6+pwd. The `pwd` scaling made the window too wide for irregular users.

### 2. Add `correction_delta` column to `CycleEntry`

**File:** `backend/app/modules/cycle/models.py` (after `is_correction` field, ~line 52)

```python
correction_delta: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
```

Convention: positive = user started late (matches existing `prediction_error_days`).

### 3. Create shared `apply_correction_if_needed()` helper

**File:** `backend/app/modules/cycle/services.py` (new private method on CycleService)

This helper is called by ALL three logging paths to guarantee corrections are never missed:

```python
async def apply_correction_if_needed(
    self, entry: CycleEntry, prediction: PredictedCycle
) -> None:
    """Link a prediction to an entry and store correction data.
    
    Called from:
    1. log_correction() — Sticky Card "Yes" + Calendar "Start Period"
    2. _try_auto_link_prediction() — LogPeriodScreen auto-link
    3. create_entry() — Calendar "Start Period" via POST /cycle/entries
    
    Ensures correction_delta is ALWAYS stored when a prediction is matched.
    """
    error = (entry.period_start_date - prediction.predicted_next_period_start).days
    prediction.actual_cycle_entry_id = entry.id
    prediction.prediction_error_days = error
    entry.is_correction = True
    entry.corrected_prediction_id = prediction.id
    entry.correction_delta = error  # positive = late, negative = early
    await self._update_user_ml_metrics(entry.user_id, error)
```

**Call sites (3 paths, 1 helper):**

| # | Path | Where helper is called |
|---|------|----------------------|
| 1 | `log_correction()` | When `corrected_prediction_id` is provided (Sticky Card + Calendar manual via corrections endpoint) |
| 2 | `_try_auto_link_prediction()` | Called from `create_entry()` — auto-links when entry is within prediction window |
| 3 | `create_entry()` (IntegrityError path) | When duplicate period_start_date exists and entry is updated — also calls `_try_auto_link_prediction()` |

**Result:** No matter how the user logs the start date (Sticky Card, Calendar Start Period, LogPeriodScreen), the correction is always captured.

### 4. Update `log_correction()` to use the helper

**File:** `backend/app/modules/cycle/services.py` `log_correction()` (lines 904-912)

Replace the inline linking code with:
```python
if corrected_prediction_id is not None:
    prediction = await self.get_prediction_by_id(corrected_prediction_id, user_id)
    await self.apply_correction_if_needed(entry, prediction)
    cutoff = prediction.predicted_next_period_start - timedelta(days=3)
    if period_start_date < cutoff:
        prediction.checkin_sent = True
    await self.db.flush()
```

**This covers both:**
1. Sticky Card "Yes" button → calls `POST /cycle/corrections` with `corrected_prediction_id`
2. Calendar "Start Period" button → calls `POST /cycle/corrections` with `corrected_prediction_id` (from `CalendarScreen.handleFlagStart`)

### 5. Update `_try_auto_link_prediction()` to use the helper

**File:** `backend/app/modules/cycle/services.py` `_try_auto_link_prediction()` (lines 153-173)

Replace the inline linking code with:
```python
for pred in predictions:
    link_window = max(base_window, pred.prediction_window_days or 0)
    diff = (entry.period_start_date - pred.predicted_next_period_start).days
    if -link_window <= diff <= link_window:
        await self.apply_correction_if_needed(entry, pred)
        await self.db.flush()
        break
```

**This covers:**
- LogPeriodScreen "Save" → calls `POST /cycle/entries` → `create_entry()` → `_try_auto_link_prediction()` → auto-links if within window

### 6. Add to response schemas

**File:** `backend/app/modules/cycle/schemas.py`

Add to `CycleEntryResponse` (after `corrected_prediction_id`):
```python
correction_delta: int | None = None
```

Add to `CorrectionResponse` (after `corrected_prediction_id`):
```python
correction_delta: int | None = None
```

### 7. Alembic migration

**New file:** `backend/alembic/versions/..._add_correction_delta_to_cycle_entries.py`

```python
"""Add correction_delta to cycle_entries.

Stores the prediction error (actual - predicted) on the cycle entry
for easier frontend access and future ML model training.
Positive = user started late, Negative = user started early.
"""
from alembic import op
import sqlalchemy as sa

revision = "<auto>"
down_revision = "<previous>"

def upgrade() -> None:
    op.add_column(
        "cycle_entries",
        sa.Column("correction_delta", sa.SmallInteger(), nullable=True),
    )

def downgrade() -> None:
    op.drop_column("cycle_entries", "correction_delta")
```

---

## Frontend Changes

### 1. Phase-aware StickyCard message + delay-phase date picker

**File:** `mobile/src/components/ui/StickyCard.tsx`

Add new props:
```typescript
checkinPhase: 'expectation' | 'day_of' | 'delay';
daysOffset: number;  // days since predicted date (negative = early, positive = late)
```

Phase-based messages:

| Phase | Window | Message |
|-------|--------|---------|
| `expectation` | P-3 to P-1 | "We expect your period around {predictedLabel}." |
| `day_of` | P+0 | "We predicted your period for today." |
| `delay` | P+1 to P+5 | "Your period is a bit late. Did it start today?" |

#### Confirm button behavior by phase:

**Expectation & Day-Of (P-3 to P+0):**
- Button: `Yes, on {todayLabel}` → sends today's date
- Simple, no date selection needed

**Delay (P+1 to P+5):**
- Show quick-select chips above the confirm button:
  ```
  [Today]  [Yesterday]  [2 days ago]  [3 days ago]
  ```
- Each chip sets a `selectedDate` state
- Default selection: `Today`
- Confirm button text changes dynamically:
  - If "Today" selected: `Yes, on Aug 10`
  - If "Yesterday" selected: `Yes, on Aug 9`
  - If "2 days ago" selected: `Yes, on Aug 8`
- The `onConfirm` callback sends `selectedDate` (not hardcoded today)
- Also keep the existing "No, adjust date" button for custom date selection via the BottomSheet date picker

```tsx
// Delay phase: quick-select chips
{checkinPhase === 'delay' && (
  <View style={styles.chipRow}>
    {quickDateOptions.map((opt) => (
      <Pressable
        key={opt.label}
        onPress={() => setSelectedDate(opt.dateStr)}
        style={[
          styles.chip,
          selectedDate === opt.dateStr && styles.chipActive,
        ]}
      >
        <Text variant="caption">{opt.label}</Text>
      </Pressable>
    ))}
  </View>
)}

// Confirm button: dynamic label based on selection
<Button
  label={`Yes, on ${selectedDateLabel}`}
  onPress={() => onConfirm(predictionId, selectedDate)}
  ...
/>
```

**Why quick-select chips:** When a user is 4 days late but knows they started 2 days ago, forcing "Yes, on Today" ruins the ML model. Chips let them log the actual start date with one tap. The "No, adjust date" fallback handles edge cases.

### 2. Compute phase offset in `usePeriodCheckIn`

**File:** `mobile/src/hooks/usePeriodCheckIn.ts`

Add to the `PeriodCheckIn` interface:
```typescript
checkinPhase: 'expectation' | 'day_of' | 'delay';
daysOffset: number;  // negative = early, positive = late, 0 = day-of
isExpired: boolean;  // true when past P+5 with active prediction
```

Compute the offset:
```typescript
const predictedDateObj = prediction?.predicted_next_period_start
  ? parseISODateLocal(prediction.predicted_next_period_start)
  : null;

const daysOffset = predictedDateObj
  ? Math.round((today.getTime() - predictedDateObj.getTime()) / 86400000)
  : 0;

const checkinPhase = daysOffset <= -1 ? 'expectation'
                   : daysOffset === 0 ? 'day_of'
                   : 'delay';

// isExpired = past P+5 with active uncorrected prediction
const isExpired = daysOffset >= 6 && prediction != null;
```

Pass `daysOffset` and `checkinPhase` to StickyCard:
```tsx
<StickyCard
  predictedDate={checkIn.predictedDate}
  predictionId={checkIn.predictionId}
  visible
  loading={checkIn.loading}
  checkinPhase={checkIn.checkinPhase}
  daysOffset={checkIn.daysOffset}
  onConfirm={checkIn.onConfirm}
  onAdjust={checkIn.onAdjust}
  onSnooze={checkIn.onSnooze}
/>
```

### 3. New `DelayedBanner` component

**New file:** `mobile/src/components/ui/DelayedBanner.tsx`

A small, dismissible banner for P+6+ state. Uses **soft, non-urgent** styling to avoid stressing the user:

```tsx
<Card
  style={[
    styles.banner,
    {
      backgroundColor: theme.colors.warning + '15',  // soft amber wash
      borderColor: theme.colors.warning + '30',
      borderWidth: 1,
    },
  ]}
>
  <Text variant="bodySmall" color="secondary">
    Your period is significantly delayed. Tap the Calendar to log your
    start date when it arrives.
  </Text>
  <View style={bannerActions}>
    <Button
      label="Log Period"
      size="sm"
      variant="outline"              // secondary, not primary gradient
      onPress={goToCalendar}
    />
    <Button
      label="Dismiss"
      size="sm"
      variant="outline"
      onPress={dismiss}
    />
  </View>
</Card>
```

**Color choices (from theme tokens):**
- Background: `warning + '15'` → `#F4A93C20` (soft amber wash, not alarming)
- Border: `warning + '30'` → `#F4A93C4D` (subtle amber border)
- Text: `color="secondary"` → `textSecondary` (#3B4151, warm dark gray)
- Action button: `variant="outline"` (not primary pink — reduces anxiety)

**Why these colors:** The user is already stressed about being late. Primary pink signals urgency/action. Amber signals "informational, no pressure." The outline button avoids visual alarm.

Dismiss state persisted in AsyncStorage:
```typescript
const DISMISS_KEY = `shecare.delayed_banner_dismissed_${predictionId}`;
```

### 4. Show banner in `CheckInCard`

**File:** `mobile/src/components/home/CheckInCard.tsx`

After the StickyCard render (line 68), add:
```tsx
{checkIn.isExpired && !bannerDismissed && (
  <DelayedBanner
    predictionId={checkIn.predictionId}
    onDismiss={handleDismiss}
    onLogPeriod={goToLogPeriod}
  />
)}
```

### 5. Show banner in `CycleDashboardScreen`

**File:** `mobile/src/screens/cycle/CycleDashboardScreen.tsx`

After the StickyCard/EndDatePromptCard section (~line 175), add the same `DelayedBanner` render.

---

## File Change Summary

| # | File | Change |
|---|------|--------|
| 1 | `backend/app/modules/cycle/services.py` | Window P-3→P+5; add `apply_correction_if_needed()` helper; update `log_correction()` and `_try_auto_link_prediction()` to use it |
| 2 | `backend/app/modules/cycle/models.py` | Add `correction_delta` column |
| 3 | `backend/app/modules/cycle/schemas.py` | Add `correction_delta` to responses |
| 4 | `backend/alembic/versions/..._correction_delta.py` | Migration |
| 5 | `mobile/src/components/ui/StickyCard.tsx` | Phase-aware message + delay-phase quick-select chips |
| 6 | `mobile/src/hooks/usePeriodCheckIn.ts` | Compute `checkinPhase` + `daysOffset` + `isExpired` |
| 7 | `mobile/src/components/ui/DelayedBanner.tsx` | New: P+6+ banner (soft amber styling) |
| 8 | `mobile/src/components/home/CheckInCard.tsx` | Show banner + pass new props to StickyCard |
| 9 | `mobile/src/screens/cycle/CycleDashboardScreen.tsx` | Show banner |

---

## Validation Checklist

- [ ] `needs_checkin` is true for P-3 through P+5 only
- [ ] Card message changes at P-3, P+0, and P+1
- [ ] Confirm button shows today's date in expectation & day-of phases
- [ ] **Delay phase (P+1 to P+5):** quick-select chips appear ("Today", "Yesterday", "2 days ago", "3 days ago")
- [ ] **Delay phase:** confirm button text changes dynamically based on chip selection
- [ ] **Delay phase:** "No, adjust date" still available for custom date picker
- [ ] Card disappears at P+6
- [ ] Delayed banner appears at P+6+ with soft amber styling
- [ ] Banner is dismissible (persisted in AsyncStorage)
- [ ] "Log Period" button uses outline variant (not primary)
- [ ] "Log Period" button navigates to calendar
- [ ] `correction_delta` is stored on CycleEntry via ALL 3 paths:
  - [ ] `log_correction()` — Sticky Card + Calendar "Start Period"
  - [ ] `_try_auto_link_prediction()` — LogPeriodScreen auto-link
  - [ ] `create_entry()` IntegrityError path — also triggers auto-link
- [ ] `correction_delta` appears in API responses (CycleEntryResponse + CorrectionResponse)
- [ ] Shared `apply_correction_if_needed()` helper used by all paths
- [ ] Migration is reversible
- [ ] TypeScript compiles cleanly
- [ ] Existing tests pass
