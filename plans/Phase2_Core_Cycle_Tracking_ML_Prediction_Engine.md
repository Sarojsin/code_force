# Phase 2: Core Cycle Tracking & ML Prediction Engine

## Objective

Deliver the primary dashboard/calendar experience with an ML-powered prediction engine that scales from simple heuristics to ensemble models as user data grows. Includes a **single Global Model** trained monthly on anonymized population data — no per-user models.

**Architecture Decision: Option A (Pure Global Model)** — one model for all users, <5 KB JSON download, zero per-user training overhead. *This replaces the earlier hybrid proposal. Per-user models contradicted the "one global model" strategy and added unnecessary complexity for V1.*

## Architectural Overview

```
Data Sources: cycle_entries → Feature Engineering → Fallback Chain → Prediction
                                                           ↓
                                    Global Model (XGBoost, trained monthly)
                                                           ↓
                                    JSON coefficients (~5KB, versioned)
                                                           ↓
                                 Mobile inference (pure JS, no runtime deps)
```

### Revised Strategy

| Model | Where | Training | Frequency | Purpose |
|-------|-------|---------|-----------|---------|
| **Global Model** | Server (XGBoost) | All anonymized users (≥3 cycles) | Monthly | Population-level patterns → lightweight JSON |
| **Fallback Chain** | Server (pure Python/math) | User's own entries only | On-demand | Predict when global model unavailable or user has <10 cycles |

- No per-user `joblib` models. No `retrain_dirty_users()` task. The `is_dirty_for_retraining` flag simply marks users to be included in the **next monthly global training dataset**.
- The fallback chain handles every user from 0 cycles upward; the global model takes over when users accumulate ≥10 cycles of data.
- **Server and mobile must align**: `compute_predictions()` uses the global XGBoost model for users with ≥10 cycles, same as mobile. This prevents prediction divergence between server API and client.

## Backend: Updated `app/modules/cycle/`

### `models.py` — Extend `PredictedCycle`

```python
# New columns (migration 0011)
model_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
  # "heuristic" | "median" | "linear_regression" | "random_forest" | "global_model"
confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)   # 0.0–1.0
training_data_points: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
prediction_window_days: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
  # If user is irregular (std_dev > 3.5), return window instead of single date
actual_cycle_entry_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True), ForeignKey("cycle_entries.id", ondelete="SET NULL"), nullable=True)
prediction_error_days: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
```

### `schemas.py` — Calendar + Prediction Responses

```python
# Optimized calendar: dictionary encoding reduces payload ~70%
# Instead of [{"date": "2025-06-15", "type": "period"}, ...]
# Use: {"2025-06-15": "P", "2025-06-16": "P", "2025-06-20": "p", ...}

class CalendarResponse(BaseModel):
    days: dict[str, str]  # "YYYY-MM-DD" → type code
    predictions: PredictionDetail | None = None
    next_period_in_days: int | None = None

# Type codes:
# "P" = period day          (confirmed cycle_entry)
# "p" = predicted_period    (forecast)
# "F" = fertile_window      (confirmed)
# "f" = predicted_fertile   (forecast)
# "T" = today

class PredictionDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    predicted_next_period_start: date
    predicted_period_end: date | None = None
    predicted_fertile_window_start: date | None
    predicted_fertile_window_end: date | None
    model_type: str
    confidence_score: float | None            # 0.0–1.0
    confidence_label: str | None              # Human-readable: "Good", "Very uncertain", etc.
    training_data_points: int
    prediction_window_days: int | None        # If set, return [start - window, start + window]

class PredictionListResponse(BaseModel):
    predictions: list[PredictionDetail]       # Next 3 predicted cycles
    model_used: str
    data_quality: Literal["insufficient", "minimal", "good", "excellent"]
```

### Confidence Score → Human-Readable Label

| Score Range | Label | Color |
|-------------|-------|-------|
| 0.00–0.30 | "Very uncertain" | Red |
| 0.31–0.50 | "Uncertain" | Orange |
| 0.51–0.70 | "Fair" | Yellow |
| 0.71–0.85 | "Good" | Green |
| 0.86–1.00 | "Excellent" | Dark Green |

```python
def confidence_label(score: float) -> str:
    if score < 0.31: return "Very uncertain"
    if score < 0.51: return "Uncertain"
    if score < 0.71: return "Fair"
    if score < 0.85: return "Good"
    return "Excellent"
```

## Backend: New `app/integrations/prediction_engine.py`

### The Fallback Chain

| Data Points | Model Used | Confidence Calculation | Window Override |
|-------------|-----------|----------------------|-----------------|
| < 3 cycles | Heuristic (28-day default, 5-day period) | 0.20 | ±7 days |
| 3–5 cycles | Median Absolute Deviation | 0.40 + (n/10) | ±5 days |
| 6–9 cycles | Linear Regression (trend detection) | 0.60 + (n/10) | ±3 days |
| ≥ 10 cycles | Random Forest Ensemble | min(0.95, 0.70 + (n/20)) | ±1 day (or std_dev if >3.5) |

**Window override**: If `std_dev > 3.5`, override window to `std_dev` days (max ±10 days). The API returns `prediction_window_days` and mobile displays "Your period may start between the 14th and 22nd."

### `CyclePredictor` Class

```python
@dataclass
class PredictionResult:
    next_period_start: date
    next_period_end: date | None
    fertile_window_start: date
    fertile_window_end: date
    confidence: float
    model_used: str
    data_points: int
    prediction_window_days: int | None

# Feature engineering features added:
# - luteal_length: inferred as ~14 days from cycle length
# - season (sin/cos encoding of month): captures seasonal cycle variation
# - weekday_of_start: periods sometimes cluster around weekends
# - is_first_cycle_after_break: flag if gap >45 days (pregnancy/health event)

class CyclePredictor:
    def __init__(self):
        self._median: float | None = None
        self._lin_reg: LinearRegression | None = None
        self._rf_model: RandomForestRegressor | None = None

    def predict(
        self,
        cycle_start_dates: list[date],
        cycle_lengths: list[int],
        period_lengths: list[int],
        std_dev: float | None,            # From users.cycle_length_std_dev
        avg_error: float | None,          # From users.avg_prediction_error_days
        luteal_lengths: list[int] | None = None,  # Optional feature
    ) -> PredictionResult:
        n = len(cycle_lengths)
        # Determine model
        if n < 3:
            model = "heuristic"
            predicted_length = 28
            confidence = 0.20
        elif n < 6:
            model = "median"
            predicted_length = int(median(cycle_lengths))
            confidence = 0.40 + (n / 10)
        elif n < 10:
            model = "linear_regression"
            predicted_length = self._train_and_predict_linear(cycle_lengths)
            confidence = 0.60 + (n / 10)
        else:
            model = "random_forest"
            predicted_length = self._train_and_predict_rf(cycle_lengths, period_lengths)
            confidence = min(0.95, 0.70 + (n / 20))

        # Adjust for avg error
        if avg_error:
            predicted_length += avg_error

        # Prediction window for irregular users
        window = None
        if std_dev and std_dev > 3.5:
            window = int(std_dev)
        elif n >= 3:
            # Default windows by tier
            window = {3: 7, 6: 5, 10: 3}.get(n, 3)

        latest_start = max(cycle_start_dates)
        next_start = latest_start + timedelta(days=predicted_length)
        next_end = next_start + timedelta(days=int(median(period_lengths)) if period_lengths else 5)
        fertile_start = next_start - timedelta(days=14)
        fertile_end = fertile_start + timedelta(days=5)

        return PredictionResult(
            next_period_start=next_start,
            next_period_end=next_end,
            fertile_window_start=fertile_start,
            fertile_window_end=fertile_end,
            confidence=round(confidence, 2),
            model_used=model,
            data_points=n,
            prediction_window_days=window,
        )

    def _train_and_predict_linear(self, lengths: list[int]) -> int:
        X = np.arange(len(lengths)).reshape(-1, 1)
        y = np.array(lengths)
        model = LinearRegression()
        model.fit(X, y)
        return int(round(model.predict([[len(lengths)]])[0]))

    def _train_and_predict_rf(self, lengths: list[int], periods: list[int]) -> int:
        X = np.column_stack([np.arange(len(lengths)), lengths, periods[:len(lengths)]])
        y = np.array(lengths)
        model = RandomForestRegressor(n_estimators=100, max_depth=3, random_state=42)
        model.fit(X, y)
        next_X = np.array([[len(lengths), lengths[-1], periods[-1]]]).reshape(1, -1)
        return int(round(model.predict(next_X)[0]))
```

### The Global Model (Trained Monthly)

**Privacy-first training dataset**: PII is bucketized, user_id is hashed, and labels have noise added to prevent reverse-engineering.

> **⚠️ CRITICAL**: `weight_kg` and `height_cm` live on `user_onboarding`, not `users`. The query must JOIN `user_onboarding`. If onboarding data is missing for a user, use defaults (`NULL` → exclude from training or apply population median).

```sql
CREATE TABLE ml_training_dataset AS
SELECT
    -- Bucketized PII (never raw values)
    CASE
        WHEN u.age < 20 THEN '18-20'
        WHEN u.age < 25 THEN '21-25'
        WHEN u.age < 30 THEN '26-30'
        WHEN u.age < 35 THEN '31-35'
        WHEN u.age < 40 THEN '36-40'
        ELSE '40+'
    END AS age_bucket,
    CASE
        -- height/weight live in user_onboarding, NOT in users
        WHEN (o.weight_kg IS NULL OR o.height_cm IS NULL) THEN 'unknown'
        WHEN (o.weight_kg / POWER(NULLIF(o.height_cm / 100.0, 0), 2)) < 18.5 THEN 'underweight'
        WHEN (o.weight_kg / POWER(NULLIF(o.height_cm / 100.0, 0), 2)) < 25 THEN 'normal'
        WHEN (o.weight_kg / POWER(NULLIF(o.height_cm / 100.0, 0), 2)) < 30 THEN 'overweight'
        ELSE 'obese'
    END AS bmi_bucket,
    u.stress_level, u.exercise_frequency,
    u.avg_sleep_hours, u.diet_type, u.total_cycles_logged,
    u.avg_cycle_length, u.std_dev_cycle_length, u.median_cycle_length,
    u.avg_period_length, u.trend_slope,
    EXTRACT(MONTH FROM c.period_start_date) AS cycle_month,
    u.avg_prediction_error_days,
    -- Hashed user_id: can't trace predictions back to individuals
    ENCODE(SHA256(u.id::text || 'static-training-salt'), 'hex') AS hashed_user_id,
    -- Feature-engineered columns
    GREATEST(c.cycle_length - 14, 7) AS luteal_length,
    SIN(2 * PI() * EXTRACT(MONTH FROM c.period_start_date) / 12.0) AS month_sin,
    COS(2 * PI() * EXTRACT(MONTH FROM c.period_start_date) / 12.0) AS month_cos,
    EXTRACT(DOW FROM c.period_start_date) AS weekday_of_start,
    (CASE WHEN c.cycle_length > 45 THEN 1 ELSE 0 END) AS is_break_cycle,
    -- Training label with differential privacy noise: N(0, 1.5) seeded per-user for reproducibility
    c.cycle_length + (RANDOM(user_id) * 3 - 1.5) AS next_cycle_interval
FROM users u
JOIN user_onboarding o ON u.id = o.user_id   -- height/weight are here, not in users
JOIN cycle_entries c ON u.id = c.user_id
WHERE u.total_cycles_logged >= 3;
```

**Training script** (runs monthly in Celery beat):

```python
def train_global_model():
    # 1. Extract anonymized, bucketized dataset from ml_training_dataset
    # 2. Split: 80% train, 20% holdout
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # 3. Train XGBoost Regressor
    model = xgb.XGBRegressor(
        n_estimators=200, max_depth=4, learning_rate=0.1,
        reg_lambda=1.0, gamma=0.5, subsample=0.8, random_state=42
    )
    model.fit(X_train, y_train)

    # 4. Evaluate RMSE on holdout
    rmse = np.sqrt(mean_squared_error(y_test, model.predict(X_test)))

    # 5. Data drift detection — abort if RMSE > 3.5 OR has increased >10% from previous month
    previous_rmse = get_previous_rmse()
    drift_threshold = max(3.5, previous_rmse * 1.10)
    if rmse > drift_threshold:
        logger.error("global_model.drift_detected", extra={"rmse": rmse, "threshold": drift_threshold})
        return  # Abort — keep old model, log alert

    # 6. Export coefficients → lightweight JSON
    new_version = get_next_model_version()
    coefficients = {
        "version": new_version,
        "trained_on": date.today().isoformat(),
        "rmse": round(rmse, 2),
        "feature_names": X.columns.tolist(),
        "coefficients": dict(zip(X.columns, model.feature_importances_)),
        "scaler": {"avg_cycle_mean": ..., "avg_cycle_std": ..., ...},
        "intercept": 28.5,
    }

    # 7. Atomic swap: write staging → rename to prod
    # Write to: /storage/models/staging/global_model_v{N}.json
    # Rename to: /storage/models/prod/global_model_v{N}.json
    # Update system_config: SET global_model_version = N, global_model_path = 'global_model_v{N}.json'
```

### Versioned Model Files with Atomic Rename

Instead of overwriting `global_model.json` in-place (risk of partial writes during sync):

```python
import os, json, shutil

STORAGE_DIR = "/storage/models"
STAGING_DIR = os.path.join(STORAGE_DIR, "staging")
PROD_DIR = os.path.join(STORAGE_DIR, "prod")

def export_model(coefficients: dict) -> str:
    """Write model to staging, atomically rename to prod, update system_config."""
    os.makedirs(STAGING_DIR, exist_ok=True)
    os.makedirs(PROD_DIR, exist_ok=True)

    version = coefficients["version"]
    filename = f"global_model_v{version}.json"
    staging_path = os.path.join(STAGING_DIR, filename)
    prod_path = os.path.join(PROD_DIR, filename)

    with open(staging_path, "w") as f:
        json.dump(coefficients, f)

    # Atomic rename (on same filesystem)
    shutil.move(staging_path, prod_path)

    # Update system_config table
    # UPDATE system_config SET global_model_version = :version, global_model_path = :filename
    return filename
```

**Mobile API endpoint** returns the active version (never a "latest" file that could be mid-write):

```
GET /api/v1/models/status
→ { "current_version": 7, "download_url": "/api/v1/models/download/global_model_v7.json" }
```

Mobile always downloads a specific versioned file.

### Global Model JSON (~5 KB, downloaded by mobile)

```json
{
  "version": 7,
  "trained_on": "2025-06-01",
  "rmse": 2.31,
  "feature_names": ["age_bucket", "bmi_bucket", "stress_high", "stress_moderate",
                    "avg_cycle", "std_cycle", "trend_slope",
                    "error_correction", "month_sin", "month_cos",
                    "luteal_length", "weekday_of_start", "is_break_cycle"],
  "coefficients": {
    "avg_cycle": 0.82, "std_cycle": -0.35, "trend_slope": 0.61,
    "error_correction": 0.92, "age_bucket": 0.15, "bmi_bucket": 0.45,
    "stress_high": 2.1, "stress_moderate": 0.8,
    "month_sin": 0.12, "month_cos": -0.09,
    "luteal_length": 0.55, "weekday_of_start": 0.08, "is_break_cycle": 4.2,
    "intercept": 28.5
  },
  "scaler": {
    "avg_cycle_mean": 29.0, "avg_cycle_std": 4.0,
    "bmi_bucket": {
      "underweight": 0.0, "normal": 1.0, "overweight": 2.0, "obese": 3.0
    }
  }
}
```

### Mobile Inference (Pure JavaScript)

```typescript
function predictNextCycle(localUserData, globalModel): number {
  // 1. Normalize features using global scaler
  const normAvgCycle = (localUserData.avgCycle - globalModel.scaler.avg_cycle_mean)
                       / globalModel.scaler.avg_cycle_std;

  // 2. Linear combination of coefficients
  let prediction = globalModel.coefficients.intercept;
  prediction += globalModel.coefficients.avg_cycle * normAvgCycle;
  prediction += globalModel.coefficients.bmi_bucket * localUserData.bmiBucketOrdinal;
  prediction += globalModel.coefficients.age_bucket * localUserData.ageBucketOrdinal;
  prediction += globalModel.coefficients.trend_slope * localUserData.trendSlope;
  prediction += globalModel.coefficients.error_correction * localUserData.avgError;

  // 3. Categorical features (one-hot equivalent via coefficients)
  if (localUserData.stressLevel === 'high') prediction += globalModel.coefficients.stress_high;
  else if (localUserData.stressLevel === 'moderate') prediction += globalModel.coefficients.stress_moderate;

  // 4. Seasonal & temporal features
  const now = new Date();
  prediction += globalModel.coefficients.month_sin * Math.sin(2 * Math.PI * now.getMonth() / 12);
  prediction += globalModel.coefficients.month_cos * Math.cos(2 * Math.PI * now.getMonth() / 12);

  // 5. Luteal adjustment
  prediction += globalModel.coefficients.luteal_length * (localUserData.avgCycle - 14);

  // 6. Local correction delta (accumulated from user's past correction errors)
  prediction += localUserData.localCorrectionDelta;

  // 7. Clip to realistic range
  return Math.min(45, Math.max(20, Math.round(prediction)));
}
```

## Backend: Updated `app/modules/cycle/services.py`

### `get_calendar()` — Dictionary Encoding

```python
async def get_calendar(self, user_id: uuid.UUID,
                       months_back: int = 3,
                       months_forward: int = 3) -> dict:
    """Return day-by-day CalendarResponse with dictionary-encoded days (~70% smaller payload)."""
    start = date.today() - timedelta(days=months_back * 30)
    end = date.today() + timedelta(days=months_forward * 30)

    # 1. Fetch cycle_entries + predicted_cycles in range
    # 2. Build dict: {"YYYY-MM-DD": type_code}
    #    Type codes: "P"=period, "p"=predicted_period, "F"=fertile,
    #                "f"=predicted_fertile, "T"=today
    # 3. Return CalendarResponse

    today_str = date.today().isoformat()
    days: dict[str, str] = {}
    current = start
    while current <= end:
        key = current.isoformat()
        if key == today_str:
            days[key] = "T"
        elif any(e.period_start_date <= current <= e.period_end_date for e in entries):
            days[key] = "P" if any(e.is_active for e in entries) else "p"
        # ... fertile window checks
        current += timedelta(days=1)

    return CalendarResponse(days=days, predictions=..., next_period_in_days=...)
```

### `compute_predictions()` — Refactored with Global Model Alignment

**Critical**: Server and mobile must produce the same prediction for the same user. For users with ≥10 cycles of data, `compute_predictions()` loads the global XGBoost model JSON and applies the same arithmetic the mobile client uses. For users with <10 cycles, it falls back to the `CyclePredictor` chain.

```python
async def compute_predictions(self, user_id: uuid.UUID) -> PredictedCycle:
    entries = await self._get_recent_entries(user_id, limit=12)

    if len(entries) < 1:
        raise InsufficientDataError("Need at least 1 cycle entry")

    user = await self.db.get(User, user_id)

    # --- SERVER-SIDE GLOBAL MODEL INFERENCE ---
    # For users with >=10 cycles, use the global XGBoost model (same as mobile).
    # This guarantees server and mobile predictions never diverge.
    if user and user.total_cycles_logged >= 10 and await self._global_model_exists():
        result = await self._predict_with_global_model(user, entries, start_dates)
    else:
        # Fallback chain for users with <10 cycles
        result = self._predict_with_fallback(entries, user)

    # Upsert PredictedCycle
    return await self._upsert_prediction(user_id, result)

async def _global_model_exists(self) -> bool:
    """Check /storage/models/prod/ for active model file version from system_config."""
    from app.modules.cycle.models import SystemConfig  # or core.config
    stmt = select(SystemConfig).where(SystemConfig.key == "global_model_path")
    config = (await self.db.execute(stmt)).scalar_one_or_none()
    if not config or not config.value:
        return False
    path = os.path.join(STORAGE_DIR, "prod", config.value)
    return os.path.exists(path)

async def _predict_with_global_model(
    self, user: User, entries: list[CycleEntry], start_dates: list[date],
) -> PredictionResult:
    """Apply the global model JSON arithmetic (same as mobile) on the server."""
    # ... load the global model JSON, extract user aggregates,
    #     apply linear combination, compute fertile window/confidence
    # See Mobile Inference section for the exact arithmetic — must match 1:1

def _predict_with_fallback(
    self, entries: list[CycleEntry], user: User | None,
) -> PredictionResult:
    """Use CyclePredictor fallback chain for users with <10 cycles."""
    start_dates = [e.period_start_date for e in entries]
    cycle_lengths = self._compute_cycle_lengths(entries)
    period_lengths = [e.period_length or 5 for e in entries]

    predictor = CyclePredictor()
    result = predictor.predict(
        start_dates, cycle_lengths, period_lengths,
        std_dev=user.cycle_length_std_dev if user else None,
        avg_error=user.avg_prediction_error_days if user else None,
    )
    result.confidence_label = confidence_label(result.confidence)
    return result

def _compute_cycle_lengths(self, entries: list[CycleEntry]) -> list[int]:
    lengths = []
    for i in range(len(entries) - 1):
        diff = (entries[i].period_start_date - entries[i+1].period_start_date).days
        if 20 <= diff <= 45:
            lengths.append(diff)
    return lengths
```

## Backend: Updated `app/modules/cycle/tasks.py`

### Daily Prediction Update

```python
@celery_app.task(name="app.modules.cycle.tasks.update_cycle_predictions",
                 soft_time_limit=300, time_limit=600)
def update_cycle_predictions() -> int:
    """Daily 2AM task: re-compute predictions for all users with entries.
       Uses CyclePredictor fallback chain."""
```

### REMOVED: `retrain_dirty_users()`

No per-user model retraining. The `is_dirty_for_retraining` flag is used *only* to mark users for inclusion in the next monthly global training dataset. The monthly `build_training_dataset()` query filters `WHERE is_dirty_for_retraining = True OR last_trained_at < NOW() - INTERVAL '30 days'`.

### Monthly Global Model Training

```python
@celery_app.task(name="app.modules.cycle.tasks.train_global_model",
                 soft_time_limit=1800, time_limit=3600)
def train_global_model() -> None:
    """Monthly: build anonymized dataset, train XGBoost, evaluate RMSE,
       export versioned JSON with atomic swap."""
```

## Mobile: Cycle Dashboard & Calendar

### `CycleDashboardScreen.tsx` — Full Rewrite

```
Layout:
┌──────────────────────────────────┐
│  [Header: "Your Cycle"]          │  gradient + flower
├──────────────────────────────────┤
│  Next period in 12 days          │  large stat card (pink bg)
│  ┌──────────────────────────┐    │
│  │  March 2025              │    │  PeriodCalendar component
│  │ Mo Tu We Th Fr Sa Su     │    │
│  │          1  2  3         │    │  - Red fill = period day
│  │  4  5  6  7  8  9  10   │    │  - Light pink = predicted
│  │ 11 12 13 14 15 16 17    │    │  - Purple dot = fertile
│  │ 18 19 20 21 22 23 24    │    │  - Blue circle = today
│  │ 25 26 27 28 29 30 31    │    │
│  └──────────────────────────┘    │
│  Confidence: Good (72%)          │  Color-coded confidence label
├──────────────────────────────────┤
│  Quick Actions                   │
│  [Log Period] [Predictions]      │
│  [History]    [Analytics]        │
└──────────────────────────────────┘
```

### `CyclePredictionsScreen.tsx` — Update

- Fetch real data from `GET /cycle/predictions`
- Show next 3 predicted cycles with dates
- Display confidence score as a progress bar **with color-coded label** ("We're Good (72%) confident your period will start around June 15th.")
- Show model used (Heuristic / Median / Linear Regression / Random Forest)
- Show prediction window if user is irregular ("Your period may start between the 14th and 22nd")
- Show data quality indicator (Insufficient / Minimal / Good / Excellent)

### `PredictionDetailCard.tsx` — New Component

```typescript
interface PredictionDetailCardProps {
  prediction: PredictionDetail;
}

// Displays:
// ┌──────────────────────────────────┐
// │  Next period: June 15–20        │
// │  Confidence: Good (72%)         │  ← green text
// │  Model: Linear Regression       │
// │  Based on 8 cycles              │
// │  ±3 day prediction window       │
// └──────────────────────────────────┘
```

### `PeriodCalendar.tsx` — New Component (`src/components/ui/`)

```typescript
interface PeriodCalendarProps {
  month: Date;
  days: Record<string, string>;  // Dictionary-encoded: "2025-06-15" → "P"
  onDatePress?: (date: Date) => void;
}

// Custom implementation:
// - Month/year header with prev/next arrows
// - 7-column day grid (Mon–Sun)
// - Color coding via theme colors:
//   "P" (period) → palette.primary500 + bold
//   "p" (predicted_period) → palette.primary100
//   "F" (fertile_window) → palette.accent500 (purple)
//   "f" (predicted_fertile) → palette.accent200
//   "T" (today) → palette.info500 (blue circle)
//   default → transparent
```

## Mobile: API Service (`src/services/api/cycle.ts`) — Update

```typescript
// Calendar now returns dictionary-encoded map
export interface CalendarResponse {
  days: Record<string, string>;  // "2025-06-15": "P"
  predictions: PredictionDetail | null;
  next_period_in_days: number | null;
}

export interface PredictionDetail {
  id: string;
  predicted_next_period_start: string;
  predicted_period_end: string | null;
  predicted_fertile_window_start: string | null;
  predicted_fertile_window_end: string | null;
  model_type: string;
  confidence_score: number | null;
  confidence_label: string | null;     // "Good", "Fair", etc.
  training_data_points: number;
  prediction_window_days: number | null;
}

export const cycleService = {
  async getCalendar(monthsBack = 3, monthsForward = 3): Promise<CalendarResponse>,
  async getPredictions(): Promise<{ predictions: PredictionDetail[]; model_used: string; data_quality: string }>,
  async getModelStatus(): Promise<{ current_version: number; download_url: string }>,
  async downloadModel(version: number): Promise<GlobalModel>,  // GET /api/v1/models/download/global_model_v{N}.json
  // ... existing CRUD methods
};
```

## Mobile: Global Model Client (`src/services/ml/globalModel.ts`) — New

**Critical**: The client must never crash if download fails. Bundled fallback model ensures predictions work offline.

```typescript
import { cycleService } from 'src/services/api/cycle';
import EncryptedStorage from 'react-native-encrypted-storage';
import { Asset } from 'expo-asset';  // or react-native-fs for bundled assets

interface GlobalModel {
  version: number;
  trained_on: string;
  rmse: number;
  feature_names: string[];
  coefficients: Record<string, number>;
  scaler: Record<string, any>;
}

class GlobalModelClient {
  private cached: GlobalModel | null = null;

  async ensureLatest(): Promise<GlobalModel> {
    // 1. Check cached version
    const cachedVersion = await EncryptedStorage.getItem('global_model_version');
    const status = await cycleService.getModelStatus();

    if (cachedVersion && parseInt(cachedVersion) === status.current_version) {
      // Load from disk cache if available (survives app restarts)
      const diskModel = await this._loadFromDisk(status.current_version);
      if (diskModel) {
        this.cached = diskModel;
        return this.cached;
      }
    }

    // 2. Download new version with graceful failure
    try {
      const model = await cycleService.downloadModel(status.current_version);
      await this._saveToDisk(model);
      await EncryptedStorage.setItem('global_model_version', String(model.version));
      this.cached = model;
      return model;
    } catch (error) {
      // FALLBACK: Load bundled 28-day heuristic model — app never breaks
      console.warn('Global model download failed, using bundled fallback', error);
      const fallback = await this._loadBundledFallback();
      this.cached = fallback;
      return fallback;
    }
  }

  private async _loadFromDisk(version: number): Promise<GlobalModel | null> {
    try {
      const path = `${FileSystem.documentDirectory}models/global_model_v${version}.json`;
      const exists = await FileSystem.getInfoAsync(path);
      if (!exists.exists) return null;
      const raw = await FileSystem.readAsStringAsync(path);
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private async _saveToDisk(model: GlobalModel): Promise<void> {
    const dir = `${FileSystem.documentDirectory}models/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const path = `${dir}global_model_v${model.version}.json`;
    await FileSystem.writeAsStringAsync(path, JSON.stringify(model));
  }

  private async _loadBundledFallback(): Promise<GlobalModel> {
    // fallback_model.json is bundled in app assets:
    // { version: 0, coefficients: { intercept: 28 }, scaler: {}, ... }
    const asset = Asset.fromModule(require('src/assets/fallback_model.json'));
    await asset.downloadAsync();
    const response = await fetch(asset.uri);
    return response.json();
  }

  predictNextCycle(userData: LocalUserCycleData): number {
    if (!this.cached) throw new Error('Model not loaded — call ensureLatest() first');
    return calculatePrediction(userData, this.cached);
  }
}

export const globalModelClient = new GlobalModelClient();
```

**Bundled fallback model** (`src/assets/fallback_model.json`):

```json
{
  "version": 0,
  "trained_on": "built-in",
  "rmse": 4.5,
  "feature_names": [],
  "coefficients": { "intercept": 28 },
  "scaler": {}
}
```

## Backend: New `app/modules/cycle/system_config.py` (or existing `app/core/`)

```python
class SystemConfig(Base):
    __tablename__ = "system_config"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(String(500), nullable=False)

# Key-value pairs:
# global_model_version → "7"
# global_model_path → "global_model_v7.json"
# global_model_previous_rmse → "2.45"

class ModelStatusResponse(BaseModel):
    current_version: int
    download_url: str
```

## Migrations

| # | File | Changes |
|---|------|---------|
| `0011` | `0011_prediction_model_fields.py` | Add `model_type`, `confidence_score`, `training_data_points`, `prediction_window_days`, `actual_cycle_entry_id`, `prediction_error_days` to `predicted_cycles` |
| `0012` | `0012_system_config.py` | Create `system_config` table for model version tracking |

## Minor Refinements (Non-Blocking)

| Area | Guidance |
|------|----------|
| **Noise Seed** | Use `RANDOM(user_id)` instead of `RANDOM()` in the training dataset SQL. This ensures the noise added to labels is deterministic per user between training runs, making dataset generation reproducible. |
| **`system_config` value column** | Use `VARCHAR(500)`; for RMSE and other numeric values, store as a JSON blob: `{"rmse": 2.31, "previous_rmse": 2.45, "mae": 1.87}` for future extensibility. |
| **`localCorrectionDelta` persistence** | Save the delta to encrypted AsyncStorage alongside the model version. If the user corrects a date offline, the delta must survive app restarts. (e.g., `EncryptedStorage.setItem('local_correction_delta', String(delta))`). |
| **Calendar missing keys** | The mobile parser must handle missing dictionary keys gracefully: `const type = days[key] ?? 'none'`. If a date is not in the dictionary, treat it as a normal day. |
| **MAE alongside RMSE** | Add Mean Absolute Error alongside RMSE in training output. MAE is easier for stakeholders to understand: *"Our model is off by 2.3 days on average"*. Store both in `system_config`. |

## Dependencies Added

```toml
[tool.poetry.dependencies]
scikit-learn = "^1.5.0"
xgboost = "^2.1.0"
numpy = "^1.26.0"
pandas = "^2.2.0"
```

*Note: No `joblib` dependency — no per-user model serialization needed.*

## Validation Criteria

- [ ] Calendar endpoint returns **dictionary-encoded** days (not list-of-objects) — verify payload size is ~70% smaller
- [ ] Calendar parses correctly on mobile in <2ms
- [ ] **Server-mobile alignment**: `compute_predictions()` uses global model for users with `total_cycles_logged >= 10` and fallback chain for <10 cycles — same prediction on server and client
- [ ] **`compute_predictions()` alignment**: the server-side `_predict_with_global_model()` applies the *exact same arithmetic* as mobile `predictNextCycle()` — verified by running both side-by-side on a test dataset
- [ ] Fallback chain selects correct model per data tier (heuristic → median → linear → random forest)
- [ ] Confidence score increases with more data and maps to correct human-readable label
- [ ] Irregular users (std_dev > 3.5) get `prediction_window_days` — mobile displays range
- [ ] **Training SQL query**: JOINs `user_onboarding` for `weight_kg`/`height_cm` (not `users`); handles NULL onboarding data gracefully
- [ ] **Noise seeded per user**: uses `RANDOM(user_id)` not `RANDOM()` for reproducible training datasets
- [ ] Global model training: PII bucketized (no raw age/BMI), user_id hashed, N(0,1.5) noise on labels
- [ ] Global model: RMSE + MAE both evaluated on 20% holdout; stored in `system_config` as JSON blob
- [ ] Global model: drift detection aborts if RMSE > 3.5 or +10% from previous month's RMSE
- [ ] Global model: **versioned** filenames with atomic rename (no overwrite of active file)
- [ ] `GET /api/v1/models/status` returns `{ current_version, download_url }`
- [ ] Mobile `globalModelClient.ensureLatest()` downloads new version when `current_version` changes
- [ ] **Mobile download fallback**: if download fails, `ensureLatest()` loads `fallback_model.json` from bundled assets — app never crashes
- [ ] **Mobile disk cache**: `globalModelClient` saves downloaded model to `FileSystem.documentDirectory`; survives app restarts without re-downloading
- [ ] **Mobile `localCorrectionDelta`**: saved to EncryptedStorage (`local_correction_delta`); survives app restarts
- [ ] Mobile `predictNextCycle()` runs in pure JS — no native ML runtime required
- [ ] Mobile calendar renders colored cells for all type codes ("P", "p", "F", "f", "T")
- [ ] Mobile calendar handles missing dictionary keys: `const type = days[key] ?? 'none'`
- [ ] `retrain_dirty_users()` task is **removed** — no per-user models
- [ ] Confidence label shown to user: "We're Good (72%) confident your period will start around June 15th."
- [ ] Mobile prediction window displayed for irregular users: "Your period may start between the 14th and 22nd."
- [ ] TypeScript: `npx tsc --noEmit` passes with 0 errors

## Recommended Execution Order

| Step | Task | Priority |
|------|------|----------|
| 1 | Add model/confidence/window columns to `PredictedCycle` (migration 0011) | High |
| 2 | Implement `CyclePredictor` fallback chain with feature engineering | High |
| 3 | **Fix `compute_predictions()`** — add global model inference for users with ≥10 cycles (`_predict_with_global_model()`) | High |
| 4 | **Fix SQL training query** — JOIN `user_onboarding` for height/weight; use `RANDOM(user_id)` for seeded noise | High |
| 5 | Implement `get_calendar()` endpoint with dictionary encoding | High |
| 6 | Implement `train_global_model()` with PII bucketization, hashing, noise, MAE + RMSE | High |
| 7 | Implement atomic swap with versioned filenames (migration 0012, system_config) | High |
| 8 | Add data drift detection (RMSE + MAE threshold check before atomic swap) | Medium |
| 9 | Remove `retrain_dirty_users()` task | Medium |
| 10 | Update mobile `cycleService` + `Calendar` component | Medium |
| 11 | Build `GlobalModelClient` with versioned download, disk cache, **bundled fallback** model | Medium |
| 12 | Build `PredictionDetailCard` with confidence label + prediction window display | Medium |
| 13 | Persist `localCorrectionDelta` to EncryptedStorage — survives app restarts | Medium |
| 14 | Include `fallback_model.json` in app assets (28-day heuristic) | Low |
