# Cycleplan 4 — Documentation Correction (fix_now.md + API Contract)

**Scope:** Bring `E:\her_care\fix_now.md` and `E:\her_care\plans\30-mobile-api-contract.md` in line with every approved decision.
**Status:** Approved for implementation.

---

## 1. `fix_now.md` correction map

Every stale passage, keyed by decision. **Code wins; the doc follows code.**

### Formula & phases

| # | Location | Stale claim | Correction |
|---|----------|-------------|------------|
| 1 | 4-Phase Formula table, "Fertile Window" row | `Ov − 5 … Ov + 1` (7 days) | `Ov − 4 … Ov` (**5 days**, medical: sperm 5 days, egg 1 day). Both stacks already do this. |
| 2 | 4-Phase Formula table, "Follicular" row | "The gap phase", no code | Now has codes: confirmed `Fl`, predicted `fl`; range `Period_End + 1 … fertile_start − 1`. |
| 3 | §2 formula table (regular example) | Fertile `Aug 10 – Aug 16` | `Aug 11 – Aug 15` (Ov = Aug 15). Luteal `Aug 16 – Aug 28`. |
| 4 | §7 `getDayType` pseudo-code | `date >= ovulationDate - 5 && date <= ovulationDate + 1` | `date >= ovulationDate - 4 && date <= ovulationDate`; add follicular branch returning `Fl`/`fl`. |
| 5 | Irregular example (Aug 20 ovulation) | "Ovulation_Date ± 5 f" | Fertile `Ov − 4 … Ov`; ovulation day renders `o`/`O`. |

### Day codes & priority

| # | Location | Stale claim | Correction |
|---|----------|-------------|------------|
| 6 | Priority Rule (line 23) | "Predicted Period wins over Confirmed Fertile" | **Confirmed beats predicted** (F1). Real order: `P > Fl > F > O > L > c > pw > p > fl > f > o > l`. |
| 7 | Priority table §3 | `F` = "rare, via OPK tests" | `F` is auto-calculated every cycle (no OPK feature). Add `Fl`/`fl` rows. |
| 8 | Priority ladder §2 (steps 3–4) | `p` before `F` | `F` before `p`; add `Fl` step after `P`; `pw` before `p`. |
| 9 | `DAY_TYPE_COLORS` table | Colors `#FFB3C6`, `#D4A5B5`, etc. | Use the real mapping (`P #FF6B8A`, `p #FFE4EC`, `u #FFE4EC`+dashed, `c #E0E0E0`, `Fl #FFDAB9`, `fl #FFF0E0`, `F #CE93D8`, `f #F3E5F5`, `O #81C784`, `o #E8F5E9`, `L #90CAF9`, `l #E3F2FD`, `pw #FFE9F0`+dashed, `T #42A5F5`). |
| 10 | Add `u` | Not documented | `u` = unconfirmed period (open entry, no end date) — light pink, dashed border. |

### Irregular-cycle behavior

| # | Location | Stale claim | Correction |
|---|----------|-------------|------------|
| 11 | Irregular UI change (§5, §3b, §5c) | Window rendered as extended `p` block | New **`pw` band** around the `p` block: leading `pred − window … pred − 1` + trailing `pred_end + 1 … pred_end + window`, only-if-absent. |
| 12 | Prediction window rule | `prediction_window_days = std_dev` shown on **both** paths | IR-1: `window = int(std_dev)` **only when `std_dev > 3.5`**, else `None`, on **both** global-model and fallback paths. |
| 13 | Irregular math note | "Std Dev from last 6 cycles" | IR-2: std-dev computed over intervals in **[15, 60]**; the **average** still uses **[20, 45]**. |
| 14 | Sticky Card visibility | "P-3 to P+6" (fixed) | IR-4: scaled — `pred − max(3, window)` to `pred + max(6, window + 1)` when a window exists, else `pred ± 3/+6`. |
| 15 | Trigger 3 auto-link | "prediction within ±5 days auto-links" | IR-5: dynamic — `±max(config, prediction_window_days)` (config default 3). |

### Period-length / averages

| # | Location | Stale claim | Correction |
|---|----------|-------------|------------|
| 16 | Avg Period Length (§1, §3) | "last 3 cycles" | G1: **all history** (recency-weighted concept). `_compute_average_period_length` uses every confirmed end date. |
| 17 | Period End Date (§3) | "system never asks for end date" | F3: explicit `period_end_date` is **respected**; avg fallback only when the end date is missing (open entry). |
| 18 | Summary table | "Start + Avg(Last_3_Period_Lengths) − 1" | "Explicit end date, else `Start + Avg(all period lengths) − 1`". |

### Cache / offline architecture

| # | Location | Stale claim | Correction |
|---|----------|-------------|------------|
| 19 | Data pipeline & Layer 2 | "SQLite stores the calendar dictionary (`localDb.cycle.getCalendar()`)" | E1: calendar is served by **React Query direct-to-API** (in-memory, `networkMode: 'offlineFirst'`); SQLite stores `cycle_entries` for **offline writes**, not the dictionary. `getCalendar()` does not exist. |
| 20 | Read path / summary | "API → SQLite → React Query" | "API → React Query (offlineFirst serves last cache)". |
| 21 | Cache expiry | "7-day React Query cache expiry" | E2: global `staleTime 5 min` / `gcTime 24 h`; cycle queries override `staleTime` to **10 min**. |
| 22 | Technical-debt safeguards | "React Query serves the SQLite cache (persistent storage)" | "offlineFirst: serves the last in-memory cache when offline". |

### Snooze

| # | Location | Stale claim | Correction |
|---|----------|-------------|------------|
| 23 | Snooze flow step 2 | "`POST /cycle/snooze` with `day_offset = 0`" | D1: first snooze sends **`day_offset = 1`** (card returns next day). |
| 24 | Snooze flow steps 4–5 | "snooze count feeds `avg_prediction_error_days`" | D2: snooze is **UX-only**; accuracy is learned only via linked corrections. |

### Correction / offline

| # | Location | Stale claim | Correction |
|---|----------|-------------|------------|
| 25 | Offline enqueue | `priority: 'high'` | Actual: **`'normal'`** (all cycle ops). |
| 26 | Conflict/Hydration | "SQLite upsert of server_data" | E1: 409 applies the server calendar to the React Query cache + toast; SQLite holds `cycle_entries`, not a dictionary. |

### Component map (I1–I3)

| # | Location | Stale claim | Correction |
|---|----------|-------------|------------|
| 27 | Ecosystem map | "CycleDashboard = home-screen mini calendar; same `Calendar.tsx` via `size` prop" | I1: CycleDashboard is a **screen in the Calendar stack**; there is **no `size` prop** (all now use `ui/Calendar`). |
| 28 | `useCyclePredictions` | "used by Prediction/Sticky card" | I2: Prediction/Sticky cards read `calData.predictions` from the calendar dictionary; `useCyclePredictions` is used only by `CyclePredictionsScreen`. |
| 29 | Retry policy | `retry: false` | I3: global `retry: (failureCount, error) => failureCount < 2` (401/404 never retried); cycle queries override `staleTime` 10 min. |

### Timezone

| # | Location | Stale claim | Correction |
|---|----------|-------------|------------|
| 30 | Situation E | "`.getUTCDate()` everywhere" | H: **device-local** "today" everywhere; backend `GET /cycle/calendar` accepts an optional `today` query param; dates stay `YYYY-MM-DD`. |

### Backfill

| # | Location | Stale claim | Correction |
|---|----------|-------------|------------|
| 31 | Situation D | "gap > 90 days", "last 3 cycle start dates" | G3: threshold **56 days** (`>= 2 missed cycles`); up to **3** backfill cards using the user's real average cycle (derived from entries), not a hardcoded 28. |

---

## 2. `plans/30-mobile-api-contract.md` changes

### `GET /api/v1/cycle/calendar` (line 459)

1. **Query params** (line 463): document optional `today`:

```
?months_back=3&months_forward=3&today=2026-08-01
```

`today` (optional) = client-local `YYYY-MM-DD`; the server anchors `T` and the `needs_checkin` window to it (falls back to server date).

2. **Day-code table** (line 496) — replace with:

```
ISO date → day type code:
  P   confirmed period          p   predicted period
  Fl  confirmed follicular      fl  predicted follicular
  F   confirmed fertile         f   predicted fertile
  O   confirmed ovulation       o   predicted ovulation
  L   confirmed luteal          l   predicted luteal
  u   unconfirmed period (open entry, no end date)
  c   cancelled (correction overrode this day)
  pw  prediction-window band (irregular users only, ±prediction_window_days around p)
  T   today
```

3. **Example `days`** (lines 469–476): add `Fl`/`fl` and a `pw` example.

4. **`needs_checkin` notes** (line 499): update window semantics —

```
true only when: prediction unconfirmed AND
  window = prediction_window_days
  today within [pred − max(3, window), pred + max(6, window + 1)]
  (or pred − 3 … pred + 6 when no window)
AND no recent period entry exists
```

5. **`predictions.prediction_window_days`** (line 487): add note — `null` for regular users (`std_dev ≤ 3.5`); set to `int(std_dev)` for irregular users on **both** engine paths.

---

## 3. Execution order

1. Apply `fix_now.md` edits (30 rows above, via targeted `edit` calls).
2. Apply contract-doc edits (5 items above).
3. Keep `cycleplan1–3.md` in `plans/` as the implementation reference; the code changes they describe are the deliverable that makes these docs truthful.
