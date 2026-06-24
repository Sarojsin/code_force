# Phase 1: User Onboarding & Health Profile — Implementation Report

## Summary
Phase 1 delivers the data foundation for SheCare: user health profile collection, past-cycle backfill into `cycle_entries`, the correction feedback loop, and the mobile onboarding flow (6-step wizard). All critical gaps identified during review have been closed.

## Backend Changes

### New Module: `app/modules/onboarding/`
- **`models.py`** — `UserOnboarding` table (age, height, weight, lifestyle, cycle baseline, symptoms, past_cycles JSONB, onboarding_completed flag)
- **`schemas.py`** — `OnboardingCreate` (validated: age 13–120, height 50–250, weight 20–300, stress/exercise enum, sleep 0–24, diet enum, cycle length 20–45, period length 2–10), `OnboardingResponse`, `OnboardingStatusResponse`, `PastCycleSchema`
- **`services.py`** — `create_or_update()` (idempotent upsert), `_backfill_cycles()` (inserts current + up to 3 past cycles into `cycle_entries`, skips existing with logging), `get_onboarding()`, `get_status()`
- **`routes.py`** — `PUT /api/v1/onboarding`, `GET /api/v1/onboarding`, `GET /api/v1/onboarding/status`
- **`dependencies.py`** — `OnboardingServiceDep`
- **`exceptions.py`** — `OnboardingError`, `OnboardingNotFoundError`, `OnboardingAlreadyCompletedError`

### Modified: `app/modules/auth/models.py`
- Added `avg_cycle_length`, `cycle_length_std_dev`, `avg_prediction_error_days`, `total_cycles_logged`, `is_dirty_for_retraining` to `User` model

### Modified: `app/modules/cycle/models.py`
- Added `corrected_prediction_id`, `is_correction` to `CycleEntry`
- Added `actual_cycle_entry_id`, `prediction_error_days` to `PredictedCycle`
- Added `SnoozeEvent` model (user_id, predicted_cycle_id, snoozed_at, day_offset)
- Added `UniqueConstraint("user_id", "period_start_date", name="unique_user_period_start")` on `CycleEntry`

### Modified: `app/modules/cycle/services.py`
- `create_entry()`: catches `IntegrityError` on unique constraint → updates existing row instead of failing
- Added `compute_initial_prediction()` — called by event bus on onboarding_completed; gracefully falls back to median (28 days) when `global_model.json` is missing, sets `model_version="fallback_median"`
- Added `log_correction()` — links correction to prediction, computes `prediction_error_days`, updates user ML metrics via `_update_user_ml_metrics()`
- Added `log_snooze()` — records "Not yet" tap
- Added `get_prediction_by_id()` — helper

### Modified: `app/modules/cycle/schemas.py`
- Added `CorrectionCreate`, `CorrectionResponse`, `SnoozeCreate`, `SnoozeResponse`

### Modified: `app/modules/cycle/routes.py`
- Added `POST /api/v1/cycle/corrections` endpoint
- Added `POST /api/v1/cycle/snooze` endpoint
- Wired `onboarding_completed` event subscriber → calls `compute_initial_prediction()`

### Modified: `app/main.py`
- Registered `"app.modules.onboarding.routes:init_module"` in `MODULE_INITS`

### Modified: `backend/alembic/env.py`
- Added `import app.modules.onboarding.models`

### Modified: `app/tasks/global_cleanup.py`
- Added `prune_snooze_events()` Celery task (deletes snoozes older than 90 days)

### New Alembic Migrations
| Migration | Changes | Reversible |
|-----------|---------|------------|
| `0006_onboarding_table.py` | Create `user_onboarding` table | Yes |
| `0007_user_ml_metrics.py` | Add ML metrics columns to `users` | Yes |
| `0008_correction_columns.py` | Add correction columns to `cycle_entries` / `predicted_cycles` | Yes |
| `0009_snooze_events.py` | Create `snooze_events` table | Yes |
| `0010_unique_cycle_entry_constraint.py` | Add `UNIQUE(user_id, period_start_date)` on `cycle_entries` | Yes |

## Mobile Changes

### New: `src/services/api/onboarding.ts`
- `onboardingService.upsert()`, `onboardingService.get()`, `onboardingService.getStatus()`

### New: `src/stores/onboardingStore.ts`
- Zustand store: tracks all onboarding fields per-screen, `submitOnboarding()` sends single `PUT /onboarding` at flow completion

### New: `src/stores/cycleStore.ts`
- Added `localCorrectionDelta` field + actions (prepared for Phase 2 local_delta sync)

### New: `src/validation/onboarding.ts`
- `personalInfoSchema`, `lifestyleSchema`, `currentCycleSchema`, `pastCycleSchema`

### New: `src/types/onboarding.ts`
- `PastCycle`, `OnboardingData`, `OnboardingResponse`, `OnboardingState`, `OnboardingActions`

### New: `src/screens/onboarding/` (6 screens)
All screens include **ProgressDots** (showing `X/6` progress) and **← Back navigation** preserving form state:

- **WelcomeScreen** — gradient hero with flower icon, "Privacy-first" subtitle, `ProgressDots` at 1/6
- **PersonalInfoScreen** — age (numeric input), height/weight picker wheels (`PickerField`), `ProgressDots` 2/6
- **LifestyleScreen** — stress/exercise/diet toggle groups, sleep slider (`@react-native-community/slider`, 4–12h), `ProgressDots` 3/6
- **CurrentCycleScreen** — native date picker (`DatePickerField`), cycle/period length inputs, symptom chips (10 options), `ProgressDots` 4/6
- **PastCycleScreen** — reused for cycles 1–3 with same form layout, `ProgressDots` 4/6–6/6
- **CompleteScreen** — celebration animation (`CelebrationAnimation`), `submitOnboarding()` → navigates to MainTabs

### New: `src/components/ui/` (4 components)
| Component | Purpose |
|-----------|---------|
| `ProgressDots` | Horizontal dot indicator (`X` of `N`) for multi-step flows |
| `PickerField` | React Hook Form wrapper for `@react-native-picker/picker` |
| `DatePickerField` | Native date picker with `@react-native-community/datetimepicker` |
| `CelebrationAnimation` | Reanimated-based particle burst for completion screen |

### New: `src/navigation/OnboardingStack.tsx`
- Stack navigator: Welcome → PersonalInfo → Lifestyle → CurrentCycle → PastCycle1–3 → Complete

### Modified: `src/navigation/types.ts`
- Added `OnboardingStackParamList` type
- Added `Onboarding` to `RootStackParamList`

### Modified: `src/navigation/RootNavigator.tsx`
- On hydration, calls `GET /onboarding/status`
- If `!user` → AuthStack; if `onboardingCompleted` → MainTabs; else → OnboardingStack

### Modified: exports in `index.ts` files for types, validation, API, stores, navigation

## Event Bus Integration
- Cycle module subscribes to `"onboarding_completed"` in `init_module()`
- Handler: opens a fresh DB session, calls `CycleService.compute_initial_prediction()`
- OnboardingService emits event in `create_or_update()` when `onboarding_completed` transitions `False → True`
- Event dedup: subscriber checks for existing prediction before creating

## Critical Gaps Closed
| Gap | Fix |
|-----|-----|
| Missing DB unique constraint | Added `UniqueConstraint` + `IntegrityError` handler in `create_entry()` |
| Missing global model fallback | `compute_initial_prediction()` catches `FileNotFoundError`, falls back to 28-day median, logs warning |
| Missing snooze retention | `prune_snooze_events()` task in `global_cleanup.py` (90-day TTL) |
| No tests for new features | 11 onboarding tests + 13 cycle tests written and passing |
| Missing ProgressDots & back nav | All 6 screens updated with `ProgressDots` component and `← Back` touchable |
| Missing picker/date/slider/animation components | Added `PickerField`, `DatePickerField`, `CelebrationAnimation`; `@react-native-community/slider` installed |

## Test Results
- 55 tests pass (31 auth + 11 onboarding + 13 cycle)
- Python compilation: all changed files OK (onboarding module, cycle services/models, auth models, main.py, migrations 0006–0010, global_cleanup)
- TypeScript: zero errors from our code (only pre-existing Expo `tsconfig.base.json` issue)
- Test modules exercise: upsert idempotency, update, get, status, backfill count/idempotency/empty-past, event emission/dedup, unique constraint upsert, initial prediction fallback, correction linking with error calculation, ML metric updates, running averages, snooze create/multiple/bad-id

## Remaining Work (Phase 2)
- PII encryption at rest: apply `EncryptedJSONB` TypeDecorator to `UserOnboarding.current_symptoms` and `past_cycles`
- Monthly retraining script (`scripts/retrain_global_model.py`) with atomic `global_model.json` swap
- Offline local_delta bridge on mobile (sync logic, Calendar component update)
