# SheCare App Workflow — Onboarding, Cycle & Wellness Modules

> Detailed end-to-end workflows covering frontend screens, backend services,
> database operations, event bus, Celery tasks, and ML model interactions.

---

## Table of Contents

1. [Onboarding Module](#1-onboarding-module)
2. [Cycle Module](#2-cycle-module)
3. [Wellness Module](#3-wellness-module)
4. [Cross-Module Event Flow](#4-cross-module-event-flow)

---

## 1. Onboarding Module

### 1.1 Purpose

The onboarding module collects demographic, lifestyle, and menstrual history
data from a new user. It gates app access: `onboarding_completed = false`
shows the OnboardingStack; `true` shows MainTabs. It is also the trigger for
cycle backfill and the first prediction computation.

### 1.2 Database Model

**Table:** `user_onboarding` (`backend/app/modules/onboarding/models.py`)

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID (FK → `users.id`) | Unique per user |
| `age` | SmallInteger | 13–120 |
| `height_cm` | Float | 50–250 cm |
| `weight_kg` | Float | 20–300 kg |
| `stress_level` | String | `low` \| `moderate` \| `high` |
| `exercise_frequency` | String | `low` \| `moderate` \| `high` |
| `sleep_hours` | Float | 0–24 |
| `diet` | String | `balanced` \| `normal` \| `junk` |
| `current_cycle_start` | Date | Most recent period start |
| `current_cycle_length` | SmallInteger | 20–45 days |
| `current_period_length` | SmallInteger | 2–10 days |
| `current_symptoms` | JSONB | `list[str]` |
| `past_cycles` | JSONB | `list[PastCycleSchema]` (max 3) |
| `onboarding_completed` | Boolean | Default `false` |
| `completed_at` | DateTime (TZ) | Set when first completed |

### 1.3 Frontend Flow (6 steps)

All screens live under `mobile/src/screens/onboarding/`. Navigation is a
dedicated `OnboardingStack` that is replaced by `MainTabs` on completion.

```
WelcomeScreen → PersonalInfoScreen → LifestyleScreen
    → CurrentCycleScreen → PastCycleScreen(1-3) → CompleteScreen
```

#### Step 0 — WelcomeScreen (`WelcomeScreen.tsx`)

- **Route:** `Welcome` (onboarding stack)
- **Content:** Brand splash, progress dots (0/6), "Get started" button
- **Action:** Navigate to `PersonalInfo`
- **State:** No data submission yet

#### Step 1 — PersonalInfoScreen (`PersonalInfoScreen.tsx`)

- **Route:** `PersonalInfo` (onboarding stack)
- **Form:** `personalInfoSchema` (Zod + react-hook-form)
  - `age`: integer, 13–120
  - `heightCm`: picker, 50–250 cm
  - `weightKg`: picker, 20–300 kg
- **Validation:** `zodResolver`, `mode: 'onBlur'`
- **State store:** `useOnboardingStore.setPersonalInfo(data)`
- **Action on submit:** Navigate to `Lifestyle`
- **Persistence:** Zustand store only (not yet sent to backend)

#### Step 2 — LifestyleScreen (`LifestyleScreen.tsx`)

- **Route:** `Lifestyle` (onboarding stack)
- **Form:** `lifestyleSchema`
  - `stressLevel`: toggle group — `low` / `moderate` / `high`
  - `exerciseFrequency`: toggle group — `low` / `moderate` / `high`
  - `sleepHours`: Slider, 4–12 h, step 0.5
  - `diet`: toggle group — `balanced` / `normal` / `junk`
- **State store:** `useOnboardingStore.setLifestyle(data)`
- **Action on submit:** Navigate to `CurrentCycle`

#### Step 3 — CurrentCycleScreen (`CurrentCycleScreen.tsx`)

- **Route:** `CurrentCycle` (onboarding stack)
- **Form:** `currentCycleSchema`
  - `cycleStartDate`: Date picker, max date = today
  - `cycleLength`: numeric, 20–45
  - `periodLength`: numeric, 2–10
  - `symptoms`: multi-select chip grid (10 preset options)
- **Validation:** Zod validators enforce ranges and max_date_today
- **State store:** `useOnboardingStore.setCurrentCycle(data)`
- **Action on submit:** Navigate to `PastCycle1`

#### Step 4 — PastCycleScreen (`PastCycleScreen.tsx`) — reused 3×

- **Routes:** `PastCycle1`, `PastCycle2`, `PastCycle3` (same component)
- **Form:** `pastCycleSchema` per cycle
  - `cycleStart`: date, must be in the past
  - `cycleLength`: 20–45
  - `periodLength`: 2–10
  - `symptoms`: multi-select chips
- **Navigation logic:**
  - `PastCycle1 → PastCycle2 → PastCycle3 → Complete`
  - Back buttons navigate to previous screen
- **State store:** `useOnboardingStore.addPastCycle(data)`
- **Optional:** User can skip past cycle steps if they don't want to provide history

#### Step 5 — CompleteScreen (`CompleteScreen.tsx`)

- **Route:** `Complete` (onboarding stack)
- **Trigger:** Calls `submitOnboarding()` from store
- **Backend call:**
  ```
  PUT /api/v1/onboarding
  Body: OnboardingCreate (all collected data)
  ```
- **Response:** `OnboardingResponse` (includes `id`, `onboarding_completed: true`)
- **Post-submit:**
  - `navigation.dispatch(CommonActions.reset({ routes: [{ name: 'Main' }] }))`
  - Replaces the entire stack with MainTabs
- **Side effects (backend):**
  - `onboarding_completed` event emitted on event bus
  - Cycle module subscribes → calls `compute_initial_prediction()`
  - Backfill inserts `CycleEntry` rows for current + past cycles

### 1.4 Backend API

**Base path:** `/api/v1/onboarding`
**File:** `backend/app/modules/onboarding/routes.py`

#### `PUT /api/v1/onboarding` — Upsert onboarding (idempotent)

**Depends:** `CurrentUser`, `OnboardingServiceDep`
**Request body:** `OnboardingCreate`
**Response:** `200 OK` + `OnboardingResponse`

**Service logic** (`services.py:32-74`):
1. `SELECT` from `user_onboarding` WHERE `user_id = ?`
2. If `None` → create new `UserOnboarding` instance
3. Apply all fields from payload (`age`, `height_cm`, … `past_cycles`)
4. If not already completed:
   - Set `onboarding_completed = True`
   - Set `completed_at = datetime.now(UTC)`
5. `DB.flush()`
6. If first completion → call `_backfill_cycles()`
7. `DB.commit()` + `refresh`
8. Emit `onboarding_completed` event (if event bus available)

#### `GET /api/v1/onboarding` — Fetch current onboarding

**Response:** `200 OK` + `OnboardingResponse`
**Error:** `404` → `OnboardingNotFoundError`

#### `GET /api/v1/onboarding/status` — Completion check

**Response:** `200 OK` + `{ "completed": bool }`

### 1.5 Backfill Logic (`services.py:76-133`)

Called once when onboarding transitions from incomplete → complete.

```
_cycle_exists(user_id, period_start_date) → bool
  SELECT 1 FROM cycle_entries WHERE user_id=? AND period_start_date=? AND is_active=true
```

For each cycle (current + past):
1. Compute `period_end_date = period_start + period_length_days`
2. Check if `(user_id, period_start_date)` already exists
3. If not → `INSERT INTO cycle_entries`:
   - `user_id`, `period_start_date`, `period_end_date`
   - `symptoms` from onboarding
   - `flow_intensity` = `null`
   - `mood_tags` = `[]`
   - `energy_level` = `null`
   - `notes` = `null`

**Idempotent:** duplicates are skipped (logged at INFO level).

---

## 2. Cycle Module

### 2.1 Purpose

The cycle module tracks period entries, generates ML-augmented predictions,
provides a compact calendar view, analytics, and a correction feedback loop
that improves future predictions.

### 2.2 Database Models

**File:** `backend/app/modules/cycle/models.py`

#### `cycle_entries`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID (FK `users.id`) | CASCADE delete |
| `period_start_date` | Date | Indexed |
| `period_end_date` | Date \| null | |
| `flow_intensity` | String(10) \| null | e.g. "Light", "Medium" |
| `symptoms` | JSONB | `list[str]` |
| `mood_tags` | JSONB | `list[str]` |
| `energy_level` | SmallInteger \| null | 1–5 |
| `notes` | String \| null | Encrypted at rest (service layer) |
| `corrected_prediction_id` | UUID \| null | FK → `predicted_cycles.id` |
| `is_correction` | Boolean | Default `false` |
| `is_active` | Boolean | Soft delete flag |
| **Unique constraint** | (`user_id`, `period_start_date`) | Prevents duplicates |

#### `predicted_cycles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID (FK) | CASCADE |
| `predicted_next_period_start` | Date | Indexed |
| `predicted_fertile_window_start` | Date \| null | |
| `predicted_fertile_window_end` | Date \| null | |
| `model_version` | String(20) | Default `"rule_based_v2"` |
| `actual_cycle_entry_id` | UUID \| null | FK → `cycle_entries.id` |
| `prediction_error_days` | SmallInteger \| null | For retraining |
| `model_type` | String(20) \| null | `"global_model"` or `"fallback_median"` |
| `confidence_score` | Float \| null | 0–1 |
| `training_data_points` | SmallInteger \| null | |
| `prediction_window_days` | SmallInteger \| null | std-dev based window |
| `is_active` | Boolean | Soft delete |

#### `snooze_events`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID (FK) | CASCADE |
| `predicted_cycle_id` | UUID (FK) | CASCADE |
| `snoozed_at` | DateTime (TZ) | Server default `now()` |
| `day_offset` | SmallInteger | ≥0 |

#### `system_config`

| Column | Type |
|--------|------|
| `key` | String(100), PK |
| `value` | Text |

Stores `global_model_version` and `global_model_path` for ML model downloads.

### 2.3 Backend API (7 endpoints + 2 model endpoints)

**Base path:** `/api/v1/cycle`

#### `POST /api/v1/cycle/entries` — Log a period entry

**Request:** `CycleEntryCreate`
- `period_start_date` (date, required)
- `period_end_date` (date, optional)
- `flow_intensity` (str, ≤10 chars, optional)
- `symptoms` (list[str])
- `mood_tags` (list[str])
- `energy_level` (int, 1–5, optional)
- `notes` (str, optional)

**Response:** `201 Created` + `CycleEntryResponse`

**Service logic** (`services.py:40-68`):
1. `INSERT INTO cycle_entries` (all fields from request)
2. On `IntegrityError` (unique constraint):
   - `ROLLBACK`
   - `SELECT` existing entry for `(user_id, period_start_date)`
   - Update mutable fields with incoming data
   - `COMMIT` + `REFRESH` existing row
3. Returns `CycleEntry` ORM object

#### `GET /api/v1/cycle/entries` — List entries

**Query params:**
- `limit`: 1–200 (default 50)
- `offset`: ≥0 (default 0)
- `months_back`: 1–36 (default 6)

**Service logic** (`services.py:94-108`):
- `cutoff = today - months_back * 30 days`
- `SELECT` where `user_id=? AND period_start_date >= cutoff AND is_active=true`
- Order by `period_start_date DESC`
- Apply `OFFSET` + `LIMIT`

**Response:** `200 OK` + `list[CycleEntryResponse]`

#### `GET /api/v1/cycle/entries/{entry_id}` — Get one entry

**Service:** `get_entry(entry_id, user_id)` — joined filter by user + id + active
**Error:** `CycleEntryNotFoundError` → 404

#### `PUT /api/v1/cycle/entries/{entry_id}` — Update entry

**Request:** `CycleEntryUpdate` (all fields optional)
**Service:** `update_entry()` — loads existing, applies `model_dump(exclude_unset=True)`

#### `DELETE /api/v1/cycle/entries/{entry_id}` — Soft delete

Sets `is_active = False`. Returns `204 No Content`.

#### `GET /api/v1/cycle/predictions` — Next 3 predicted cycles

**Service logic** (`services.py:343-371`):
1. Load latest `PredictedCycle` for user
2. Load recent 12 entries
3. Compute `avg_cycle` from entry intervals (median)
4. Generate 3 predictions by adding `avg_cycle` days sequentially
5. Copy metadata from latest prediction record

**Response:** `200 OK` + `PredictionListResponse`
```json
{
  "predictions": [
    {
      "id": "uuid",
      "predicted_next_period_start": "2026-07-10",
      "predicted_period_end": "2026-07-15",
      "predicted_fertile_window_start": "2026-06-26",
      "predicted_fertile_window_end": "2026-07-01",
      "model_type": "global_model",
      "confidence_score": 0.84,
      "confidence_label": "Good",
      "training_data_points": 12,
      "prediction_window_days": 3
    }
  ],
  "model_used": "global_model",
  "data_quality": "good"
}
```
`confidence_label` is derived from score:
- `< 0.31`: Very uncertain
- `< 0.51`: Uncertain
- `< 0.71`: Fair
- `< 0.85`: Good
- `≥ 0.85`: Excellent

#### `GET /api/v1/cycle/analytics` — User analytics

**Service** (`services.py:608-653`):
- Computes from all active entries with `period_end_date IS NOT NULL`
- `average_cycle_length_days`: median of inter-start intervals (20–45 days only)
- `shortest_cycle_days`: min of above intervals
- `longest_cycle_days`: max of above intervals
- `common_symptoms`: top 10 by frequency → `[{"symptom": "Cramps", "count": 8}, …]`
- `common_moods`: top 10 by frequency
- `total_entries`: count

**Response:** `200 OK` + `AnalyticsResponse`

#### `POST /api/v1/cycle/corrections` — Log period correction

Used when user's actual period deviated from a prediction.
**Request:** `CorrectionCreate`
- `period_start_date` (date)
- `period_end_date` (date, optional)
- `symptoms` (list[str])
- `corrected_prediction_id` (str/UUID, optional)

**Service logic** (`services.py:502-531`):
1. `INSERT INTO cycle_entries` with `is_correction=true`
2. If `corrected_prediction_id` provided:
   - Load prediction
   - `error_days = (new_period_start - predicted_next_start).days`
   - Set `prediction.actual_cycle_entry_id = entry.id`
   - Set `prediction.prediction_error_days = error_days`
   - Call `_update_user_ml_metrics()`:
     - Updates `User.avg_prediction_error_days` (running average)
     - Increments `User.total_cycles_logged`
     - Sets `User.is_dirty_for_retraining = True`
     - Recomputes `User.avg_cycle_length` and `cycle_length_std_dev`
3. `COMMIT`

**Response:** `201 Created` + `CorrectionResponse`

#### `POST /api/v1/cycle/snooze` — "Not yet" on a prediction

**Request:** `SnoozeCreate`
- `predicted_cycle_id` (str/UUID)
- `day_offset` (int, ≥0)

**Service:** `log_snooze()` → `INSERT INTO snooze_events`
**Response:** `201 Created` + `SnoozeResponse`

#### `GET /api/v1/cycle/calendar` — Dictionary-encoded calendar

**ETag support** with `If-None-Match` → `304 Not Modified`
**Query params:** `months_back` (1–12, default 3), `months_forward` (1–12, default 3)

**Service logic** (`services.py:375-455`):
1. Load all active entries within `[start, end]` range
2. Load up to 3 active predictions
3. Build `days: dict[date_str, code]`:
   - `"T"` — today
   - `"P"` — confirmed period day
   - `"p"` — predicted period day
   - `"f"` — future fertile window
   - `"F"` — past fertile window
4. Compute `next_period_in_days` from first prediction

**Response:** `200 OK` + `CalendarResponse`
```json
{
  "days": {
    "2026-06-25": "T",
    "2026-07-10": "p",
    "2026-07-11": "p",
    "2026-06-26": "f"
  },
  "predictions": { ...prediction_detail },
  "next_period_in_days": 15
}
```

### 2.4 ML Prediction Engine

#### Fallback prediction (`rule_based_v2`)

Used when user has < 10 logged cycles or no global model exists.

**Class:** `CyclePredictor` (`app/integrations/prediction_engine`)
**Input:** `start_dates[], cycle_lengths[], period_lengths[]`
**Output:** `PredictionResult`:
- `next_period_start`: median cycle after latest start date
- `next_period_end`: start + median period length
- `fertile_window_start`: start - 14 days
- `fertile_window_end`: fertile_start + 5 days
- `confidence`: 0.5 (static for rule-based)
- `model_used`: `"rule_based_v2"`

#### Global model prediction

Used when `User.total_cycles_logged >= 10` AND a global model file exists.

**Input features computed in service** (`services.py:159-245`):
- `user_avg_cycle`: from `User.avg_cycle_length` or median of entries
- `user_std_cycle`: from `User.cycle_length_std_dev`
- `user_trend_slope`: from `User.trend_slope`
- `user_avg_error`: from `User.avg_prediction_error_days`
- `user_age_bucket_ordinal`: 0 (<20) — 5 (≥40)
- `user_bmi_bucket_ordinal`: 0 (underweight) — 3 (obese)
- `user_stress_level`: from onboarding
- `user_avg_period_length`: median of entry period lengths

**Model loading:**
```python
async def _load_active_model() → dict | None:
  value = SELECT system_config WHERE key = "global_model_path"
  path = PROD_DIR / value
  return json.load(open(path)) if exists else None
```

**Prediction application:**
```python
predicted_length, confidence = apply_global_model(
    model, user_avg_cycle=…, user_std_cycle=…, …
)
next_start = latest_entry_start + timedelta(days=predicted_length)
```

**Model status endpoints:**

`GET /api/v1/cycle/models/status`
```json
{
  "current_version": 3,
  "download_url": "/api/v1/cycle/models/download/prod/cycle_model_v3.json"
}
```

`GET /api/v1/cycle/models/download/{filename}` — `FileResponse` from `/storage/models/prod/`

### 2.5 Cycle Module Internal Communication

#### Event: `onboarding_completed`

The cycle module subscribes to this event in its `init_module()`:

```python
# cycle/routes.py:313-329
event_bus.subscribe_sync("onboarding_completed", _on_onboarding_completed)

async def _on_onboarding_completed(user_id: str):
    svc = CycleService(AsyncSessionLocal())
    await svc.compute_initial_prediction(uuid.UUID(user_id))
```

#### Initial prediction fallback chain

`compute_initial_prediction` (`services.py:459-498`):
1. Try `compute_predictions()` (needs ≥ 1 entry)
2. On `InsufficientDataError`:
   - Load `UserOnboarding`
   - Use `current_cycle_start` + `current_cycle_length` from onboarding
   - Create a `fallback_median` prediction

#### Correction feedback loop

```
User corrects prediction → log_correction()
  → INSERT cycle_entries (is_correction=true)
  → UPDATE predicted_cycles (actual_cycle_entry_id, prediction_error_days)
  → _update_user_ml_metrics(user_id, error_days)
      → UPDATE users (avg_prediction_error_days, total_cycles_logged, is_dirty_for_retraining)
      → UPDATE users (avg_cycle_length, cycle_length_std_dev)
```

The `is_dirty_for_retraining` flag on the `User` model signals the retraining
pipeline that this user's data has been updated since the last global model build.

### 2.6 Frontend Screens

#### CycleDashboardScreen (`cycle/CycleDashboardScreen.tsx`)

- **Displays:** Next period countdown card, dictionary-encoded `Calendar`,
  prediction detail card
- **Data fetch:** Parallel `cycleService.getCalendar(3, 3)` + `globalModelClient.ensureLatest()`
- **Skeleton loading** while fetching
- **Navigation buttons:** Log Period, Predictions, History, Analytics

#### LogPeriodScreen (`cycle/LogPeriodScreen.tsx`)

- **Form fields:** Start date, end date (optional), flow intensity chips,
  symptom chips, mood chips, energy level slider (1–10)
- **Animation:** Reanimated `useSharedValue` press scale 0.94 on chips
- **Validation:** Zod schema `{ startDate: string, endDate?: string, notes?: string }`
- **Accessibility:** `accessibilityRole="button"`, `accessibilityState={selected}`
- **Note:** Currently logs locally; full API integration not yet wired in this screen

#### CyclePredictionsScreen, CycleHistoryScreen, CycleAnalyticsScreen

Referenced in navigation from dashboard. Analytics screen renders the
`AnalyticsResponse` (avg cycle length, shortest/longest, common symptoms, moods).

---

## 3. Wellness Module

### 3.1 Purpose

The wellness module provides journaling (with end-to-end encryption), mood
tracking, guided breathing exercises, and wellness insights. It includes an
on-device sentiment analysis workflow (client ONNX model) synced back to the
backend, plus server-side Celery tasks for periodic weekly insights.

### 3.2 Database Models

**File:** `backend/app/modules/wellness/models.py`

#### `journal_entries`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID (FK `users.id`) | CASCADE |
| `content` | String | **Encrypted at rest** |
| `sentiment_score` | Float \| null | Set by analysis |
| `sentiment_label` | String(20) \| null | `positive` \| `negative` \| `neutral` |
| `analyzed_at` | DateTime (TZ) \| null | |
| `entry_date` | Date | Indexed |
| `is_active` | Boolean | Soft delete |

#### `mood_logs`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID (FK) | CASCADE |
| `mood` | String(50) | e.g. "Happy", "Anxious" |
| `intensity` | Integer | Default 3, range 1–10 |
| `logged_at` | DateTime (TZ) | Indexed |
| `is_active` | Boolean | Soft delete |

#### `breathing_exercises`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK (seeded data) |
| `name` | String(100) | e.g. "Box Breathing" |
| `duration_seconds` | Integer | Default 120 |
| `instructions` | JSONB | e.g. `{"steps": […], "totalDuration": 120}` |
| `audio_url` | String(500) \| null | Optional guided audio |
| `is_active` | Boolean | Seed control |

#### `user_exercise_sessions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `user_id` | UUID (FK) | CASCADE |
| `exercise_id` | UUID (FK → `breathing_exercises.id`) | CASCADE |
| `completed_at` | DateTime (TZ) | |

#### `journal_analyses`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `journal_id` | UUID (FK → `journal_entries.id`) | Unique, CASCADE |
| `user_id` | UUID (FK) | Indexed |
| `mood_score` | Float | 1–10 from on-device model |
| `sentiment` | String(20) | `positive` \| `negative` \| `neutral` |
| `symptom_mentions` | JSONB | `list[str]` |
| `crisis_flags` | JSONB | `dict[str, bool]` |
| `model_version` | String(20) | e.g. `"wellness-v1.onnx"` |
| `inference_time_ms` | Float | Performance metric |
| `created_at` | DateTime (TZ) | |

### 3.3 Encryption Boundary

Journal content is encrypted **in the service layer** before persisting:

```python
# wellness/services.py:39
encrypted_content = self.encryption.encrypt_for_user(data.content, user_salt or "")
```

- `EncryptionService.encrypt_for_user()` uses per-user encryption key
- Backend cannot read journal plaintext
- Mobile decrypts in-app when displaying
- `notes` in cycle module follows the same pattern (encrypted)

### 3.4 Backend API

**Base path:** `/api/v1/wellness`

#### `POST /api/v1/wellness/journal` — Create journal entry

**Request:** `JournalEntryCreate`
- `content`: str, min 1 char
- `entry_date`: date (defaults to today)
- `mood`: str (optional, for reflection)

**Response:** `201` + `JournalEntryResponse`
- Note: `content` in response is **decrypted** for the requesting user's session only

**Side effect (optional):** Triggers `analyze_journal_sentiment` Celery task

#### `GET /api/v1/wellness/journal` — List entries (metadata only)

**Response:** `200` + `list[JournalEntryMetadata]`
- Returns `id`, `entry_date`, `sentiment_label`, `created_at` — no content
- Paginated with cursor

#### `GET /api/v1/wellness/journal/{entry_id}` — Single entry

**Response:** `200` + `JournalEntryResponse` (decrypted content)

#### `DELETE /api/v1/wellness/journal/{entry_id}` — Soft delete

Sets `is_active = False`. Returns `204`.

#### `POST /api/v1/wellness/mood` — Log mood

**Request:** `MoodLogCreate`
- `mood`: string ≤ 50 chars
- `intensity`: int, 1–10 (default 3)
- `logged_at`: datetime (optional, defaults to now)

**Response:** `201` + `MoodLogResponse`

#### `GET /api/v1/wellness/mood/history` — Mood history

**Query param:** `days_back`: 1–365 (default 30)
**Response:** `200` + `list[MoodLogResponse]`

#### `GET /api/v1/wellness/breathing-exercises` — List exercises

**Response:** `200` + `list[BreathingExerciseResponse]`
- Returns seeded exercise catalog (no user data)

#### `POST /api/v1/wellness/breathing-sessions/{exercise_id}/complete` — Log session

**Response:** `201` + `ExerciseSessionResponse`
- Creates `UserExerciseSession` record

#### `GET /api/v1/wellness/insights` — Weekly insights

**Response:** `200` + `InsightResponse`
```json
{
  "total_journal_entries": 12,
  "total_mood_logs": 45,
  "average_mood_intensity": 5.8,
  "most_common_mood": "Calm",
  "recommendation": "Great consistency! Consider reviewing your mood patterns weekly."
}
```

#### `POST /api/v1/wellness/journal/analysis` — Sync on-device analysis

Used by mobile after running local ONNX inference.

**Request:** `JournalAnalysisCreate`
- `journal_id`: UUID
- `mood_score`: float, 1–10
- `sentiment`: `positive` | `negative` | `neutral`
- `symptom_mentions`: list[str]
- `crisis_flags`: dict[str, bool]
- `model_version`: string
- `inference_time_ms`: float

**Response:** `201` + `JournalAnalysisResponse`

#### `GET /api/v1/wellness/journal/{entry_id}/analysis`

**Response:** `200` + `JournalAnalysisResponse | null`

### 3.5 Model Endpoints (ONNX Classifier)

**Base path:** `/api/v1/models`

#### `GET /api/v1/models/wellness-classifier/version`

Returns current ONNX model metadata from settings:
```json
{
  "version": "wellness-v1",
  "size_mb": 0,
  "checksum_sha256": "abc123..."
}
```

#### `GET /api/v1/models/wellness-classifier/{version}.onnx`

Supports `Range` header for resumable download.
- Validates version matches settings
- Returns `206 Partial Content` if `Range` header present
- Returns full file otherwise

### 3.6 Celery Tasks

**File:** `backend/app/modules/wellness/tasks.py`

#### `analyze_journal_sentiment(entry_id, user_id)`

- **Soft limit:** 30s | **Hard limit:** 60s
- **Retries:** Up to 3, with exponential backoff (max 300s)
- **Triggered:** After journal entry creation (optional)
- **Flow:**
  1. Load `JournalEntry` by ID
  2. Call `HuggingFaceClient.analyze_sentiment(content)`
  3. Set `entry.sentiment_label`, `sentiment_score`, `analyzed_at`
  4. `COMMIT`

**Note:** Currently uses a placeholder content string for analysis.
The actual journal content would be decrypted before sending to HuggingFace.

#### `generate_weekly_insights()`

- **Soft limit:** 120s | **Hard limit:** 300s
- **Schedule:** Sundays (configured in Celery Beat)
- **Flow:**
  1. `SELECT` all active users
  2. For each user: call `WellnessService.get_insights(user_id)`
  3. Log insights for each user

### 3.7 Frontend Screens

#### WellnessHomeScreen (`wellness/WellnessHomeScreen.tsx`)

- Placeholder screen (plan 08)
- Navigation hub to Journal, Mood, Breathing, Insights
- Skeleton placeholders for async content

#### MoodLogScreen (`wellness/MoodLogScreen.tsx`)

- **Mood grid:** 8 emoji-labeled moods (Happy, Neutral, Sad, Angry, Anxious,
  Tired, Loved, Motivated)
- **Animation:** Reanimated press scale 0.92 on each mood button
- **Intensity slider:** 1–10 dots selector
- **Accessibility:** `accessibilityRole="button"`, `accessibilityState={selected}`
- **Validation:** At least one mood must be selected to save
- **Persistence:** Logs locally first; full API integration pending

#### JournalEntryScreen (`wellness/JournalEntryScreen.tsx`)

- **Auto-save draft:** Every 30s to `EncryptedStorage` with key
  `shecare.journal.draft.{entry_id}`
- **Draft recovery:** Loaded on mount; shows "Draft saved X ago" toast
- **Fields:** Title (FormField), Content (multiline TextInput)
- **Validation:** Zod `{ title: min 1, max 100 }, { content: min 1 }`
- **Encryption:** Drafts are stored in encrypted storage
- **Analysis:** Mobile can run ONNX classifier locally; results synced via
  `POST /api/v1/wellness/journal/analysis`

#### JournalListScreen, MoodHistoryScreen, BreathingListScreen, InsightsScreen

List views that call their respective list/insights endpoints.

---

## 4. Cross-Module Event Flow

### 4.1 Onboarding Completion Cascade

```
User completes onboarding (CompleteScreen)
  └─► PUT /api/v1/onboarding
       └─► OnboardingService.create_or_update()
            ├─► INSERT/UPDATE user_onboarding
            ├─► _backfill_cycles() → INSERT cycle_entries
            ├─► event_bus.emit("onboarding_completed", user_id)
            │    ├─► cycle._on_onboarding_completed()
            │    │    └─► CycleService.compute_initial_prediction()
            │    │         ├─► Try global model
            │    │         └─► Fallback: onboarding.current_cycle_start + length
            │    │              └─► INSERT predicted_cycles
            │    └─► Other subscribers (e.g., welcome notification)
            └─► Response to mobile
```

### 4.2 Correction Feedback Loop

```
User: "My period started 2 days earlier than predicted"
  └─► POST /api/v1/cycle/corrections
       └─► CycleService.log_correction()
            ├─► INSERT cycle_entries (is_correction=true)
            ├─► UPDATE predicted_cycles
            │    (actual_cycle_entry_id, prediction_error_days)
            └─► _update_user_ml_metrics()
                 ├─► UPDATE users (avg_prediction_error_days↑)
                 ├─► UPDATE users (total_cycles_logged↑)
                 ├─► UPDATE users (is_dirty_for_retraining=true)
                 ├─► UPDATE users (avg_cycle_length, cycle_length_std_dev)
                 └─► COMMIT

When enough corrections accumulate:
  └─► Retraining pipeline picks up users with is_dirty_for_retraining=true
       └─► Retrains global model
            └─► Updates system_config (global_model_version, global_model_path)
```

### 4.3 Wellness ↔ External ML

```
Mobile: JournalEntryScreen
  ├─► Auto-saves draft to EncryptedStorage (every 30s)
  └─► On submit:
       ├─► POST /api/v1/wellness/journal
       │    └─► WellnessService.create_journal_entry()
       │         └─► INSERT journal_entries (encrypted content)
       ├─► Mobile runs ONNX classifier locally
       │    └─► Sentiment + mood_score + symptom_mentions
       └─► POST /api/v1/wellness/journal/analysis
            └─► JournalAnalysisService.create_analysis()
                 └─► INSERT journal_analyses
```

### 4.4 Scheduled Wellness Tasks

```
Celery Beat (Sundays)
  └─► generate_weekly_insights
       └─► For each active user:
            └─► WellnessService.get_insights(user_id)
                 └─► COUNT journal_entries (all time)
                 └─► COUNT mood_logs (last 30 days)
                 └─► AVG mood intensity (last 30 days)
                 └─► MODE mood label (last 30 days)
                 └─► Generate recommendation string
                 └─► Log insights
```

---

## 5. State Management Summary

| Data | Backend Store | Mobile Store | Sync |
|------|--------------|--------------|------|
| Onboarding form | Zustand (temp) | Zustand | PUT on Complete |
| Journal drafts | EncryptedStorage | — | Every 30s local |
| Cycle predictions | DB (`predicted_cycles`) | React Query cache | GET /predictions |
| Mood entries | DB (`mood_logs`) | React Query | POST /mood |
| Auth tokens | DB (hashed refresh) | EncryptedStorage | Login flow |
| Feature flags | Redis / JSON file | React Query | GET /features |
| Global model | `/storage/models/prod/` | Filesystem cache | GET /models/… |

---

## 6. Key Invariants Checked

| Rule | Onboarding | Cycle | Wellness |
|------|-----------|-------|----------|
| Routes thin, services HTTP-free | ✓ | ✓ | ✓ |
| Module owns its tables | ✓ (`user_onboarding`) | ✓ (`cycle_entries`, `predicted_cycles`) | ✓ |
| Schemas split Create/Update/Response | ✓ | ✓ | ✓ |
| UUID primary keys | — (FK only) | ✓ | ✓ |
| Encryption in service layer | — | ✓ (`notes`) | ✓ (`content`) |
| Event bus for cross-module | ✓ emits | ✓ subscribes | — |
| Celery tasks idempotent + time limits | — | — | ✓ |
| Row-level permission via `current_user.id` | ✓ | ✓ | ✓ |
| ETag support | — | ✓ (`/calendar`) | ✓ (journal) |
| Soft delete (`is_active`) | — | ✓ | ✓ |
