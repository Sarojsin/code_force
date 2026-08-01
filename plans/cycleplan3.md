# Cycleplan 3 — Test Matrix & Verification (SheCare Calendar Correctness)

**Scope:** Every new behavior from `cycleplan1.md` and `cycleplan2.md`, with tests and the exact verification commands.
**Status:** Approved for implementation.

---

## Backend tests — `backend/tests/modules/cycle/`

### New file `test_calendar_day_codes.py` (recommended)

**1. Follicular codes (`Fl` / `fl`)**
- Confirmed cycle (start Aug 1, len 28, period 5):
  - `Fl` on `Aug 6 … Aug 10` (`period_end+1 … fertile_start−1`, since fertile_start = Ov−4 = Aug 15−4 = Aug 11).
  - `F` on `Aug 11 … Aug 15`, `O` on `Aug 15` (D1 override), `L` on `Aug 16 … Aug 28`.
- Predicted cycle (active prediction, same math): `fl`, `f`, `o`, `l` on the same relative days.
- Short cycle guard: cycle_length 21 → follicular range empty (no `Fl`/`fl` emitted).

**2. Prediction-window band (`pw`)**
- Prediction with `prediction_window_days = 4` → `pw` on `pred−4 … pred−1` and `pred_end+1 … pred_end+4`; `p` block on `pred … pred_end`.
- `prediction_window_days = None` → **no** `pw` days.
- Confirmed days inside the band stay confirmed (only-if-absent): craft a confirmed luteal day overlapping the leading band and assert it remains `L`.

**3. `O` override (D1)**
- Assert ovulation day is `O` (not `F`) for a confirmed cycle; `o` for predicted.

**4. Day-code precedence**
- `P > Fl > F > O > L > c > pw > p > fl > f > o > l` — assert `P` wins over an overlapping `Fl`/`F`; confirmed `F` wins over predicted `p` on the same date.

### Extend `test_extended_services.py` / `test_system_test*.py`

**5. Scaled check-in window (IR-4)**
- Prediction with `prediction_window_days = 8`: assert `needs_checkin` is `True` at `pred − max(3, 8) = pred − 8` (previously `False` at `pred − 4`), and `False` at `pred + max(6, 9) = pred + 9`.
- Regular (`window = None`): unchanged `pred − 3 … pred + 6`.

**6. Dynamic auto-link (IR-5)**
- Prediction with `prediction_window_days = 8`; log a period `6` days from predicted → **auto-links** (was not linked at ±3). `prediction_error_days = ±6`, `avg_prediction_error_days` updated.
- Regular prediction (`window = None`): ±3 behavior unchanged.

**7. Widened std-dev (IR-2)**
- Seed entries with starts producing intervals `[24, 48, 26]` → `cycle_length_std_dev` ≈ 13.1 (not 1.4); `avg_cycle_length` from `[24, 26]`-style avg logic (48 still excluded from the average).
- `[28, 28, 28]` → `std_dev = 0`; predictions get `prediction_window_days = None` on **both** model paths (IR-1).

**8. Fallback window alignment (IR-1)**
- `fallback_prediction([28, 28, 28])` → `window is None` (was 3).
- `fallback_prediction([26, 40, 33])` → `window = int(std) > 3.5` (non-None).
- `fallback_prediction([], ..., user_std=2.0)` → `window is None`.

### Fix existing assertions

- Any test that asserts exact day dicts may now contain `Fl`/`fl`/`pw`/`O` codes on previously-empty days. Re-run `pytest` and update exact-dict expectations (`test_system_test*.py`, `test_extended_services.py`).

---

## Mobile tests

### `src/utils/__tests__/cyclePhases.test.ts` — extend

- `calculateCyclePhases` returns `follicularStart`/`follicularEnd` (`period_end+1` … `fertile_start−1`).
- `applyPhaseToDays` emits `Fl`/`fl` between period and fertile; `O`/`o` on the ovulation day (matches D1).
- `computePhaseRanges` returns **5** ranges; follicular numbers correct for a 28-day cycle.

### `src/utils/__tests__/backfillCards.test.ts` — extend

- Derived average: entries with gaps `[26, 30]` → `avgCycle = 28`; threshold `56` unchanged.
- `avgCycle` override param wins over derivation.
- Existing cases (empty, anovulatory, `daysSince < 56`) still pass.

### New `src/utils/__tests__/date.test.ts`

- `toLocalDateStr` uses local getters (no UTC rollover at `23:00 UTC+X`).
- `parseISODateLocal('2026-07-17')` → local midday date (no day shift in `UTC−` zones).

---

## Verification commands

### Backend (`E:\her_care\backend`)

```powershell
ruff check app tests
mypy app
pytest tests/modules/cycle/ -q
```

### Mobile (`E:\her_care\mobile`)

```powershell
npx tsc --noEmit
npx jest src/utils src/services/queries/__tests__
npx eslint src/utils/cyclePhases.ts src/components/ui/Calendar.tsx src/screens/calendar/CalendarScreen.tsx src/utils/backfillCards.ts src/hooks/usePeriodCheckIn.ts src/utils/date.ts
```

> ESLint baseline: inline-style warnings are pre-existing codebase-wide; only flag new violations introduced by this work.

---

## Affected-file matrix

| Change | Backend | Mobile | Test |
|--------|---------|--------|------|
| Follicular `Fl`/`fl` | `phase_utils.py`, `services.py` | `cyclePhases.ts`, `Calendar.tsx`, `CalendarScreen.tsx` | BE + FE |
| `pw` band | `services.py` | `Calendar.tsx`, `CalendarScreen.tsx` | BE + FE |
| `O` override (D1) | `services.py` | `cyclePhases.ts` | BE + FE |
| Scaled check-in (IR-4) | `services.py` | — (timing is backend) | BE |
| Dynamic auto-link (IR-5) | `services.py` | — | BE |
| Widened std (IR-2) | `services.py` | — | BE |
| Fallback window (IR-1) | `prediction_engine.py`, `services.py` | — | BE |
| `u` light-pink (F2) | — | `Calendar.tsx` | visual |
| Backfill avg (G3) | — | `backfillCards.ts` | FE |
| Device-local today (H) | `services.py` (optional `today` param) | `utils/date.ts` + sweep | FE |
| Contract/doc | `plans/30-mobile-api-contract.md`, `fix_now.md` | — | — |
