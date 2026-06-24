# Phase 1: User Onboarding & Health Profile

## Objective

Capture the user's baseline health data via a 6-step mobile flow, **backfill** past cycle data into the primary `cycle_entries` table to seed the ML engine immediately, and implement the **Correction Feedback Loop** that logs user corrections to feed into the monthly Big Global Model retraining.

---

## 1. Architectural Context (The Big Global Model)

This phase integrates directly with the "Big Global Model" architecture:

- **Server**: Trains a single XGBoost model on anonymized population data once per month.
- **Mobile**: Downloads a lightweight JSON file (global coefficients) and runs pure arithmetic locally.
- **Correction Handling**: User corrections are stored locally as a "Local Delta" (instant fix) and synced to the server to flag their data as "dirty" for the next monthly global export.
- **No per-user retraining**: The `is_dirty_for_retraining` flag simply indicates that this user's data should be included in the next month's global training dataset.

---

## 2. Database Schema Changes

### 2.1 New Table: `user_onboarding`

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `user_id` | UUID | PK, FK → `users.id`, ON DELETE CASCADE | Links to auth user |
| `age` | SMALLINT | nullable=True | 13–120 |
| `height_cm` | FLOAT | nullable=True | 50–250 cm |
| `weight_kg` | FLOAT | nullable=True | 20–300 kg |
| `stress_level` | VARCHAR(10) | nullable=True | low / moderate / high |
| `exercise_frequency` | VARCHAR(10) | nullable=True | low / moderate / high |
| `sleep_hours` | FLOAT | nullable=True | 0–24 |
| `diet` | VARCHAR(10) | nullable=True | balanced / normal / junk |
| `current_cycle_start` | DATE | nullable=True | Start date of last period |
| `current_cycle_length` | SMALLINT | nullable=True | 20–45 days |
| `current_period_length` | SMALLINT | nullable=True | 2–10 days |
| `current_symptoms` | JSONB | default=[] | Array of symptom strings |
| `past_cycles` | JSONB | default=[] | Array of `{cycle_start, cycle_length, period_length, symptoms}` |
| `onboarding_completed` | BOOLEAN | default=False | Completion flag |
| `completed_at` | TIMESTAMP WITH TZ | nullable=True | Timestamp of completion |
| `created_at` | TIMESTAMP WITH TZ | server_default=now() | Audit timestamp |
| `updated_at` | TIMESTAMP WITH TZ | onupdate=now() | Audit timestamp |

**`past_cycles` JSONB structure:**

```json
[
  {
    "cycle_start": "2025-11-01",
    "cycle_length": 28,
    "period_length": 5,
    "symptoms": ["cramps", "headache"]
  }
]
```

### 2.2 Additions to `users` Table (Global Model Metrics)

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `avg_cycle_length` | FLOAT | NULL | Running average of user's cycle lengths (feature for global model) |
| `cycle_length_std_dev` | FLOAT | NULL | Standard deviation (measures irregularity; used for confidence windows) |
| `avg_prediction_error_days` | FLOAT | 0.0 | Running average of user's correction errors (feature for global model) |
| `total_cycles_logged` | INTEGER | 0 | Count of cycles; used for sample weighting in global training |
| `is_dirty_for_retraining` | BOOLEAN | False | True = user has new data since last global export; must be included in next month's training set |

### 2.3 Additions to `cycle_entries` Table (Correction Linking)

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `corrected_prediction_id` | UUID | FK → `predicted_cycles.id`, nullable=True | Links this entry to the prediction it corrected |
| `is_correction` | BOOLEAN | default=False | Whether this entry was a manual correction of a prediction |

### 2.4 Additions to `predicted_cycles` Table (Error Tracking)

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `actual_cycle_entry_id` | UUID | FK → `cycle_entries.id`, nullable=True | Links prediction to ground truth (when corrected) |
| `prediction_error_days` | SMALLINT | nullable=True | Deviation: `actual_start_date - predicted_start_date` (e.g., +4 means 4 days late) |

### 2.5 New Table: `snooze_events` (Optional but Recommended)

| Column | Type | Constraints | Purpose |
|--------|------|-------------|---------|
| `id` | UUID | PK | Primary key |
| `user_id` | UUID | FK → `users.id`, ON DELETE CASCADE | User reference |
| `predicted_cycle_id` | UUID | FK → `predicted_cycles.id` | Which prediction was snoozed |
| `snoozed_at` | TIMESTAMP WITH TZ | default=now() | When user tapped "Not yet" |
| `day_offset` | SMALLINT | NOT NULL | 0 = on predicted day, 1 = 1 day late, etc. |

**Purpose:** Tracks the progression of lateness. When the user eventually logs her actual period, the system knows she snoozed for X days. This becomes a powerful feature for the global model.

---

## 3. Business Logic Deep Dive

### 3.1 The Backfill Process (Crucial)

**Problem:** The ML engine (cycle predictions, calendar view) needs data immediately. If we only store onboarding data in `user_onboarding.past_cycles` JSONB, the `cycle_entries` table remains empty.

**Solution:** During onboarding submission, insert or upsert the current cycle and all past cycles into `cycle_entries`.

**Rules for Backfill:**

1. For each cycle (current + 3 past), check if a `cycle_entry` already exists for that `(user_id, period_start_date)`.
2. If it exists, skip (idempotency — prevents duplicates on re-onboarding).
3. If it doesn't exist, insert it.
4. `period_end_date = period_start_date + period_length`.
5. `cycle_length` is the interval to the next period (for the current cycle, use the provided value; for past cycles, infer from the next cycle's start date if possible).

**Why this matters:** Without backfill, the user opens her calendar and sees zero data. With backfill, she sees a 3-month history immediately.

### 3.2 The Correction Feedback Loop (Feeding the Global Model)

When a user corrects a prediction (e.g., model predicted March 16th, she logs March 20th):

#### Mobile Side (Instant — Offline)

- App updates the `local_correction_delta` stored in AsyncStorage. For example: +4 days.
- The dashboard calendar immediately updates to show the 20th.
- The next prediction uses: `global_model_prediction + local_correction_delta`.

#### Mobile → Server (On Sync)

- The app pushes the actual `cycle_entry` (`period_start_date = March 20th`) to the server.
- The app also sends the `predicted_cycle_id` of the original prediction (if available).
- The app sends the `prediction_error_days` (+4).

#### Server Side (When Sync is Received)

1. Link the prediction to the actual entry: Set `predicted_cycles.actual_cycle_entry_id = new_entry.id`.
2. Store the error: Set `predicted_cycles.prediction_error_days = +4`.
3. Update user metrics:
   - Recalculate `avg_prediction_error_days` (running average of all errors).
   - Recalculate `cycle_length_std_dev` (standard deviation of all logged cycle lengths).
   - Recalculate `avg_cycle_length`.
   - Increment `total_cycles_logged`.
4. Set `is_dirty_for_retraining = True` — this flags the user's new data to be included in the next monthly global model export.

**Crucial Detail:** `is_dirty_for_retraining` does NOT trigger immediate retraining. It simply tells the monthly script: "Include this user's updated aggregates in the next global dataset."

### 3.3 Monthly Global Model Export (The Consolidation)

1. The monthly script queries all users with `total_cycles_logged >= 3` (or all dirty users).
2. It extracts their statistical aggregates (`avg_cycle_length`, `std_dev`, `avg_error`, age, BMI, stress_level, etc.).
3. It trains one XGBoost model on this anonymized population dataset.
4. It exports `global_model_v{N}.json`.
5. After successful export, it resets `is_dirty_for_retraining = False` for all users.

### 3.4 The "Local Delta" Bridge (How Mobile Survives the Monthly Gap)

| Day | Event |
|-----|-------|
| 1 | User corrects 16th → 20th. App stores `local_delta = +4`. Dashboard updates instantly. |
| 5 | User opens app (offline). App uses `global_model_v5.json` + `local_delta` (+4) to predict next period. |
| 30 | Monthly sync: App downloads `global_model_v6.json`. The new model has been retrained with her correction data (plus everyone else's). It now predicts closer to 20th. |
| 31 | App resets `local_delta = 0` because the global model now intrinsically accounts for her pattern. |

---

## 4. API Contracts

### 4.1 Onboarding Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `PUT` | `/api/v1/onboarding` | Yes (JWT) | Create or update onboarding data (idempotent upsert). On completion, triggers backfill and emits `onboarding_completed` event. |
| `GET` | `/api/v1/onboarding` | Yes | Fetch current onboarding data (returns 404 if not set up). |
| `GET` | `/api/v1/onboarding/status` | Yes | Returns `{"completed": bool}`. Used by RootNavigator to redirect to onboarding stack. |

### 4.2 Onboarding Request Schema (`OnboardingCreate`)

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| `age` | Integer | 13–120 | Yes |
| `height_cm` | Float | 50–250 | Yes |
| `weight_kg` | Float | 20–300 | Yes |
| `stress_level` | Enum | low, moderate, high | Yes |
| `exercise_frequency` | Enum | low, moderate, high | Yes |
| `sleep_hours` | Float | 0–24 | Yes |
| `diet` | Enum | balanced, normal, junk | Yes |
| `current_cycle_start` | Date (ISO) | Must be ≤ today | Yes |
| `current_cycle_length` | Integer | 20–45 | Yes |
| `current_period_length` | Integer | 2–10 | Yes |
| `current_symptoms` | Array of strings | Valid symptom list | Yes (can be empty) |
| `past_cycles` | Array of `PastCycleSchema` | Max 3 entries | Yes (can be empty) |

**`PastCycleSchema`:**

| Field | Type | Validation |
|-------|------|------------|
| `cycle_start` | Date (ISO) | Must be < `current_cycle_start` |
| `cycle_length` | Integer | 20–45 |
| `period_length` | Integer | 2–10 |
| `symptoms` | Array of strings | Valid symptom list |

### 4.3 Onboarding Response Schema (`OnboardingResponse`)

Returns all fields from the `user_onboarding` table + `id`, `user_id`, `onboarding_completed`, `completed_at`, `created_at`, `updated_at`.

### 4.4 Cycle Correction Endpoints (for Mobile Sync)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/v1/cycle/entries` | Yes | Log a new period start date. If a prediction exists for this date range, links correction and updates metrics. |
| `POST` | `/api/v1/cycle/snooze` | Yes | Log a "Not yet" event for a prediction. Stores the snooze. |

---

## 5. Mobile Implementation

### 5.1 Navigation Changes

`RootNavigator` updated to check onboarding status:

```typescript
if (!user) return <AuthStack />;
if (!user.onboarding_completed) return <OnboardingStack />;
return <MainTabs />;
```

### 5.2 Onboarding Stack (`OnboardingStack.tsx`)

```
OnboardingWelcomeScreen
        ↓ (tap "Get Started")
PersonalInfoScreen
        ↓ (tap "Continue")
LifestyleScreen
        ↓ (tap "Continue")
CurrentCycleScreen
        ↓ (tap "Continue")
PastCycleScreen (Cycle 1 of 3)  ← Reused component for all 3 past cycles
        ↓ (tap "Continue")
PastCycleScreen (Cycle 2 of 3)
        ↓ (tap "Continue")
PastCycleScreen (Cycle 3 of 3)
        ↓ (tap "Complete")
OnboardingCompleteScreen
        ↓ (tap "Go to Dashboard")
→ navigates to MainTabs
```

### 5.3 Screen Details

| Screen | Components | Validation |
|--------|------------|------------|
| `OnboardingWelcome` | Gradient header, flower icon, privacy-first promise, "Get started" button | None |
| `PersonalInfoScreen` | Numeric input (age 13–120), Picker (height cm/ft), Picker (weight kg/lbs) | `z.number().min(13).max(120)` |
| `LifestyleScreen` | 3 toggle buttons (stress), 3 toggle buttons (exercise), Slider (sleep 4–12), 3 toggle buttons (diet) | `z.enum([...])` |
| `CurrentCycleScreen` | Date picker (cycle start), Picker (cycle length 20–45), Picker (period length 2–10), Multi-select grid (symptoms) | `z.object({...})` |
| `PastCycleScreen` | Same as CurrentCycle, progress indicator "Cycle 2 of 3", "Back" and "Continue" buttons | Same as CurrentCycle |
| `OnboardingComplete` | Lottie animation (celebration), "Your dashboard is ready!", "Go to Dashboard" button | None |

### 5.4 State Management (`onboardingStore.ts`)

```typescript
interface OnboardingState {
  // Personal
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  // Lifestyle
  stressLevel: 'low' | 'moderate' | 'high' | null;
  exerciseFrequency: 'low' | 'moderate' | 'high' | null;
  sleepHours: number | null;
  diet: 'balanced' | 'normal' | 'junk' | null;
  // Current cycle
  currentCycleStart: string | null;
  currentCycleLength: number | null;
  currentPeriodLength: number | null;
  currentSymptoms: string[];
  // Past cycles
  pastCycles: PastCycle[];
  // Submission state
  isSubmitting: boolean;
  // Actions
  setPersonalInfo: (data) => void;
  setLifestyle: (data) => void;
  setCurrentCycle: (data) => void;
  addPastCycle: (data) => void;
  submitOnboarding: () => Promise<void>;
}
```

**Key Implementation Detail:**

- Data is saved to Zustand on every screen transition.
- Single API call (`PUT /api/v1/onboarding`) is made only when the user reaches the final screen and taps "Go to Dashboard".
- This prevents partial submissions and keeps the backend state clean.

### 5.5 Validation Schemas (`validation/onboarding.ts`)

| Schema | Fields | Rules |
|--------|--------|-------|
| `personalInfoSchema` | `age`, `heightCm`, `weightKg` | `min(13).max(120)`, `min(50).max(250)`, `min(20).max(300)` |
| `lifestyleSchema` | `stressLevel`, `exerciseFrequency`, `sleepHours`, `diet` | Enums, `min(0).max(24)` |
| `currentCycleSchema` | `cycleStartDate`, `cycleLength`, `periodLength`, `symptoms` | `min(20).max(45)`, `min(2).max(10)` |
| `pastCycleSchema` | Same as `currentCycleSchema` | Same as current |

---

## 6. Integration with the Global Model Pipeline

### 6.1 How Onboarding Data Feeds the Monthly Global Model

The monthly retraining script (`scripts/retrain_global_model.py`) runs the following query on the 1st of every month:

```sql
SELECT
    -- From users table (aggregated metrics)
    u.age,
    u.bmi,
    u.stress_level,
    u.avg_cycle_length,
    u.cycle_length_std_dev,
    u.avg_prediction_error_days,
    u.total_cycles_logged,

    -- From onboarding (lifestyle features)
    o.exercise_frequency,
    o.sleep_hours,
    o.diet,

    -- Target variable (computed from cycle_entries)
    c.next_cycle_interval  -- Actual days until the next period

FROM users u
LEFT JOIN user_onboarding o ON u.id = o.user_id
JOIN cycle_entries c ON u.id = c.user_id
WHERE u.total_cycles_logged >= 3
  AND u.is_dirty_for_retraining = True  -- Only include users with new data
ORDER BY u.total_cycles_logged DESC;
```

**Key Insight:** The `is_dirty_for_retraining` flag ensures that the monthly script only processes users who have changed since the last export. This keeps the dataset fresh while reducing compute time.

### 6.2 How Corrections Influence the Global Model

| User Action | Effect on Global Model |
|-------------|------------------------|
| Corrects a period (16th → 20th) | `prediction_error_days = +4` stored. `avg_prediction_error_days` recalculated. `is_dirty_for_retraining = True`. |
| Monthly Script Runs | The script pulls this user's updated `avg_prediction_error_days` as a feature. The model learns: "Users with high average error tend to be late." |
| New Global JSON Exported | The coefficient for `avg_prediction_error_days` adjusts globally. All users benefit. |
| User Downloads New JSON | Her `local_delta` resets to 0 because the global model now accounts for the pattern. |

---

## 7. Event Bus Integration

### 7.1 Event Emitted

| Event | Payload | Emitter |
|-------|---------|---------|
| `onboarding_completed` | `{ user_id: str }` | `OnboardingService.create_or_update()` when `onboarding_completed` transitions from False to True |

### 7.2 Event Subscribers

**Cycle Module Subscriber:**

```python
@event_bus.subscribe("onboarding_completed")
async def on_onboarding_completed(user_id: str):
    # Compute first prediction using the current global model
    # The global model is already served by the API
    # This just triggers the initial prediction to be cached/displayed
    await cycle_service.compute_initial_prediction(uuid.UUID(user_id))
```

**Note:** Since there is no per-user model, the "prediction" is simply the arithmetic result of applying the current `global_model.json` to the user's statistical aggregates. This is trivial and runs instantly on the server.

---

## 8. Migrations Summary

| Migration | Changes |
|-----------|---------|
| `0005_onboarding_table` | Create `user_onboarding` table. |
| `0005b_user_ml_metrics` | Add `avg_cycle_length`, `cycle_length_std_dev`, `avg_prediction_error_days`, `total_cycles_logged`, `is_dirty_for_retraining` to `users` table. |
| `0005c_correction_columns` | Add `corrected_prediction_id`, `is_correction` to `cycle_entries`. Add `actual_cycle_entry_id`, `prediction_error_days` to `predicted_cycles`. |
| `0005d_snooze_events` | Create `snooze_events` table (optional but recommended). |

All migrations are reversible (downgrade defined).

---

## 9. Validation Criteria

### Backend

- [ ] Onboarding `PUT` creates/updates `user_onboarding` record.
- [ ] Onboarding `GET` returns record (404 if not set up).
- [ ] Onboarding status `GET` returns `{"completed": true}` after submission.
- [ ] **Backfill**: After submission, `cycle_entries` contains 4 rows (1 current + 3 past).
- [ ] **Backfill Idempotency**: Running onboarding twice does NOT create duplicate `cycle_entries`.
- [ ] `onboarding_completed` event is emitted exactly once.
- [ ] **Correction**: Logging a period that matches a prediction links the records (`predicted_cycles.actual_cycle_entry_id`).
- [ ] **Correction**: `prediction_error_days` is calculated correctly.
- [ ] **Correction**: `is_dirty_for_retraining` is set to True.
- [ ] **Correction**: `avg_prediction_error_days` and `cycle_length_std_dev` are updated.
- [ ] **Correction**: `total_cycles_logged` is incremented.
- [ ] **Snooze**: Tapping "Not yet" creates a `snooze_events` record.
- [ ] **Monthly Script**: Pulls dirty users, trains ONE XGBoost model, exports JSON, resets `is_dirty_for_retraining = False`.
- [ ] **Atomic Swap**: After script runs, `/prod/global_model.json` is replaced with new version.
- [ ] **System Config**: `global_model_version` is incremented.

### Mobile

- [ ] 6-step onboarding flow completes end-to-end.
- [ ] Progress dots update correctly (1/6–6/6).
- [ ] Back navigation preserves entered data.
- [ ] Single API call at the end (not on every screen).
- [ ] After submission, navigates to MainTabs (not OnboardingStack).
- [ ] RootNavigator redirects to OnboardingStack if `onboarding_completed = False`.
- [ ] All Zod validations trigger correct error messages.
- [ ] TypeScript: `npx tsc --noEmit` passes with 0 errors.

### Integration

- [ ] After onboarding, Calendar shows immediate history (4 cycles displayed).
- [ ] User can correct a prediction; dashboard updates instantly via `local_delta`.
- [ ] Monthly sync downloads new `global_model.json` and resets `local_delta`.
- [ ] Offline: App predicts using `global_model.json` + `local_delta` without internet.

---

## 10. Data Flow Summary

```
User completes onboarding (6 steps)
    ↓
Mobile submits single PUT /onboarding
    ↓
Server backfills current + 3 past cycles into cycle_entries
    ↓
Server emits "onboarding_completed" event
    ↓
Cycle module computes first prediction using current global_model.json
    ↓
User sees Calendar with 4 cycles and a prediction

Later: User corrects prediction (16th → 20th)
    ↓
Mobile updates local_delta (+4) → UI updates instantly
    ↓
On next sync, POST /cycle/entries sends actual date
    ↓
Server links correction, updates user metrics, sets is_dirty_for_retraining = True
    ↓
Monthly script includes this user in next global XGBoost training
    ↓
New global_model.json exported
    ↓
User downloads new JSON on sync → local_delta resets to 0 → accuracy improves
```

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| User re-installs app and re-onboards | Duplicate cycle entries | Backfill logic checks `(user_id, period_start_date)` before inserting. Skips duplicates. |
| User logs a period that doesn't match any prediction | `predicted_cycles.actual_cycle_entry_id` remains NULL | Acceptable. The cycle is still logged; the global model uses it as ground truth even without a prediction link. |
| Snooze events grow infinitely | Table bloat | Add a retention policy: keep snooze events for 90 days, then archive/delete. |
| User has highly irregular cycles (>10 days SD) | Global model struggles | The global model uses `cycle_length_std_dev` as a feature. Users with high SD have lower influence (weighted less) in training. On the mobile side, high SD triggers a prediction window (e.g., ±5 days) instead of a single date. |

---

## 12. Conclusion

This phase delivers the data foundation for the entire platform:

- **Immediate usability**: Backfill ensures the calendar is populated from Day 1.
- **Continuous learning**: The correction feedback loop feeds high-quality labeled data into the monthly global model retraining pipeline.
- **Offline resilience**: The `local_delta` mechanism gives users instant corrections without waiting for the monthly global model update.
- **Scalability**: One global model serves all users; onboarding data enriches the population dataset.
