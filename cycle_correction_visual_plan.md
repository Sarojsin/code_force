# Cycle Period Correction & Re-adjustment — Implementation Plan

> Based on `cycle_readjust_retrain.txt` vs current codebase analysis (July 2026)

---

## Status Summary

| Area | Backend | Mobile |
|------|---------|--------|
| Correction API (`POST /cycle/corrections`) | ✅ Done | ✅ Hook + service done |
| Snooze API (`POST /cycle/snooze`) | ✅ Done | ✅ Hook + service done |
| Prediction linking (actual→predicted) | ✅ Done | N/A |
| `avg_prediction_error_days` | ✅ Done | N/A |
| `is_dirty_for_retraining` | ✅ Done | N/A |
| `cycle_length_std_dev` | ✅ Done | N/A |
| P-3 push notification task | ✅ Done | N/A |
| Training pipeline (XGBoost) | ✅ Script exists | N/A |
| Celery beat schedule (daily/monthly) | ⚠️ Commented out in `celery_app.py` | N/A |
| Idempotency-Key on cycle mutations | ❌ Not sent from mobile | ❌ |
| Auto-link on normal period log (±5 days) | ❌ Not implemented | N/A |
| Optimistic calendar cache update | ⚠️ Partial (`_optimistic: true` marker only) |
| "Cancelled" day type (grey/strikethrough) | ❌ No `c` code | ❌ Not in `Calendar.tsx` |
| 4-phase cycle calculation (O/o, L/l codes) | ❌ Missing formula | ❌ Missing renderer |
| StickyCard DatePicker `control={null}` | N/A | ❌ **Bug** |
| CalendarScreen uses TanStack Query | N/A | ❌ Uses local `useState` |
| History/Analytics real data | ✅ Backend ready | ❌ Mock data |
| 4-phase "rollover" visualization | ❌ Not implemented | ❌ Not implemented |

---

## 4-Phase Cycle Calculation (Universal Formula)

The entire calendar encoding depends on this formula. It is used by **both** the backend `get_calendar()` and the mobile `useLogCorrection` optimistic update.

**Inputs:** `period_start` (date), `cycle_length` (int), `period_length` (int, default 5)

**Formula:**

| Phase | Start | End | Color Code |
|-------|-------|-----|-----------|
| Menstrual (Period) | `period_start` | `period_start + period_length - 1` | `P` (confirmed) / `p` (predicted) |
| Follicular | `period_end + 1` | `ovulation_date - 1` | (no dedicated code — between P and O) |
| Ovulation | `period_start + cycle_length - 14` | (single day) | `O` (confirmed) / `o` (predicted) |
| Fertile Window | `ovulation_date - 5` | `ovulation_date + 1` | `F` (confirmed) / `f` (predicted) |
| Luteal | `ovulation_date + 1` | `next_period_start - 1` | `L` (confirmed) / `l` (predicted) |
| Next Period | `period_start + cycle_length` | — | — |

**Key invariant:** The luteal phase is always ~14 days. Ovulation = `start + (cycle_length - 14)`.

**Edge cases in `calculateCyclePhases()`:**
- If `cycle_length < 20` or `cycle_length > 45`, the formula still works but ovulation may fall outside the expected range. **Add a clamp:** `ovulation_date = max(period_start + 10, min(period_start + 40, ovulation_date))`
- If `period_length` is not available (user hasn't logged enough data), default to 5. But if the user has existing `cycle_entries` with logged period lengths, compute the average from their own data and use that instead.

### Backend implementation (`app/modules/cycle/phase_utils.py`)

```python
from datetime import date, timedelta

def calculate_cycle_phases(
    period_start: date,
    cycle_length: int,
    period_length: int = 5,
) -> dict:
    """Returns phase date ranges for a given cycle.
    Formula: ovulation = start + (cycle_length - 14)
    """
    period_end = period_start + timedelta(days=period_length - 1)
    ovulation_date = period_start + timedelta(days=cycle_length - 14)
    fertile_start = ovulation_date - timedelta(days=5)
    fertile_end = ovulation_date + timedelta(days=1)
    next_period_start = period_start + timedelta(days=cycle_length)
    follicular_start = period_end + timedelta(days=1)
    follicular_end = ovulation_date - timedelta(days=1)
    luteal_start = ovulation_date + timedelta(days=1)
    luteal_end = next_period_start - timedelta(days=1)

    return {
        "period": {"start": period_start, "end": period_end},
        "follicular": {"start": follicular_start, "end": follicular_end},
        "ovulation": {"date": ovulation_date},
        "fertile_window": {"start": fertile_start, "end": fertile_end},
        "luteal": {"start": luteal_start, "end": luteal_end},
        "next_period": next_period_start,
    }
```

### Mobile implementation (`mobile/src/utils/cyclePhases.ts`)

```typescript
import { addDays } from 'date-fns';

export function calculateCyclePhases(
  periodStart: Date,
  cycleLength: number,
  periodLength: number = 5,
): CyclePhases {
  const periodEnd = addDays(periodStart, periodLength - 1);
  const ovulationDate = addDays(periodStart, cycleLength - 14);
  const fertileStart = addDays(ovulationDate, -5);
  const fertileEnd = addDays(ovulationDate, 1);
  const nextPeriodStart = addDays(periodStart, cycleLength);
  const follicularStart = addDays(periodEnd, 1);
  const follicularEnd = addDays(ovulationDate, -1);
  const lutealStart = addDays(ovulationDate, 1);
  const lutealEnd = addDays(nextPeriodStart, -1);

  return {
    period: { start: periodStart, end: periodEnd },
    follicular: { start: follicularStart, end: follicularEnd },
    ovulation: { date: ovulationDate },
    fertile_window: { start: fertileStart, end: fertileEnd },
    luteal: { start: lutealStart, end: lutealEnd },
    nextPeriod: nextPeriodStart,
  };
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface CyclePhases {
  period: DateRange;
  follicular: DateRange;
  ovulation: { date: Date };
  fertile_window: DateRange;
  luteal: DateRange;
  nextPeriod: Date;
}
```

---

## Render Priority in `get_calendar()` (Backend — Critical Gap 1)

### Why priority matters

A single calendar day can fall into **multiple** phase ranges simultaneously. For example, the fertile window (`ovulation_date - 5` to `ovulation_date + 1`) often overlaps with the late follicular phase. Without a strict priority rule, the calendar would show conflicting colors for the same day.

**Priority rule:** The first matching phase wins. Assign numeric weights:

```python
PHASE_PRIORITY = {
    "period": 1,       # Highest — if it's a period day, nothing else matters
    "cancelled": 2,    # Corrected prediction — grey it out
    "fertile": 3,      # Fertile window beats ovulation and luteal
    "ovulation": 4,    # Ovulation day beats luteal
    "luteal": 5,       # Lowest — only shows if no other phase applies
}
```

**How ranges must be built:**
- Build ALL confirmed ranges first (from `CycleEntry` records + `calculate_cycle_phases()`)
- Then build ALL predicted ranges (from `PredictedCycle` records + `calculate_cycle_phases()`)
- Then iterate each day once, checking ranges in priority order

**Never assign two codes to the same day. The first `if/elif` match wins and we `continue` to the next day.**

### Day-iteration code

```python
for day in all_days:
    key = day.isoformat()

    # Priority order (first match wins, then skip to next day):
    if any(s <= day <= e for s, e in confirmed_period_ranges):
        days[key] = "P"        # 1. Confirmed period
    elif any(s <= day <= e for s, e in cancelled_pred_ranges):
        days[key] = "c"        # 2. Cancelled prediction
    elif any(s <= day <= e for s, e in unlinked_pred_ranges):
        days[key] = "p"        # 3. Unlinked prediction
    elif any(s <= day <= e for s, e in confirmed_fertile_ranges):
        days[key] = "F"        # 4. Confirmed fertile
    elif any(s <= day <= e for s, e in predicted_fertile_ranges):
        days[key] = "f"        # 5. Predicted fertile
    elif any(s <= day <= e for s, e in confirmed_ovulation_ranges):
        days[key] = "O"        # 6. Confirmed ovulation
    elif any(s <= day <= e for s, e in predicted_ovulation_ranges):
        days[key] = "o"        # 7. Predicted ovulation
    elif any(s <= day <= e for s, e in confirmed_luteal_ranges):
        days[key] = "L"        # 8. Confirmed luteal
    elif any(s <= day <= e for s, e in predicted_luteal_ranges):
        days[key] = "l"        # 9. Predicted luteal
    elif key == today_str:
        days[key] = "T"        # 10. Today
```

**How ranges are built:**

| Range Variable | Source |
|---------------|--------|
| `confirmed_period_ranges` | `CycleEntry` records (period_start_date → period_end_date) |
| `cancelled_pred_ranges` | `PredictedCycle` with `actual_cycle_entry_id IS NOT NULL` (use `calculate_cycle_phases()` to get period range, then fall through to `c`) |
| `unlinked_pred_ranges` | `PredictedCycle` with `actual_cycle_entry_id IS NULL` |
| `confirmed_*_ranges` | For each confirmed period, use `calculate_cycle_phases()` with `avg_cycle_length` to derive all 4 phases. Mark as **dark** codes. |
| `predicted_*_ranges` | For each unlinked prediction, use `calculate_cycle_phases()` with `avg_cycle_length`. Mark as **light** codes. |

**Rollover rule:** For a single user query, you may have multiple cycles overlapping the queried range. Process ALL confirmed periods first (they're real), then unlinked/cancelled predictions (they're projections). The priority order handles overlaps correctly — confirmed real data always beats predicted data.

---

## Mobile Optimistic Update — Full Calendar Transform (Critical Gap 3)

The current `useLogCorrection` mutation only sets `{ _correction: variables, _optimistic: true }` — it does not actually transform the days map. The user sees no visual change until the server responds.

**Replace `onMutate` with full phase recalculation:**

```typescript
onMutate: async (variables) => {
  await qc.cancelQueries({ queryKey: cycleKeys.calendar });
  const previousCalendar = qc.getQueryData(cycleKeys.calendar);

  qc.setQueryData(cycleKeys.calendar, (old: CalendarResponse | undefined) => {
    if (!old?.days) return old;
    const newDays = { ...old.days };
    const predictions = old.predictions;
    const periodLength = 5;

    // === cycle_length source (priority order) ===
    // 1. Local avg_cycle_length from cache or authStore
    // 2. predictions cycle length (if available)
    // 3. Fallback to 28
    const cycleLength = old.avg_cycle_length
      ?? (predictions?.predicted_next_period_start
        ? computeCycleLengthFromPredictions(predictions, old.days)
        : null)
      ?? 28;

    // === Step 1: Cancel old predicted period range ===
    if (predictions?.id) {
      const oldStart = new Date(predictions.predicted_next_period_start);
      for (let d = 0; d < periodLength; d++) {
        const dateStr = format(addDays(oldStart, d), 'yyyy-MM-dd');
        if (newDays[dateStr] === 'p' || newDays[dateStr] === 'P') {
          newDays[dateStr] = 'c';
        }
      }
    }

    // === Step 2: Add new confirmed period days ===
    const newStart = new Date(variables.period_start_date);
    for (let d = 0; d < periodLength; d++) {
      const dateStr = format(addDays(newStart, d), 'yyyy-MM-dd');
      newDays[dateStr] = 'P';
    }

    // === Step 3: Apply confirmed phases for this cycle ===
    const confirmedPhases = calculateCyclePhases(newStart, cycleLength, periodLength);
    applyPhaseToDays(newDays, confirmedPhases, true); // true = dark codes (P, F, O, L)

    // === Step 4: Generate next predicted cycle ===
    const nextStart = confirmedPhases.nextPeriod;
    const nextPhases = calculateCyclePhases(nextStart, cycleLength, periodLength);
    applyPhaseToDays(newDays, nextPhases, false); // false = light codes (p, f, o, l)

    return {
      ...old,
      days: newDays,
      next_period_in_days: cycleLength,
    };
  });

  return { previousCalendar };
},
```

With this helper:

```typescript
function applyPhaseToDays(
  days: Record<string, string>,
  phases: CyclePhases,
  confirmed: boolean,
): void {
  const periodCode = confirmed ? 'P' : 'p';
  const fertileCode = confirmed ? 'F' : 'f';
  const ovulationCode = confirmed ? 'O' : 'o';
  const lutealCode = confirmed ? 'L' : 'l';

  // Period (already set in step 2, skip to avoid overwrite)
  // Fertile window
  forEachDay(phases.fertile_window.start, phases.fertile_window.end, (dateStr) => {
    if (!days[dateStr]) days[dateStr] = fertileCode;
  });
  // Ovulation day
  const ovStr = format(phases.ovulation.date, 'yyyy-MM-dd');
  if (!days[ovStr]) days[ovStr] = ovulationCode;
  // Luteal
  forEachDay(phases.luteal.start, phases.luteal.end, (dateStr) => {
    if (!days[dateStr]) days[dateStr] = lutealCode;
  });
}
```

---

## Phase 1 — Fix Existing Bugs

### 1.1 StickyCard DatePickerField — `control={null}`
**File:** `mobile/src/components/ui/StickyCard.tsx`

**Problem:** `DatePickerField` receives `control={null as any}`, which crashes the Controller. The `selectedDate` state is never wired to the picker.

**Fix:** Replace with proper `useForm` + `zodResolver`:
```tsx
const adjustSchema = z.object({ adjustDate: z.string().min(1) });
const { control, handleSubmit } = useForm({
  resolver: zodResolver(adjustSchema),
  defaultValues: { adjustDate: toDateStr(new Date()) },
});
```
Remove `selectedDate` state. Use `handleSubmit((data) => onAdjust(predictionId, data.adjustDate))` on Confirm button.

### 1.2 Send `Idempotency-Key` + `X-Client-Updated-At` headers
**File:** `mobile/src/services/api/cycle.ts`

**Problem:** Only `safety` module sends `Idempotency-Key`. Cycle corrections need it for deduplication (spec §8). `X-Client-Updated-At` needed for conflict resolution (Phase 5).

**Fix:** Add optional `idempotencyKey?: string` and `clientUpdatedAt?: string` params to `logCorrection()`, pass as HTTP headers:

```typescript
async logCorrection(
  data: CorrectionData,
  idempotencyKey?: string,
  clientUpdatedAt?: string,
) {
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (clientUpdatedAt) headers['X-Client-Updated-At'] = clientUpdatedAt;
  const res = await api.post('/cycle/corrections', data, { headers });
  return unwrap(res);
}
```

In `useLogCorrection` mutationFn:
```typescript
mutationFn: (data) => cycleService.logCorrection(
  data,
  generateId(),
  new Date().toISOString(),
),
```

### 1.3 Enable Celery beat schedule
**File:** `backend/app/core/celery_app.py`

**Problem:** `update_cycle_predictions` (daily) and `train_global_model` (monthly) tasks exist but beat entries are commented out.

**Fix:** Uncomment and register:
```python
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    "update-cycle-predictions": {
        "task": "app.modules.cycle.tasks.update_cycle_predictions",
        "schedule": crontab(hour=2, minute=0),
    },
    "train-global-model": {
        "task": "app.modules.cycle.tasks.train_global_model",
        "schedule": crontab(day=1, hour=3, minute=0),
    },
}
celery_app.conf.timezone = "UTC"
```

---

## Phase 2 — Auto-Link on Normal Period Log (Backend)

### 2.1 Auto-detect correction in `create_entry()`
**File:** `backend/app/modules/cycle/services.py` + `app/core/config.py`

When user logs a period normally (POST `/cycle/entries`) and an uncorrected `PredictedCycle` exists within `auto_link_window_days`, auto-link as silent correction.

**Config-driven (no magic numbers):**
```python
# app/core/config.py
class CycleSettings(BaseSettings):
    auto_link_window_days: int = 5       # ±days window for auto-link
    period_default_length: int = 5       # default period length if unknown
```

The window is referenced from config, not hardcoded. This allows tuning per-deployment without touching code logic.

**New helper in `services.py`:**
```python
async def _find_active_prediction(self, user_id, start_date):
    from app.core.config import settings
    window = settings.CYCLE.AUTO_LINK_WINDOW_DAYS
    stmt = select(PredictedCycle).where(
        PredictedCycle.user_id == user_id,
        PredictedCycle.is_active.is_(True),
        PredictedCycle.actual_cycle_entry_id.is_(None),
        PredictedCycle.predicted_next_period_start.between(
            start_date - timedelta(days=window),
            start_date + timedelta(days=window),
        ),
    ).order_by(PredictedCycle.predicted_next_period_start.desc())
    result = await self.db.execute(stmt)
    return result.scalar_one_or_none()
```

Called at end of `create_entry()` after flush:
```python
prediction = await self._find_active_prediction(user_id, entry.period_start_date)
if prediction:
    error = (entry.period_start_date - prediction.predicted_next_period_start).days
    prediction.actual_cycle_entry_id = entry.id
    prediction.prediction_error_days = error
    entry.is_correction = True
    entry.corrected_prediction_id = prediction.id
    await self._update_user_ml_metrics(user_id, error)
```

---

## Phase 3 — Calendar Encoding Expansion

### 3.1 Backend: New codes + 4-phase calculation in `get_calendar()`
**File:** `backend/app/modules/cycle/services.py` (and new `phase_utils.py`)

**New codes with confirmed/predicted distinction:**

| Code | Meaning | Color |
|------|---------|-------|
| `c` | Cancelled prediction (superseded by correction) | Grey `#D4A5B5` |
| `P` | Confirmed period | Dark pink `#FF6B8A` |
| `p` | Predicted period | Light pink `#FFB3C6` |
| `F` | Confirmed fertile | Deep lavender `#8A6E9B` |
| `f` | Predicted fertile | Light lavender `#E8D5F5` |
| `O` | Confirmed ovulation | Deep lavender `#8A6E9B` |
| `o` | Predicted ovulation | Light lavender `#E8D5F5` |
| `L` | Confirmed luteal | Warm cream `#FFF8F0` |
| `l` | Predicted luteal | Pale yellow `#FFFDE7` |

**How `get_calendar()` builds the day map (revised):**

1. Fetch all `CycleEntry` records in range → build `confirmed_period_ranges`
2. Fetch all `PredictedCycle` records in range → split into `cancelled_pred_ranges` (has `actual_cycle_entry_id`) and `unlinked_pred_ranges` (no link)
3. For each confirmed period range, call `calculate_cycle_phases()` with `avg_cycle_length` to get fertile/ovulation/luteal ranges → build `confirmed_*_ranges`
4. For each unlinked prediction, call `calculate_cycle_phases()` with `avg_cycle_length` → build `predicted_*_ranges`
5. For each cancelled prediction, call `calculate_cycle_phases()` → only period range matters (renders as `c`)
6. Iterate all days with priority order (see Render Priority above)

### 3.2 Update `Calendar.tsx` colors (Mobile)
**File:** `mobile/src/components/ui/Calendar.tsx`

```typescript
const DAY_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  P: { bg: '#FF6B8A', text: '#FFFFFF' },        // confirmed period
  p: { bg: '#FFB3C6', text: '#C62828' },         // predicted period
  F: { bg: '#8A6E9B', text: '#FFFFFF' },          // confirmed fertile
  f: { bg: '#E8D5F5', text: '#7B1FA2' },          // predicted fertile
  O: { bg: '#8A6E9B', text: '#FFFFFF' },          // confirmed ovulation
  o: { bg: '#E8D5F5', text: '#7B1FA2' },          // predicted ovulation
  L: { bg: '#FFF8F0', text: '#1A1D26' },           // confirmed luteal
  l: { bg: '#FFFDE7', text: '#1A1D26' },           // predicted luteal
  c: { bg: '#D4A5B5', text: '#888888' },           // cancelled prediction
  T: { bg: '#42A5F5', text: '#FFFFFF' },           // today marker
};
```

For `c` type, render with opacity 0.5 + strikethrough:
```typescript
if (dayType === 'c') {
  return (
    <Pressable ... style={[..., { opacity: 0.5 }]}>
      <Text variant="body" align="center"
        style={{ color: '#888', textDecorationLine: 'line-through' }}>
        {format(day, 'd')}
      </Text>
    </Pressable>
  );
}
```

### 3.3 Align `CalendarScreen.tsx` color mapping
**File:** `mobile/src/screens/calendar/CalendarScreen.tsx`

Remove `PHASE_COLORS` map and `DAY_TYPE_MAP`. Use the same `DAY_TYPE_COLORS` scheme from `Calendar.tsx`. Import the shared constant or define it locally.

---

## Phase 4 — Optimistic Calendar Update on Correction

### 4.1 Transform cache in `useLogCorrection` `onMutate`
**File:** `mobile/src/services/queries/cycle.ts`

Full implementation described in Critical Gap 3 section above. Key actions:
1. Cancel outgoing calendar queries
2. Snapshot previous cache for rollback
3. Mark old predicted dates as `c`
4. Set new dates as `P`
5. Call `calculateCyclePhases()` for confirmed cycle → apply `F`, `O`, `L` codes
6. Call `calculateCyclePhases()` for next predicted cycle → apply `f`, `o`, `l` codes
7. Update `next_period_in_days`
8. Return `{ previousCalendar }` for rollback

### 4.2 Spring animation on corrected date
Pass `animatingDates?: Set<string>` prop to `Calendar` component. Dates in this set animate with:
```typescript
const animatedStyle = animatingDates?.has(dateStr)
  ? { transform: [{ scale: withSpring(1, { from: 0.8, damping: 12 }) }] }
  : {};
```

In `CycleDashboardScreen`, after correction mutation succeeds, add the corrected date to the `animatingDates` set:
```typescript
onSuccess: () => {
  setAnimatingDates(new Set([variables.period_start_date]));
  // ... toast, invalidation ...
},
```

### 4.3 Success toast
```typescript
onSuccess: (data, variables) => {
  Toast.show({
    type: 'success',
    text1: `Period corrected to ${variables.period_start_date}`,
    visibilityTime: 2000,
  });
  // ... invalidation ...
},
```

---

## Phase 5 — Conflict Resolution (Server 409)

### 5.1 Mobile 409 handler
**File:** `mobile/src/services/queries/cycle.ts`

In `onError`, before network-error check:
```typescript
if (axios.isAxiosError(error) && error.response?.status === 409) {
  const serverData = error.response.data?.server_data;
  if (serverData) {
    qc.setQueryData(cycleKeys.calendar, (old: any) => {
      if (!old?.days) return old;
      const newDays = { ...old.days };
      const start = new Date(serverData.period_start_date);
      const end = serverData.period_end_date
        ? new Date(serverData.period_end_date)
        : addDays(start, 4);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        newDays[format(d, 'yyyy-MM-dd')] = 'P';
      }
      return { ...old, days: newDays, _conflict_resolved: true };
    });
    Toast.show({ type: 'info', text1: 'Updated from another device', visibilityTime: 3000 });
  }
  return; // Don't retry, don't queue offline
}
```

### 5.2 Server 409 response
**File:** `backend/app/modules/cycle/services.py` + `routes.py`

Add `client_updated_at: datetime | None` parameter to `log_correction()`. Before creating new entry, check for existing entry with newer `updated_at`:

```python
existing = await self.db.execute(
    select(CycleEntry).where(
        CycleEntry.user_id == user_id,
        CycleEntry.period_start_date == period_start_date,
        CycleEntry.is_active.is_(True),
    )
).scalar_one_or_none()

if existing and client_updated_at:
    existing_updated = existing.updated_at.replace(tzinfo=timezone.utc)
    client_time = client_updated_at.replace(tzinfo=timezone.utc)
    if existing_updated > client_time:
        raise ConflictError(
            message="Server has newer data",
            server_data={
                "period_start_date": existing.period_start_date.isoformat(),
                "period_end_date": existing.period_end_date.isoformat() if existing.period_end_date else None,
            }
        )
```

Route reads `X-Client-Updated-At` header:
```python
@router.post("/corrections", status_code=201)
async def log_period_correction(
    body: CorrectionCreate,
    current_user: CurrentUser,
    svc: CycleServiceDep,
    request: Request,
):
    client_updated_at = request.headers.get("X-Client-Updated-At")
    try:
        result = await svc.log_correction(
            user_id=current_user.id,
            period_start_date=body.period_start_date,
            period_end_date=body.period_end_date,
            symptoms=body.symptoms,
            corrected_prediction_id=body.corrected_prediction_id,
            client_updated_at=datetime.fromisoformat(client_updated_at) if client_updated_at else None,
        )
        return {"data": CorrectionResponse.model_validate(result), "message": "Correction logged"}
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=e.server_data)
```

---

## Phase 6 — 4-Phase "Rollover" After Correction

### 6.1 Lock-in + compute next prediction
**File:** `backend/app/modules/cycle/services.py`

Append to the end of `log_correction()` (after `_update_user_ml_metrics`):
```python
# Generate next predicted cycle immediately
await self.compute_predictions(user_id)
```

This ensures the next `GET /cycle/calendar` response includes the new predicted cycle with all 4 phases in light codes.

### 6.2 Stat card instant update
The "Next period in X days" stat reads `next_period_in_days` from `useCycleCalendar()` response. With Phase 4.1, the optimistic update sets this value immediately. No additional work needed.

---

## Phase 7 — Clean Up Inconsistent Data Fetching

### 7.1 CalendarScreen → `useCycleCalendar()`
**File:** `mobile/src/screens/calendar/CalendarScreen.tsx`

Replace:
```typescript
const [encodedDays, setEncodedDays] = useState({});
const [loading, setLoading] = useState(true);
const fetchData = useCallback(async () => { ... }, []);
useEffect(() => { fetchData(); }, [fetchData]);
```

With:
```typescript
const { data: calData, isLoading } = useCycleCalendar(3, 3);
const encodedDays = calData?.days ?? {};
```

### 7.2 HomeDashboardScreen → `useCycleCalendar()`
Same pattern as 7.1.

### 7.3 CycleHistoryScreen → real data
Replace `MOCK_CYCLES` with `useCycleEntries()`.

### 7.4 CycleAnalyticsScreen → real data
Replace `MOCK_STATS` with `useCycleAnalytics()`.

---

## Phase 8 — Pre-existing TypeScript Fixes

### 8.1 `StyleSheet.absoluteFillObject` → `absoluteFill`
- `CelebrationAnimation.tsx:64`
- `Loader.tsx:40`
- `SplashScreen.tsx:153`

### 8.2 Unused variable cleanup (TS6133 errors)
BottomSheet, ErrorBoundary, PredictionDetailCard, StickyCard, MainTabs, MenstrualPhasesScreen, etc.

---

## Execution Notes

| # | Note | Phase | Action |
|---|------|-------|--------|
| 1 | Idempotency-Key generation | 1 | Use `generateId()` consistently across cycle, wellness, safety. Consider a `withIdempotency()` shared wrapper utility |
| 2 | `client_updated_at` format | 1 | `new Date().toISOString()` — server parses via `datetime.fromisoformat()`. Must be set at the **moment of the correction action** (user tap), not at the moment of sync. This ensures the server can accurately determine which version is newer during conflict resolution |
| 3 | Auto-link window configurable | 2 | `auto_link_window_days = 5` in `config.py` (`CycleSettings`), imported by services. Makes future tuning easy without touching code logic |
| 4 | Celery beat timezone | 1 | Set `celery_app.conf.timezone = "UTC"` in `celery_app.py` |
| 5 | CalendarScreen query keys | 7 | Use `['cycle', 'calendar', monthsBack, monthsForward]` (already the pattern) to ensure cache invalidation when month range changes |
| 6 | Phase formula as shared utility | 3 | Extract `calculate_cycle_phases()` into `app/modules/cycle/phase_utils.py` — used by both `get_calendar()` and `log_correction()` |
| 7 | Mobile phase calculator as shared util | 4 | Extract `calculateCyclePhases()` into `mobile/src/utils/cyclePhases.ts` — used by `useLogCorrection` optimistic update, can be unit-tested independently |
| 8 | `calculateCyclePhases()` edge case — ovulation clamp | 3 | If `cycle_length < 20` or `cycle_length > 45`, clamp ovulation date: `ovulation_date = max(period_start + 10, min(period_start + 40, ovulation_date))`. The formula still works but bounds prevent absurd dates |
| 9 | `period_length` default from user data | 3 | Use 5 as default. But if the user has existing `cycle_entries` with logged period lengths, compute the average from their own data and use that instead. This handles users with consistently 4-day or 7-day periods |
| 10 | Mobile `cycle_length` source | 4 | Priority chain for optimistic update: (1) local cached `avg_cycle_length` from authStore or calendar response, (2) compute from predictions object, (3) fallback to 28 |

---

## Missing File Sections (What Each File Must Contain)

### `mobile/src/utils/cyclePhases.ts` — Phase Calculator Utility

```typescript
import { addDays } from 'date-fns';

// === Types ===
export interface DateRange {
  start: Date;
  end: Date;
}

export interface CyclePhases {
  period: DateRange;
  follicular: DateRange;
  ovulation: { date: Date };
  fertile_window: DateRange;
  luteal: DateRange;
  nextPeriod: Date;
}

// === Main function ===
export function calculateCyclePhases(
  periodStart: Date,
  cycleLength: number,
  periodLength: number = 5,
): CyclePhases {
  const periodEnd = addDays(periodStart, periodLength - 1);
  // Clamp ovulation date to prevent absurd values for extreme cycle lengths
  let ovulationDate = addDays(periodStart, cycleLength - 14);
  const minOv = addDays(periodStart, 10);
  const maxOv = addDays(periodStart, 40);
  if (ovulationDate < minOv) ovulationDate = minOv;
  if (ovulationDate > maxOv) ovulationDate = maxOv;

  const fertileStart = addDays(ovulationDate, -5);
  const fertileEnd = addDays(ovulationDate, 1);
  const nextPeriodStart = addDays(periodStart, cycleLength);
  const follicularStart = addDays(periodEnd, 1);
  const follicularEnd = addDays(ovulationDate, -1);
  const lutealStart = addDays(ovulationDate, 1);
  const lutealEnd = addDays(nextPeriodStart, -1);

  return {
    period: { start: periodStart, end: periodEnd },
    follicular: { start: follicularStart, end: follicularEnd },
    ovulation: { date: ovulationDate },
    fertile_window: { start: fertileStart, end: fertileEnd },
    luteal: { start: lutealStart, end: lutealEnd },
    nextPeriod: nextPeriodStart,
  };
}
```

### `mobile/src/components/ui/Calendar.tsx` — Phase Code Renderer

**Add to the `DAY_TYPE_COLORS` constant:**

```typescript
const DAY_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  P: { bg: '#FF6B8A', text: '#FFFFFF' },        // confirmed period
  p: { bg: '#FFB3C6', text: '#C62828' },         // predicted period
  F: { bg: '#8A6E9B', text: '#FFFFFF' },          // confirmed fertile
  f: { bg: '#E8D5F5', text: '#7B1FA2' },          // predicted fertile
  O: { bg: '#8A6E9B', text: '#FFFFFF' },          // confirmed ovulation
  o: { bg: '#E8D5F5', text: '#7B1FA2' },          // predicted ovulation
  L: { bg: '#FFF8F0', text: '#1A1D26' },           // confirmed luteal
  l: { bg: '#FFFDE7', text: '#1A1D26' },           // predicted luteal
  c: { bg: '#D4A5B5', text: '#888888' },           // cancelled prediction
  T: { bg: '#42A5F5', text: '#FFFFFF' },           // today marker
};
```

**Add `c`-type special rendering inside the day cell loop:**

```typescript
if (dayType === 'c') {
  return (
    <Pressable
      key={dayIdx}
      onPress={() => inMonth && !disabled && onDateSelect(day)}
      disabled
      accessibilityLabel={`${format(day, 'MMMM d, yyyy')} cancelled`}
      style={[
        styles.dayCell,
        { minHeight: theme.minTouchTarget, minWidth: theme.minTouchTarget },
        { backgroundColor: '#D4A5B5', borderRadius: theme.radius.pill, opacity: 0.5 },
      ]}
    >
      <Text variant="body" align="center"
        style={{ color: '#888', textDecorationLine: 'line-through' }}>
        {format(day, 'd')}
      </Text>
    </Pressable>
  );
}
```

**Add `animatingDates` prop to `CalendarProps`:**

```typescript
export interface CalendarProps {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  markedDates?: Date[];
  minDate?: Date;
  maxDate?: Date;
  encodedDays?: Record<string, string>;
  animatingDates?: Set<string>;       // <-- ADD
}
```

Apply spring animation inside the day loop:

```typescript
const shouldAnimate = animatingDates?.has(dateStr);
const animatedStyle = shouldAnimate
  ? { transform: [{ scale: withSpring(1, { from: 0.8, damping: 12 }) }] }
  : {};
// Apply to the Pressable's style: [...base, animatedStyle]
```

### `mobile/src/services/queries/cycle.ts` — Optimistic Update in `useLogCorrection`

**Replace the current `onMutate` with the full rollover logic. Key sections to add:**

1. **`cycle_length` source priority:**
```typescript
const cycleLength = old.avg_cycle_length
  ?? (predictions?.predicted_next_period_start
    ? computeCycleLengthFromPredictions(predictions, old.days)
    : null)
  ?? 28;
```

2. **Cancel old predicted period range (mark as `c`):**
```typescript
if (predictions?.id) {
  const oldStart = new Date(predictions.predicted_next_period_start);
  for (let d = 0; d < periodLength; d++) {
    const dateStr = format(addDays(oldStart, d), 'yyyy-MM-dd');
    if (newDays[dateStr] === 'p' || newDays[dateStr] === 'P') {
      newDays[dateStr] = 'c';
    }
  }
}
```

3. **Add new confirmed period days (`P`):**
```typescript
const newStart = new Date(variables.period_start_date);
for (let d = 0; d < periodLength; d++) {
  const dateStr = format(addDays(newStart, d), 'yyyy-MM-dd');
  newDays[dateStr] = 'P';
}
```

4. **Apply confirmed phases via `calculateCyclePhases()` + `applyPhaseToDays()`:**
```typescript
const confirmedPhases = calculateCyclePhases(newStart, cycleLength, periodLength);
applyPhaseToDays(newDays, confirmedPhases, true);
```

5. **Generate next predicted cycle (light codes):**
```typescript
const nextStart = confirmedPhases.nextPeriod;
const nextPhases = calculateCyclePhases(nextStart, cycleLength, periodLength);
applyPhaseToDays(newDays, nextPhases, false);
```

6. **`applyPhaseToDays` helper (respects priority — never overwrites an assigned day):**
```typescript
function applyPhaseToDays(
  days: Record<string, string>,
  phases: CyclePhases,
  confirmed: boolean,
): void {
  const fertileCode = confirmed ? 'F' : 'f';
  const ovulationCode = confirmed ? 'O' : 'o';
  const lutealCode = confirmed ? 'L' : 'l';

  // Apply in priority order: fertile > ovulation > luteal
  // Use `if (!days[dateStr])` to never overwrite a higher-priority code
  forEachDay(phases.fertile_window.start, phases.fertile_window.end, (dateStr) => {
    if (!days[dateStr]) days[dateStr] = fertileCode;
  });
  const ovStr = format(phases.ovulation.date, 'yyyy-MM-dd');
  if (!days[ovStr]) days[ovStr] = ovulationCode;
  forEachDay(phases.luteal.start, phases.luteal.end, (dateStr) => {
    if (!days[dateStr]) days[dateStr] = lutealCode;
  });
}
```

7. **409 conflict handler (in `onError`):**
```typescript
if (axios.isAxiosError(error) && error.response?.status === 409) {
  const serverData = error.response.data?.server_data;
  if (serverData) {
    qc.setQueryData(cycleKeys.calendar, (old: any) => {
      if (!old?.days) return old;
      const newDays = { ...old.days };
      const start = new Date(serverData.period_start_date);
      const end = serverData.period_end_date
        ? new Date(serverData.period_end_date)
        : addDays(start, 4);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        newDays[format(d, 'yyyy-MM-dd')] = 'P';
      }
      return { ...old, days: newDays, _conflict_resolved: true };
    });
    Toast.show({ type: 'info', text1: 'Updated from another device', visibilityTime: 3000 });
  }
  return;
}
```

---

## Implementation Order & Dependencies

```
Phase 1 ──── No deps
  ├── 1.1 StickyCard control={null}
  ├── 1.2 Idempotency-Key + X-Client-Updated-At headers
  └── 1.3 Enable Celery beat + timezone

Phase 2 ──── Depends: 1 (config pattern)
  └── 2.1 Auto-link (±5 days) on normal log

Phase 3 ──── Depends: 1 (backend), adds phase_utils.py
  ├── 3.1 Backend: calculate_cycle_phases() in phase_utils.py
  ├── 3.1 Backend: get_calendar() uses new priority + 4-phase math
  ├── 3.2 Mobile: DAY_TYPE_COLORS + c/O/o/L/l rendering
  └── 3.3 Mobile: CalendarScreen alignment

Phase 4 ──── Depends: 3 (mobile needs codes + phase_utils to exist)
  ├── 4.1 useLogCorrection onMutate: full calendar transform
  ├── 4.2 Spring animation (animatingDates set + prop)
  └── 4.3 Success toast

Phase 5 ──── Depends: 1 (headers), 3 (backend conflict route)
  ├── 5.1 Mobile 409 handler
  └── 5.2 Server 409 response (ConflictError + header parsing)

Phase 6 ──── Depends: 3 (phase_utils), 4 (optimistic)
  ├── 6.1 Compute next prediction after correction
  └── 6.2 Stat card instant update (auto via Phase 4)

Phase 7 ──── No critical deps
  └── 7.1–7.4 TanStack Query migration

Phase 8 ──── No deps
  └── 8.1–8.2 TS fixes
```

---

## Verification Checklist

After implementation:
- [ ] StickyCard "Yes": Sets error_days=0, updates avg_error
- [ ] StickyCard "No": Opens date picker, triggers log_correction
- [ ] Manual Adjust: Calendar updates instantly (old greyed `c`, new solid `P`)
- [ ] All 4 phases render: Period (`P`/`p`), Fertile (`F`/`f`), Ovulation (`O`/`o`), Luteal (`L`/`l`)
- [ ] Confirmed vs predicted distinction: dark codes for logged, light codes for predicted
- [ ] Snooze: Logs snooze_event with correct day_offset
- [ ] Offline Correction: Calendar updates instantly, persists to queue, syncs on reconnect
- [ ] Conflict Resolution: Server wins on 409, "Updated from another device" toast
- [ ] `is_dirty_for_retraining`: True after correction
- [ ] Top stat: "Next period in X days" updates instantly
- [ ] Auto-link: Normal period log within ±5 days of prediction auto-links as correction
