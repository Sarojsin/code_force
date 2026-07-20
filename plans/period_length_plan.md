# Period Length Calculation — Consolidation Plan

## Problem Summary

1. **Off-by-one in predictions**: `_predict_with_fallback` uses `(end - start).days` (exclusive), while calendar uses `(end - start).days + 1` (inclusive). Same data produces different lengths.
2. **Dormant crash**: `_predict_with_global_model` line 181 references `e.period_length` — a column that doesn't exist on `CycleEntry`. Crashes when global model path is active and user has ≥3 entries.
3. **Hardcoded +5 in corrections**: Mobile always sends `period_end_date = start + 5 days` for all correction flows (StickyCard "Yes", "No, adjust date", Permanent Override). Ignores user's actual bleeding history.
4. **No single source of truth**: Four different code sites compute period length independently with different formulas.

---

## Step 1 — Create `compute_period_length()` utility

**File:** `backend/app/modules/cycle/phase_utils.py`

Add a shared function that all modules call:

```python
def compute_period_length(start_date: date, end_date: date | None, fallback: int = 5) -> int:
    if end_date:
        return (end_date - start_date).days + 1
    return fallback
```

### Callers to update in `services.py`:

| Location | Current code | Replace with |
|----------|-------------|--------------|
| `_entry_period_length` (line 598) | `(end - start).days + 1` | `compute_period_length(start, end, fallback)` (unchanged result) |
| `_compute_average_period_length` (line 572) | inline `(end - start).days + 1` | `compute_period_length(start, end, 5)` |
| `_predict_with_fallback` (line 265-268) | `(end - start).days` (no +1) | `compute_period_length(start, end, 5)` — **fixes off-by-one** |
| `_predict_with_global_model` (line 181) | `e.period_length or 5` (CRASH) | `compute_period_length(e.period_start_date, e.period_end_date, 5)` — **fixes crash** |

Also add the same function to mobile for consistency:

**File:** `mobile/src/utils/cyclePhases.ts`

```typescript
export function computePeriodLength(startDate: Date, endDate: Date | null, fallback = 5): number {
  if (endDate) return Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  return fallback;
}
```

---

## Step 2 — Fix the hardcoded +5 in corrections

### 2A — Mobile: stop sending `period_end_date`

**File:** `mobile/src/screens/cycle/CycleDashboardScreen.tsx`

Remove `period_end_date` from all three correction mutation calls:

- `handleConfirm` (line 114-123) — remove the `endDate` computation and `period_end_date` field
- `handleAdjust` (line 129-138) — same
- `handlePermanentOverride` (line 154-164) — same

**Result:** The mobile sends only `period_start_date` + `corrected_prediction_id`. The backend owns the duration decision.

**Edge case — `corrected_prediction_id` is null:** This happens when the user uses the "Adjust Period Date" button (permanent override) without a specific prediction selected. The plan's `_compute_smart_end_date` already handles this: the `if corrected_prediction_id is not None` guard skips the original-entry lookup and falls straight to Priority 2 (historical average). Correct behavior.

### 2B — Backend: smart fallback in `log_correction`

**File:** `backend/app/modules/cycle/services.py` (line 680)

Replace the hardcoded `+5` default:

```python
# Old:
period_end_date=period_end_date or (period_start_date + timedelta(days=5)),

# New:
period_end_date=period_end_date or self._compute_smart_end_date(user_id, period_start_date, corrected_prediction_id),
```

Add new method:

```python
async def _compute_smart_end_date(
    self, user_id: uuid.UUID, period_start: date, corrected_prediction_id: uuid.UUID | None,
) -> date:
    # Priority 1: If prediction was previously linked to an entry, reuse its duration
    if corrected_prediction_id is not None:
        pred = await self.get_prediction_by_id(corrected_prediction_id, user_id)
        if pred.actual_cycle_entry_id is not None:
            entry = await self.get_entry(pred.actual_cycle_entry_id, user_id)
            if entry.period_end_date:
                orig_length = (entry.period_end_date - entry.period_start_date).days + 1
                return period_start + timedelta(days=orig_length - 1)

    # Priority 2: Use user's historical average period length
    entries = await self._get_recent_entries(user_id, limit=12)
    avg_length = self._compute_average_period_length(entries)

    # Priority 3: Fallback to 5 days
    return period_start + timedelta(days=max(avg_length, 1) - 1)
```

---

## Step 3 — Update optimistic update (mobile)

**File:** `mobile/src/services/queries/cycle.ts` (onMutate, line 142-146)

The optimistic calendar update computes `periodLength` from the submitted dates. Since the mobile will stop sending `period_end_date`, the `variables.period_end_date` will be `undefined`.

**Refinement:** Instead of hardcoded +5, use the user's average period length from the cached calendar data. The `old` cache object contains confirmed cycle entries — derive an average from them:

```typescript
// Derive avg period length from cached confirmed entries
function estimatePeriodLength(old: any, fallback = 5): number {
  // Check if old data has entries we can compute from
  if (old?.days) {
    // Use last known confirmed period length from the calendar rendering
    // Fall back to the existing predictions' period_end if available
    const hadPrediction = old.predictions?.predicted_period_end;
    if (hadPrediction) {
      const predStart = new Date(old.predictions.predicted_next_period_start + 'T00:00:00');
      const predEnd = new Date(hadPrediction + 'T00:00:00');
      const est = Math.round((predEnd.getTime() - predStart.getTime()) / 86400000) + 1;
      if (est >= 1 && est <= 14) return est;
    }
  }
  return fallback;
}
```

**Why:** This makes the optimistic calendar render closer to the final server result in the brief window before `onSuccess` refetches. Optional — the server always corrects it.

---

## Affected Files Summary

| File | Changes |
|------|---------|
| `backend/app/modules/cycle/phase_utils.py` | Add `compute_period_length()` function |
| `backend/app/modules/cycle/services.py` | 5 callers updated + new `_compute_smart_end_date` method |
| `mobile/src/utils/cyclePhases.ts` | Add `computePeriodLength()` (mirror) |
| `mobile/src/screens/cycle/CycleDashboardScreen.tsx` | Remove `period_end_date` from 3 correction calls |

---

## Verification Checklist

- [ ] `compute_period_length(None)` returns fallback (no crash)
- [ ] `_predict_with_fallback` now uses `+1` — off-by-one fixed for a 5-day entry (Jan 1–Jan 5 → period_length=5 vs previous 4)
- [ ] `_predict_with_global_model` no longer accesses `e.period_length` — crash fixed
- [ ] Correction with no `period_end_date` computes duration from averages instead of hardcoded 5
- [ ] Correction with explicit `period_end_date` still uses the client-provided value (backward compatible)
- [ ] Optimistic calendar update still renders correctly during correction
