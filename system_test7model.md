# Scenario 21: The "Heuristic" vs "Global Model" Threshold — Detailed Explanation

This scenario validates when and how the prediction engine upgrades from a simple fallback to the sophisticated Global AI model. It is the single most important "under the hood" transition in the entire ML pipeline.

---

## 1. The Core Logic (The Actual Implementation)

Unlike the outdated 4-tier design document (which included Linear Regression, MAD, and Random Forest), the actual code uses a clean if/else gate:

```python
# In services.py compute_predictions()
model = self._load_active_model()  # Checks /storage/models/prod/global_model.json

if model and len(entries) >= 3:
    # Path A: Global Model exists
    result = await self._predict_with_global_model(model, user, entries)
else:
    # Path B: Fallback (No Global Model OR < 3 entries)
    result = self._predict_with_fallback(entries, user)
```

**The Decision Matrix:**

| Data Points | Global JSON Exists? | Algorithm | Confidence |
|-------------|---------------------|-----------|------------|
| < 3 entries | (Irrelevant) | Heuristic (28-day default) | 0.20 |
| ≥ 3 entries | ✅ YES (file exists) | Global XGBoost | Calculated from RMSE (e.g., 0.77) |
| ≥ 3 entries | ❌ NO (offline / not downloaded) | Median of past cycle lengths | 0.40 (static) |

---

## 2. Pre-Condition (Before the Threshold)

**User State:**

- The user has exactly 2 cycles logged (e.g., June 1 and June 29).
- The app has not downloaded the Global JSON file yet (fresh install, or still offline).

**Prediction Output (2 cycles):**

`compute_predictions()` runs.

- `model = self._load_active_model()` → Returns None (file missing).
- `len(entries) = 2` → `len(entries) >= 3` is false.
- **Fallback Path:** `_predict_with_fallback()` is called.
- Since `len(entries) < 3`, the system uses the 28-day Heuristic.

**Result:** `predicted_next_period_start = June 29 + 28 days = July 27`.

**Confidence:** 0.20.

**SQLite Metadata:** `model_type = 'fallback'`, `confidence_score = 0.20`, `training_data_points = 2`.

---

## 3. The User Action (Logging the 3rd Cycle)

**Date:** July 27 (the predicted date arrives).

**User Action:** The user logs her 3rd period start date (e.g., she taps "Yes" on the Sticky Card or manually logs it).

**System Event:**

- `total_cycles_logged` becomes 3.
- The new cycle_entry is saved to SQLite and synced to the server.
- **Trigger:** `compute_predictions()` is called again to generate the next prediction.

---

## 4. The Decision Gate (After 3 Cycles)

### Step 4A: The Check

```python
model = self._load_active_model()  # Checks if /storage/models/prod/global_model.json exists
entries = await self._get_recent_entries(user_id, limit=12)  # Fetches the 3 cycles
```

### Step 4B: Path A (Global Model Exists — Online Scenario)

- **Condition:** The user is online, and the app has downloaded the Global JSON file (which happens in the background when Wi-Fi is available).
- `model` is not None.
- `len(entries) >= 3` is true.
- **Decision:** The system calls `_predict_with_global_model()`.

**What the Global Model Does:**

- It reads the user's age, BMI, stress_level, avg_cycle_length, avg_error, and seasonal components from the user table.
- It applies the XGBoost coefficients from the JSON file to these features.

**Result:** A highly personalized prediction (e.g., July 25, instead of the median July 28).

**Confidence Calculation:**

- The global model has an RMSE (Root Mean Square Error) from its training on the population dataset (e.g., 2.3 days).
- `confidence = max(0, 1 - (RMSE / 10))`.
- If RMSE = 2.3, confidence = `1 - 0.23 = 0.77`.

**Result:** Confidence badge shows "Good (77%)".

**SQLite Metadata:**

| Field | Value |
|-------|-------|
| `model_type` | `'global_model'` |
| `confidence_score` | 0.77 |
| `training_data_points` | 3 |

### Step 4C: Path B (Fallback — Offline Scenario)

- **Condition:** The user is offline, or the Global JSON file hasn't downloaded yet.
- `model` is None (file missing).
- `len(entries) >= 3` is true.
- **Decision:** The system falls back to `_predict_with_fallback()`.

**What the Fallback Does:**

- It extracts the user's 3 cycle lengths: e.g., `[28, 30, 29]`.
- It calculates the Median: `median([28, 30, 29]) = 29`.

**Result:** `predicted_next_period_start = (last_period_start) + 29 days`.

**Confidence:**

- Static: 0.40.

**Result:** Confidence badge shows "Uncertain (40%)".

**SQLite Metadata:**

| Field | Value |
|-------|-------|
| `model_type` | `'fallback'` |
| `confidence_score` | 0.40 |
| `training_data_points` | 3 |

---

## 5. The UI Experience (Before vs. After)

| Element | Before (2 cycles) | After (3 cycles — Online) | After (3 cycles — Offline) |
|---------|-------------------|---------------------------|----------------------------|
| Prediction Date | July 27 (28-day heuristic). | July 25 (Global XGBoost adjusted). | July 28 (Median of 29 days). |
| Model Label | "Heuristic" | "Global XGBoost" | "Fallback (Median)" |
| Confidence Badge | "Very uncertain (20%)" | "Good (77%)" | "Uncertain (40%)" |
| Data Quality | "Insufficient" | "Minimal" | "Minimal" |

---

## 6. Edge Cases & Nuances

| Scenario | System Behavior |
|----------|-----------------|
| User is online but the Global JSON hasn't downloaded yet. | The system falls back to Median (Path B). On the next sync (when the JSON downloads), the model switches to Global XGBoost. |
| User logs 4th, 5th, or 10th cycle. | Nothing changes. The Global Model remains active permanently (≥ 3 cycles). The only change is the `training_data_points` metadata increments. |
| User wipes her data (drops below 3 cycles). | The system reverts to Heuristic (28-day default) until she logs 3 cycles again. |
| The Global Model JSON is updated (monthly retrain). | The app downloads the new JSON in the background. The prediction coefficients update silently, but the UI still shows "Global XGBoost." |

---

## 7. Checkpoints Verification (Detailed)

| Checkpoint | How to Test | Why It Matters |
|------------|-------------|----------------|
| ✅ Global model activates at 3 cycles (if online). | Log exactly 3 cycles. Ensure Wi-Fi is on. Force a prediction (e.g., open the dashboard). Check SQLite `model_type`. It should be `'global_model'`. | Proves the activation threshold is 3 cycles, not 10. No Linear/RF tiers exist. |
| ✅ Fallback uses Median (if offline). | Log 3 cycles. Turn off Wi-Fi. Generate a prediction. Check SQLite `model_type`. It should be `'fallback'`. Check the `predicted_next_period_start` against the median of her 3 cycles. | Proves the `_load_active_model()` check fails gracefully and the median is correctly calculated. |
| ✅ Confidence is exactly 0.40 for fallback. | Check the `confidence_score` in the offline prediction. It should be exactly 0.40. | Proves no n/10 scaling logic exists. |
| ✅ Confidence is derived from RMSE for global model. | Check the `confidence_score` in the online prediction. It should be a calculated value (e.g., 0.77), not a hardcoded number. | Proves the confidence is tied to the model's performance, not an arbitrary scaling. |
| ✅ No Linear/RF metadata exists. | Query SQLite for any `model_type = 'linear_regression'` or `'random_forest'`. It should return 0 results. | Proves those models were never implemented. |

---

## 8. Summary

This scenario validates the single most important upgrade point in the AI pipeline:

- **Before 3 cycles:** The app is just guessing (28-day heuristic).
- **At 3 cycles:** The app immediately upgrades to the Global XGBoost model (if online), unlocking the full power of population-level training + personal demographics.
- **Fallback (offline):** The app uses a simple Median, ensuring the user still gets a prediction without the global model.

The user perceives a single, clear upgrade: "The app just got smarter because I logged 3 cycles." No confusing jumps from Linear to Random Forest at cycle 10—just a clean, one-time transition to Global AI. 🌸📈

## Scenario 21.2

### 1. What exactly is "used" from the database? (The Feature Vector)

The script queries the database and creates a table of 16 specific columns. This is the "brain food" for the AI.

| Category | Features Used | Why it goes into the model |
|----------|---------------|----------------------------|
| Demographics | age, bmi | Raw values. Sets the biological baseline. |
| Personal Baseline | avg_cycle_length, std_dev_cycle_length, avg_period_length, trend_slope | Tells the model this specific user's normal. |
| Lifestyle | stress_level, exercise_frequency, avg_sleep_hours, diet_type | Captures environmental effects on the cycle. |
| AI Feedback | avg_prediction_error_days | If the AI is always late, the model learns to add days. |
| Temporal | month_sin, month_cos, weekday_of_start | Seasonal/behavioral patterns. |
| Biology | luteal_length, is_break_cycle | Physiological flags (e.g., 60-day gap = pregnancy/PCOS). |
| Target (The Answer) | next_cycle_interval | The actual length until the next period. The model tries to guess this. |

**Important:** The SQL query does NOT include user_id, name, email, or phone. It hashes the user_id just for logging, but drops it before training.

### 2. Old vs New Model (The "Hyperparameter" Confusion)

You asked: "Does the old model and new model use the same perimeters?"

Answer: Yes and No.

| Component | Old Model (v5) | New Model (v6) | Is it the same? |
|-----------|----------------|----------------|-----------------|
| Hyperparameters (e.g., max_depth=4, n_estimators=200) | Hardcoded in the script. | Hardcoded in the script. | ✅ YES (Identical code). |
| Scaler Stats (Mean and Std of Age/BMI) | Calculated from May 2025 data. | Calculated from June 2025 data. | ❌ NO (Recalculated monthly). |
| Model Weights (Coefficients) | Trained on May data. | Trained on June data (includes user corrections). | ❌ NO (These change to reflect new patterns). |

**The Golden Rule:** You do not need to "tune" these hyperparameters for V1. They are constants defined in `scripts/train_global_model.py`. They only change if a data scientist manually updates the hardcoded values.

### 3. The "Dirty Flag" Clarification (The 300 vs 1000 user confusion)

You asked: "If only 300 users corrected, what about the other 700? Won't the model forget them?"

Answer: No. The `is_dirty_for_retraining = True` flag is NOT a filter for training. It is an **Update Trigger**.

**Step 1 (Update):** The script finds the 300 "dirty" users. It recalculates their `avg_cycle_length` and `std_dev` and updates the Feature Store (`ml_training_dataset`) for those 300 users.

**Step 2 (Train):** The script runs `SELECT * FROM ml_training_dataset`. This returns ALL 1,000 users (the 300 updated + the 700 unchanged).

**Step 3 (Learn):** The XGBoost model trains on the full 1,000-user dataset.

**Result:** The 700 stable users are always included. The model never "forgets" them.

### 4. Why are we not "Bucketing" Age/BMI?

You are right that bucketing reduces accuracy slightly.

**Current Decision:** Since your user base is small (< 1,000), we use raw age/BMI to give the model maximum mathematical power.

**Future Plan:** At 10,000+ users, we will switch to bucketing (e.g., 26-30) to ensure k-Anonymity (privacy).

**Action:** The script currently uses raw values. Do not change this.

### 🧠 The Final "Engineer's Checklist" for Scenario 21.1

To clear your confusion completely, verify these 4 things in your backend code:

| # | Check | Status (What to look for) |
|---|-------|---------------------------|
| 1 | Does the SQL query select the 16 features? | Check `scripts/train_global_model.py` or the Celery task. Ensure age, bmi, avg_cycle_length, etc., are selected. |
| 2 | Are the hyperparameters hardcoded? | Look for `XGBRegressor(n_estimators=200, max_depth=4...)`. If it's there, you are done. |
| 3 | Does the script use ALL users for training? | Ensure the query does not have a `WHERE is_dirty = True` clause. It should only use `WHERE total_cycles >= 3`. |
| 4 | Is user_id hashed/dropped? | Ensure the final training set (X) does NOT contain the raw UUID. |

If all 4 are true, your backend ML pipeline is 100% production-ready. You do not need to touch it. The monthly Celery task will run, and the new model will automatically improve the app.

Do you want me to draft the exact SQL query for that training dataset to remove all doubt, or do you want to move back to the mobile SQLite fixes? 🚀🔬






## Scenario 21.2: The Monthly Global Model Retraining Pipeline (No Bucketing) — Detailed Explanation

This scenario validates the full MLOps pipeline on the backend: how raw user data (cycle logs, corrections, demographics) is aggregated, anonymized (via hashing + differential privacy noise), used to retrain the Global XGBoost model, validated for accuracy, and safely deployed to production—all while the app remains fully operational.

**Design Decision (Updated):** Since the current user base is small (initial launch phase), we do NOT bucketize age or BMI. We rely entirely on hashing user_id and adding differential privacy noise to the target label to prevent re-identification. Bucketing will be introduced later when the user base grows and k-anonymity thresholds (≥ 20 users per bucket) become meaningful.

### 1. Core Concept: The "Student-Teacher" Cycle

The backend does not retrain the model on every correction. Instead, it runs a monthly batch job (via Celery Beat) that:

- Aggregates data from all users (with ≥ 3 cycles).
- Anonymizes data via user_id hashing (prevents tracing predictions back to individuals).
- Adds differential privacy noise (N(0, 1.5)) to the target label to prevent model inversion attacks.
- Trains a new XGBoost model on the entire population dataset (using raw age and BMI for max accuracy).
- Validates the new model against a holdout set to prevent regression (Data Drift detection).
- If the new model is better (or equal): Atomically swaps the model file in production.
- If the new model is worse: Aborts and keeps the old model active.

### 2. Pre-Conditions (Before the Monthly Task Fires)

**Current State:**

- Production global model: `global_model_v5.json` (served from `/storage/models/prod/`).
- System Config: `global_model_version = 5`.
- User Data Accumulation: Over the last 30 days, 300 users have corrected their periods (`is_dirty_for_retraining = True`). 700 users have not corrected, but their data is still included (reused from the feature store).
- Scheduled Task: Celery Beat is configured to run `app.modules.cycle.tasks.train_global_model` on the 1st of every month at 3:00 AM.
- Prerequisites: The backend has scikit-learn, xgboost, numpy, and pandas installed.

### 3. The Retraining Pipeline (Step-by-Step)

#### Step 3A: Data Aggregation (The Feature Store)

The task runs a complex SQL query to build the training dataset. Privacy measures:

- `user_id` is hashed (prevents tracing predictions back to a specific individual).
- **Differential Privacy Noise:** The target label (cycle_length) has N(0, 1.5) noise added (Box-Muller transform) to prevent model inversion attacks.
- **No bucketing:** Raw age and BMI are used (for maximum accuracy with the current small user base).

**Key SQL Logic (Mental Model):**

```sql
SELECT
    -- 1. Raw PII (No bucketing — max accuracy for small user base)
    u.age,
    (u.weight / POWER(NULLIF(u.height_cm / 100.0, 0), 2)) AS bmi,
    -- 2. User's ML metrics (computed during corrections)
    u.avg_cycle_length,
    u.std_dev_cycle_length,
    u.avg_prediction_error_days,
    u.stress_level,
    u.exercise_frequency,
    -- 3. Target label with Differential Privacy noise (Box-Muller)
    (c.cycle_length + (SQRT(-2 * LN(RANDOM(u.id))) * COS(2 * PI() * RANDOM()) * 1.5)) AS next_cycle_interval,
    -- 4. Feature Engineering
    SIN(2 * PI() * EXTRACT(MONTH FROM c.period_start_date) / 12.0) AS month_sin,
    COS(2 * PI() * EXTRACT(MONTH FROM c.period_start_date) / 12.0) AS month_cos,
    GREATEST(c.cycle_length - 14, 7) AS luteal_length,
    EXTRACT(DOW FROM c.period_start_date) AS weekday_of_start,
    (CASE WHEN c.cycle_length > 45 THEN 1 ELSE 0 END) AS is_break_cycle,
    -- 5. Hashed user_id (cannot trace predictions back to individuals)
    ENCODE(SHA256(u.id::text || 'static-training-salt'), 'hex') AS hashed_user_id
FROM users u
JOIN user_onboarding o ON u.id = o.user_id
JOIN cycle_entries c ON u.id = c.user_id
WHERE u.total_cycles_logged >= 3
  AND u.is_active = True
  AND o.onboarding_completed = True;
```

**Crucial Privacy Steps:**

- **Hashing:** `user_id` is hashed so the model's feature importance cannot be traced back to an individual.
- **Differential Privacy Noise:** The target label (`next_cycle_interval`) has N(0, 1.5) noise added. This prevents an attacker from reverse-engineering the model to find a specific user's exact cycle length.
- **No bucketing:** Since the user base is currently small (< 1000), bucketing would reduce the model's ability to learn subtle relationships between demographics and cycle length. This is a temporary trade-off for higher accuracy.

#### Step 3B: Training the XGBoost Model

The data is split: 80% training, 20% holdout (test) set.

The task trains an `XGBRegressor` with specific hyperparameters (`max_depth=4`, `learning_rate=0.1`, `reg_lambda=1.0`, etc.).

Why XGBoost? It handles non-linear relationships (e.g., high stress + high BMI + age interaction) better than linear models.

#### Step 3C: Evaluation & Data Drift Detection (The Safety Gate)

This is the most critical safety step to prevent deploying a worse model.

The task calculates the RMSE (Root Mean Square Error) on the 20% holdout set.

It retrieves the previous month's RMSE from the `system_config` table (e.g., `previous_rmse = 2.45`).

**The Drift Check:**

```python
if new_rmse > 3.5 or new_rmse > previous_rmse * 1.10:
    # ABORT! The model got worse (or drifted too far).
    logger.error("global_model.drift_detected", extra={"new_rmse": new_rmse, "old_rmse": previous_rmse})
    return  # Do NOT swap. Keep v5 active.
```

If safe: The task proceeds to deployment.

#### Step 3D: Atomic Model Export & Swap

**Version Increment:** `new_version = 6`.

**Write to Staging:** The model coefficients and scaler parameters are exported to:

```
/storage/models/staging/global_model_v6.json
```

**The Atomic Swap (Zero Downtime):**

```python
# Python shutil.move (atomic on the same filesystem)
shutil.move("/storage/models/staging/global_model_v6.json", 
            "/storage/models/prod/global_model_v6.json")
```

**Update System Config:**

```sql
UPDATE system_config 
SET value = '6' WHERE key = 'global_model_version';
UPDATE system_config 
SET value = '{"rmse": 2.31, "previous_rmse": 2.45}' 
WHERE key = 'global_model_metrics';
```
#### Step 3E: Reset Dirty Flags

All users with `is_dirty_for_retraining = True` are reset to `False`. Their corrections have now been successfully incorporated into the global model.

**Why?** This prevents the monthly script from scanning the same user's data repeatedly (it queries `is_dirty = True` to limit the feature store rebuild cost).

---

### 4. The Mobile Impact (The "Student" Learns)

The backend now has a new model, but the user's phone still uses `v5.json` locally.

**Version Check:** The mobile app periodically calls `GET /api/v1/models/status`.

**Response:**
```json
{ "current_version": 6, "download_url": "/api/v1/models/download/global_model_v6.json" }
```

**Background Download:** The app downloads `v6.json` (only ~5 KB) and saves it to the local documents directory.

**Silent Swap:** The next time the user opens the app, `globalModelClient.ensureLatest()` loads `v6.json`.

**Result:** The user gets more accurate predictions without having to update the app.

---

### 5. System Config & Database Changes

| Table | Key | Before (v5) | After (v6) |
|-------|-----|-------------|------------|
| `system_config` | `global_model_version` | 5 | 6 |
| `system_config` | `global_model_path` | `global_model_v5.json` | `global_model_v6.json` |
| `system_config` | `global_model_metrics` | `{"rmse": 2.45, "trained_on": "2025-06-01"}` | `{"rmse": 2.31, "trained_on": "2025-07-01"}` |
| `users` | `is_dirty_for_retraining` | `True` (for 300 users) | `False` (reset) |

---

### 6. Checkpoints Verification (Detailed)

| # | Checkpoint | How to Test | Why It Matters |
|---|------------|-------------|----------------|
| 1 | ✅ Feature store includes ALL users. | Run the training script. Check the console log for the dataset size. If there are 1,000 users in the database, the `ml_training_dataset` should contain exactly 1,000 rows (even if only 300 are "dirty"). | Proves the model is not forgetting the stable 700 users. |
| 2 | ✅ Dirty flags reset after feature store update. | After the script runs, query `SELECT COUNT(*) FROM users WHERE is_dirty_for_retraining = True`. It should be 0. | Proves that the dirty flag is purely an update trigger and does not permanently exclude users. |
| 3 | ✅ Differential privacy noise is applied. | Run the training script on a fixed dataset. Compare the `next_cycle_interval` values with the raw `cycle_length` values. They should differ by ~±1.5 days. | Proves that the model cannot be reverse-engineered to predict an individual's exact cycle length. |
| 4 | ✅ Raw age/BMI are used (no bucketing). | Inspect the SQL query or the training logs. Confirm that age and bmi are not passed through a bucketization function. | Proves that we are using raw values for max accuracy, as per the design decision for the early-stage user base. |
| 5 | ✅ Data drift detection aborts bad models. | Manually inject a corrupted training dataset (e.g., shift all cycles by +10 days). The RMSE should exceed 3.5 or `previous_rmse * 1.10`. The script should log a warning and not swap the model. | Proves that the system protects users from a degraded AI experience (prevents deploying a "worse" model). |
| 6 | ✅ Atomic swap prevents partial writes. | While the script is running, simulate a server crash during the `shutil.move` operation. The `/prod/` folder should either have the old file entirely or the new file entirely. No corrupted half-files. | Proves zero-downtime deployment. The API never serves a partially written JSON file. |
| 7 | ✅ System config updates correctly. | After a successful run, query the `system_config` table. The `global_model_version` should increment (e.g., 5 → 6). The `global_model_path` should point to the new file. | Proves the mobile app will correctly detect the new version on the next API call. |
| 8 | ✅ Mobile downloads the new model. | Trigger the mobile app to call `/models/status`. Verify it receives `version: 6`. Check the network logs to confirm it downloads `global_model_v6.json`. | Proves the end-to-end loop: Backend trains → Frontend learns. |

---

### 7. Edge Cases & Safeguards

| Scenario | System Behavior |
|----------|-----------------|
| New model RMSE is worse (drift detected). | The new model is discarded. The old `v5.json` remains in production. The `system_config` is not updated. A Sentry alert is triggered. |
| Server runs out of disk space during export. | The `shutil.move` fails. The old model remains active. The error is logged, and the Celery task retries on the next schedule. |
| Mobile app is offline during model update. | The mobile app checks the version on the next launch or sync. It will eventually download `v6.json` when connectivity is restored. |
| User has less than 3 cycles. | The user is excluded from the training dataset. Their data is too sparse to influence the global model. |
| Future scaling (bucketing reintroduced). | When the user base grows to > 10,000, we will reintroduce age/BMI bucketing to ensure k-anonymity (k ≥ 20). This is tracked as a separate technical debt ticket. |

---

### 8. Summary

This scenario validates the full intelligence loop of the SheCare AI:

- Users correct periods → `avg_error` updates → `is_dirty_for_retraining = True`.
- Monthly Cron Job aggregates data (hashed + DP noise), trains XGBoost using raw age/BMI (for max accuracy with small user base), and checks for data drift.
- Atomic Swap deploys the new model to production with zero downtime.
- Mobile Download silently updates the user's local JSON file, improving their offline predictions.

If this pipeline fails, the AI stagnates. If it passes, the app gets smarter every single month, reflecting the collective biology of all its users. 🌸🔄📈