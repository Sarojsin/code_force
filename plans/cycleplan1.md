# Cycleplan 1 — Backend Implementation (SheCare Calendar Correctness)

**Scope:** All backend code changes approved in review (decision rounds 1 & 2).
**Status:** Approved for implementation.
**Target files:** `backend/app/modules/cycle/phase_utils.py`, `backend/app/modules/cycle/services.py`, `backend/app/integrations/prediction_engine.py`, tests under `backend/tests/modules/cycle/`.
**No schema/migration changes** — every change below operates on existing columns.

---

## Decision summary (folded in)

| ID | Decision | Where |
|----|----------|-------|
| A | Fertile window = **5-day** `Ovulation − 4 … Ovulation` (code already correct; doc updated) | phase_utils (no code change) |
| B | Render **`pw` prediction-window band** around predicted period for irregular users | services.py |
| C | Add **`Fl` / `fl` follicular** day codes (confirmed / predicted) | phase_utils.py + services.py |
| F1 | **Confirmed beats predicted** (F wins over p); P wins within confirmed | services.py (already true) |
| IR-1 | **Align fallback window** to strict `std_dev > 3.5` → window, else `None` | prediction_engine.py |
| IR-2 | **Widen std-dev filter to [15, 60]** (avg stays [20, 45]); widened std drives band | services.py `_update_user_ml_metrics` |
| IR-4 | **Scale check-in window** with `prediction_window_days` | services.py `get_calendar` |
| IR-5 | **Dynamic auto-link window** `max(config, prediction_window_days)` | services.py `_try_auto_link_prediction` |
| D1 (discovered) | **Fix dead `O` code** — `fertile_end == ovulation` means F occupies the ovulation day and `O` is never emitted. Make `O`/`o` override `F`/`f` on the exact ovulation day so the legend, overview, and docs match reality. | services.py `_apply_confirmed_phases` / `_apply_predicted_phases` |

---

## A1. `phase_utils.py` — follicular phase fields

`calculate_cycle_phases` (line 18) gains two keys:

```python
def calculate_cycle_phases(period_start, cycle_length, period_length=5):
    period_end = period_start + timedelta(days=period_length - 1)
    ovulation_offset = max(10, min(cycle_length - 14, 40))
    ovulation_date = period_start + timedelta(days=ovulation_offset)
    fertile_start = ovulation_date - timedelta(days=4)
    fertile_end = ovulation_date
    luteal_start = ovulation_date + timedelta(days=1)
    luteal_end = period_start + timedelta(days=cycle_length - 1)
    return {
        "period_start": period_start,
        "period_end": period_end,
        "follicular_start": period_end + timedelta(days=1),
        "follicular_end": fertile_start - timedelta(days=1),
        "fertile_start": fertile_start,
        "fertile_end": fertile_end,
        "ovulation_date": ovulation_date,
        "luteal_start": luteal_start,
        "luteal_end": luteal_end,
    }
```

Callers must guard with `if follicular_end >= follicular_start` (short cycles yield an empty follicular range).

---

## A2. `services.py` — day codes: `Fl`/`fl`, `pw` band, `O` override

### `_apply_confirmed_phases` (line 637)

```python
@staticmethod
def _apply_confirmed_phases(days, phases):
    for d in _iter_date_range(phases["period_start"], phases["period_end"]):
        days[d.isoformat()] = "P"
    fs, fe = phases["follicular_start"], phases["follicular_end"]
    if fe >= fs:
        for d in _iter_date_range(fs, fe):
            key = d.isoformat()
            if key not in days:
                days[key] = "Fl"
    for d in _iter_date_range(phases["fertile_start"], phases["fertile_end"]):
        key = d.isoformat()
        if key not in days:
            days[key] = "F"
    # D1: ovulation day must render as O, not F
    ov_key = phases["ovulation_date"].isoformat()
    days[ov_key] = "O"          # overwrite F on the peak day
    for d in _iter_date_range(phases["luteal_start"], phases["luteal_end"]):
        key = d.isoformat()
        if key not in days:
            days[key] = "L"
```

### `_apply_predicted_phases` (line 662) — gains `window`

```python
@staticmethod
def _apply_predicted_phases(days, phases, window: int | None = None):
    # B: prediction-window band FIRST so fertile/luteal (only-if-absent) still win
    if window and window > 0:
        lead = _iter_date_range(phases["period_start"] - timedelta(days=window),
                                phases["period_start"] - timedelta(days=1))
        trail = _iter_date_range(phases["period_end"] + timedelta(days=1),
                                 phases["period_end"] + timedelta(days=window))
        for d in list(lead) + list(trail):
            key = d.isoformat()
            if key not in days:
                days[key] = "pw"
    for d in _iter_date_range(phases["period_start"], phases["period_end"]):
        key = d.isoformat()
        if key not in days:
            days[key] = "p"
    fs, fe = phases["follicular_start"], phases["follicular_end"]
    if fe >= fs:
        for d in _iter_date_range(fs, fe):
            key = d.isoformat()
            if key not in days:
                days[key] = "fl"
    for d in _iter_date_range(phases["fertile_start"], phases["fertile_end"]):
        key = d.isoformat()
        if key not in days:
            days[key] = "f"
    ov_key = phases["ovulation_date"].isoformat()
    days[ov_key] = "o"          # D1
    for d in _iter_date_range(phases["luteal_start"], phases["luteal_end"]):
        key = d.isoformat()
        if key not in days:
            days[key] = "l"
```

### `get_calendar` (line 566) — pass window into the renderer

```python
for i, pred in enumerate(active_preds):
    cycle_len = self._pred_cycle_length(active_preds, i, avg_cycle_length)
    phases = calculate_cycle_phases(pred.predicted_next_period_start, cycle_len, avg_period_length)
    self._apply_predicted_phases(days, phases, pred.prediction_window_days)
```

Resulting day-code order of precedence (matches F1 + the corrected doc):

`P > Fl > F > O > L > c > pw > p > fl > f > o > l`

(`pw` beats `p` visually only where they don't overlap; confirmed + fertile always win via only-if-absent.)

---

## A3. `services.py` — scaled check-in window (IR-4)

Replace the fixed window at lines 595–605:

```python
if active_pred.actual_cycle_entry_id is None:
    pred_date = active_pred.predicted_next_period_start
    pwd = active_pred.prediction_window_days
    if pwd:
        window_start = pred_date - timedelta(days=max(3, pwd))
        window_end = pred_date + timedelta(days=max(6, pwd + 1))
    else:
        window_start = pred_date - timedelta(days=3)
        window_end = pred_date + timedelta(days=6)
    if window_start <= today_ref <= window_end:
        # ... existing has_recent_period check + snooze suppression unchanged
```

---

## A4. `services.py` — dynamic auto-link window (IR-5)

In `_try_auto_link_prediction` (line 125):

```python
base = get_settings().cycle.auto_link_window_days   # default 3
for pred in predictions:
    link_window = max(base, pred.prediction_window_days or 0)
    diff = (entry.period_start_date - pred.predicted_next_period_start).days
    if -link_window <= diff <= link_window:
        # ... existing link logic unchanged
        break
```

---

## A5. `services.py` — widened std-dev (IR-2)

In `_update_user_ml_metrics` (lines 932–943), compute **two** interval sets:

```python
rows = (await self.db.execute(stmt)).scalars().all()
if len(rows) >= 2:
    diffs = []
    for i in range(1, len(rows)):
        diffs.append((rows[i] - rows[i - 1]).days)
    avg_intervals = [d for d in diffs if 20 <= d <= 45]      # average (unchanged)
    std_intervals = [d for d in diffs if 15 <= d <= 60]      # regularity (widened)
    if avg_intervals:
        user.avg_cycle_length = round(sum(avg_intervals) / len(avg_intervals), 1)
    if len(std_intervals) >= 2:
        user.cycle_length_std_dev = round(stdev(std_intervals), 1)
    else:
        user.cycle_length_std_dev = None
```

Effect: a user with cycles `[24, 48, 26]` now yields `std_intervals = [24, 48, 26]` → std ≈ 13.1 → gets a band, where previously the 48 was dropped (std ≈ 1.4, no band).

---

## A6. `prediction_engine.py` — align fallback window (IR-1) + user std (IR-2)

`fallback_prediction` (line 49) — accept the user's stored (widened) std and drop the always-on window:

```python
def fallback_prediction(
    cycle_lengths: list[int],
    avg_error: float | None = None,
    user_std: float | None = None,
) -> tuple[int, float, int | None]:
    if len(cycle_lengths) >= 3:
        base = int(median(cycle_lengths)); confidence = 0.40
    else:
        base = 28; confidence = 0.20
    if avg_error is not None and abs(avg_error) > 0.1:
        base = int(round(base + avg_error))
        confidence = max(0.15, confidence - 0.05)
    base = max(20, min(45, base))
    pred_std = user_std
    if pred_std is None:
        pred_std = float(np.std(cycle_lengths)) if len(cycle_lengths) >= 2 else None
    window = int(pred_std) if pred_std is not None and pred_std > 3.5 else None
    return base, round(confidence, 2), window
```

`_predict_with_fallback` (services.py ~line 352) passes the widened, stored std:

```python
pred_std = u.cycle_length_std_dev if (u and u.cycle_length_std_dev is not None) else None
predicted_length, confidence, window = fallback_prediction(cycle_lengths, avg_error, pred_std)
```

Now **both** engine paths agree: window is set iff `std_dev > 3.5`.

---

## Corrected day-code set (reference)

| Code | Meaning | Emitted when |
|------|---------|--------------|
| `P` | Confirmed period | confirmed entry |
| `Fl` | Confirmed follicular (gap phase) | confirmed entry, `period_end+1 … fertile_start−1` |
| `F` | Confirmed fertile | confirmed entry, `ov−4 … ov` |
| `O` | Confirmed ovulation | confirmed entry, ovulation day (overrides F) |
| `L` | Confirmed luteal | confirmed entry |
| `c` | Cancelled prediction | superseded by correction |
| `pw` | Prediction-window band | irregular prediction (`prediction_window_days>0`), `±window` around the p block |
| `p` | Predicted period | active prediction |
| `fl` | Predicted follicular | active prediction |
| `f` | Predicted fertile | active prediction |
| `o` | Predicted ovulation | active prediction (overrides f) |
| `l` | Predicted luteal | active prediction |
| `u` | Unconfirmed period (open entry) | pending entry, no end date |
| `T` | Today | always last |

---

## Verification

- Backend: see `cycleplan3.md` for the full test matrix.
- No Alembic migration is required (all computed at render time).
- Contract impact: only additive day codes + `needs_checkin` window semantics — see `cycleplan4.md`.
