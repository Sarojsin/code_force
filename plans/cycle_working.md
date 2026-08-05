📅 How the current cycle date is used
Step	What happens	Where
1. Model predicts length	predicted_cycle_length = 30 (from past 3 cycles)	Backend
2. Read current start	current_cycle_start = "2026-07-01" (stored in DB)	Backend
3. Compute expected next period	expected_date = current_cycle_start + predicted_cycle_length = 2026-07-31	Backend → UI
This expected_date is what the user sees on the Home Screen calendar ring, the "Day X of Y" progress, and the Prediction Screen.

So you do use the current cycle date – it's just not part of the feature vector for the machine learning model (which only uses completed cycles). That's intentional: the model predicts how long the current cycle will be, and the current start date tells us when that length ends.

🧠 Could the current date be a feature?
Yes, but that would be a different model (e.g., predicting irregularity based on seasonality or the day of the year). Your current model doesn't include such features. If you later want to add them (e.g., "cycle length tends to be longer in winter"), you could include current_cycle_start as a derived feature like day_of_year or month. But that's a future enhancement – not needed for the core rolling-window design.


✅ 1. FIFO Shift via SQL Re‑Query (Implicit)
"There is no explicit prev_3 = prev_2 shift; ORDER BY DESC + LIMIT 3 does it automatically."

You are absolutely right. This is superior to explicit shifting because:

No data mutation – you never have to update a "current" flag or shift values in the database.

No race conditions – if a user backfills a missing cycle, the query instantly adapts.

Always correct – the most recent 3 entries are always the current window.

The mapping you described is exactly what build_rolling_features() does:

Array index	Feature alias
[0] (most recent)	prev_1
[1]	prev_2
[2]	prev_3
✅ Net effect: When a new period is logged, it becomes index 0. Everything shifts right. Anything beyond index 2 drops out. Identical to FIFO, but better.

✅ 2. Manual-Only Trigger — No Auto-Logging
"Only two user-initiated code paths create CycleEntry rows. No cron jobs, no background tasks."

Correct. This is the right design because:

Only the user knows when their period actually starts.

Auto-logging (e.g., assuming a 28‑day cycle) would create false data and corrupt the training set.

The model is used for prediction, not automation.

✅ 3. Predictions Use Shifted Data – Re‑computed on Every Write
"After every entry creation, compute_predictions() is called, re‑queries the new set, re‑computes features, deactivates old prediction, creates new row."

Exactly. This guarantees:

The prediction is always fresh – no stale cache.

The deactivation of old predictions (soft delete or status flag) prevents the user from seeing outdated estimates.

This is a textbook "write‑through" prediction cache.

⚠️ 4. The Critical Safeguard: _get_recent_entries() Filters by period_end_date
"It filters out entries without period_end_date. This means the current in‑progress cycle is NOT part of the FIFO window until the user logs their next period (which triggers _auto_close_open_entry)."

This is the single most important safeguard in your system. 🛡️

Here's why it matters:

The current cycle (the one happening now) is incomplete – its length is unknown.

If it were included in the feature window, its length would be NULL or 0 or some placeholder, which would poison the training data.

By forcing the user to log the next period before the current one becomes "completed," you ensure the model only ever sees real, historical lengths.

"The _auto_close_open_entry backfills the end date when the new period starts."
This is exactly the flow we designed: the shift happens only when a new period is logged, and the old cycle becomes prev_1 because it now has a period_end_date.