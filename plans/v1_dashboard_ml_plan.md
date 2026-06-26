# V1 Dashboard & ML — User Onboarding, Enhanced Cycle Dashboard, ML Predictions, Sentiment Analysis & Wellness Recommendations

## Objective

Deliver the complete V1 user experience: from sign-in → onboarding questionnaire → personalized cycle dashboard with ML-powered predictions → daily journal with sentiment analysis → adaptive wellness recommendations.

This plan touches **three backend modules** (onboarding, cycle, wellness), **one new integration** (prediction engine), and **multiple mobile screens** across onboarding, cycle, and wellness.

---

## Phase Breakdown (reference each phase plan for detail)

| Phase | File | Covers |
|-------|------|--------|
| **0 — Auth & Sessions** | [Phase0_Authentication_Session_Management.md](./Phase0_Authentication_Session_Management.md) | JWT with `user_secret_key` kill-switch, register/login/refresh/logout, MFA, session management, mobile LoginScreen/RegisterScreen/PhoneScreen/OtpScreen |
| **1 — User Onboarding** | [Phase1_User_Onboarding_Health_Profile.md](./Phase1_User_Onboarding_Health_Profile.md) | 6-step mobile onboarding, backfill into `cycle_entries`, correction feedback loop, `user_onboarding` table, dirty-user retraining |
| **2 — Cycle & ML** | [Phase2_Core_Cycle_Tracking_ML_Prediction_Engine.md](./Phase2_Core_Cycle_Tracking_ML_Prediction_Engine.md) | Calendar endpoint, fallback model chain (heuristic→median→LR→RF), per-user model, global XGBoost model, prediction window for irregular users, mobile calendar UI |
| **3 — Local AI Engine** | [Phase3_Local_AI_Wellness_Engine.md](./Phase3_Local_AI_Wellness_Engine.md) | On-device `llama.cpp` inference (Qwen2.5 1.5B), heuristic fallback, journal analysis stays on-device, structured data sync only, model progressive download |
| **4 — Safety & SOS** | [Phase4_Safety_Emergency_SOS_Module.md](./Phase4_Safety_Emergency_SOS_Module.md) | `emergency_contacts` CRUD, SOS event with idempotency key, FCM push + Twilio SMS + native SMS fallback, 2-sec hold trigger, check-in task |
| **5 — Offline Sync** | [Phase5_Hybrid_Offline_Online_Sync_Strategy.md](./Phase5_Hybrid_Offline_Online_Sync_Strategy.md) | Offline queue (encrypted storage), sync engine (FIFO push + ETag pull), offline banner, journal draft auto-save, retry logic |
| **6 — Testing & CI/CD** | [Phase6_Production_Readiness_Testing_CICD.md](./Phase6_Production_Readiness_Testing_CICD.md) | 80% coverage targets, GitHub Actions CI (backend + mobile), structlog, Sentry (backend + mobile), rate limiting, staging env, E2E test flows |
| **7 — Launch** | [Phase7_Launch_PostLaunch.md](./Phase7_Launch_PostLaunch.md) | App store prep, phased rollout (10%→25%→50%→100%), alerting dashboards, analytics events, feature flags, post-launch roadmap |

**How to use these files:**
- The **master document** (this file: `v1_dashboard_ml_plan.md`) contains the original full spec. All technical detail was migrated into the phase-specific files above.
- Start each sprint by reading the relevant phase plan. Each plan is self-contained with its own validation criteria.
- Update the phase plan when implementation reveals something not originally captured.

---

## Table of Contents

1. [Phase 1 — User Onboarding (New Module)](#phase-1--user-onboarding-new-module)
2. [Phase 2 — Enhanced Cycle Dashboard & Calendar](#phase-2--enhanced-cycle-dashboard--calendar)
3. [Phase 3 — ML Prediction Engine](#phase-3--ml-prediction-engine)
4. [Phase 4 — Sentiment Keyword Extraction](#phase-4--sentiment-keyword-extraction)
5. [Phase 5 — Wellness Recommendations](#phase-5--wellness-recommendations)
6. [Mobile: Onboarding Navigation & Screens](#mobile-onboarding-navigation--screens)
7. [Mobile: Cycle Screen Updates](#mobile-cycle-screen-updates)
8. [Mobile: Wellness Screen Updates](#mobile-wellness-screen-updates)
9. [Migrations](#migrations)
10. [Dependencies Added](#dependencies-added)
11. [Testing Strategy](#testing-strategy)
12. [Validation Criteria](#validation-criteria)
13. [Rollout Order](#rollout-order)

---

## Phase 1 — User Onboarding (New Module)

### Backend: `app/modules/onboarding/`

#### `models.py`

```python
class UserOnboarding(Base):
    __tablename__ = "user_onboarding"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
        unique=True, index=True, nullable=False
    )
    # Personal
    age: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)          # 13-120
    height_cm: Mapped[float | None] = mapped_column(Float, nullable=True)          # 50-250 cm
    weight_kg: Mapped[float | None] = mapped_column(Float, nullable=True)          # 20-300 kg
    # Lifestyle
    stress_level: Mapped[str | None] = mapped_column(String(10), nullable=True)    # "low"|"moderate"|"high"
    exercise_frequency: Mapped[str | None] = mapped_column(String(10), nullable=True) # "low"|"moderate"|"high"
    sleep_hours: Mapped[float | None] = mapped_column(Float, nullable=True)        # 0-24
    diet: Mapped[str | None] = mapped_column(String(10), nullable=True)            # "balanced"|"normal"|"junk"
    # Current cycle
    current_cycle_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    current_cycle_length: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # 20-45
    current_period_length: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # 2-10
    current_symptoms: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    # Past cycles (array of embedded JSON objects)
    past_cycles: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    # Status
    onboarding_completed: Mapped[bool] = mapped_column(default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

Past cycles JSONB structure:
```json
[
  {
    "cycle_start": "2025-12-01",
    "cycle_length": 28,
    "period_length": 5,
    "symptoms": ["cramps", "fatigue"]
  }
    {
    "cycle_start": "2025-11-01",
    "cycle_length": 28,
    "period_length": 5,
    "symptoms": ["cramps", "headache"]
  }
]
```

#### `schemas.py`

| Schema | Fields |
|--------|--------|
| `PastCycleSchema` | `cycle_start: date`, `cycle_length: int` (20-45), `period_length: int` (2-10), `symptoms: list[str]` |
| `OnboardingCreate` | All personal + lifestyle + current cycle fields + `past_cycles: list[PastCycleSchema]` |
| `OnboardingUpdate` | All fields optional |
| `OnboardingResponse` | All fields + `id`, `user_id`, `onboarding_completed`, `completed_at`, `created_at` (from_attributes=True) |

#### `services.py`

```python
class OnboardingService:
    def __init__(self, db: AsyncSession) -> None

    async def create_or_update(self, user_id: uuid.UUID, data: OnboardingCreate) -> UserOnboarding
        # Upsert logic. If updating, merge past cycles (don't overwrite).
        # On first completion, set onboarding_completed=True, completed_at=now().
        # Emit event: event_bus.emit("onboarding_completed", user_id=user_id)

    async def get_onboarding(self, user_id: uuid.UUID) -> UserOnboarding | None
        # Return None if not yet created

    async def is_onboarding_complete(self, user_id: uuid.UUID) -> bool
        # Quick check for RootNavigator redirect
```

#### `routes.py`

```
PUT    /api/v1/onboarding          -> create_or_update  (idempotent upsert)
GET    /api/v1/onboarding           -> get_onboarding
GET    /api/v1/onboarding/status    -> {"completed": bool}
```

All routes require auth (current_user dependency).

#### `dependencies.py`

```python
async def get_onboarding_service(db: AsyncSession = Depends(get_db)) -> OnboardingService
OnboardingServiceDep = Annotated[OnboardingService, Depends(get_onboarding_service)]
```

#### `exceptions.py`

| Exception | code | http_status |
|-----------|------|-------------|
| `OnboardingError` | `ONBOARDING_ERROR` | 400 |
| `OnboardingValidationError` | `ONBOARDING_VALIDATION` | 422 |

#### Event Bus Integration

In `services.py` `create_or_update`, emit:
```python
if not existing or (not existing.onboarding_completed and data.onboarding_completed):
    await event_bus.emit("onboarding_completed", user_id=str(user_id))
```

Subscribers (in cycle module):
```python
@event_bus.subscribe("onboarding_completed")
async def on_onboarding_completed(user_id: str):
    # Auto-compute first predictions from onboarding data
    await cycle_service.compute_predictions(uuid.UUID(user_id))
```

#### `tasks.py`

(Optional) A Celery task for post-onboarding processing:
```python
@celery_app.task(soft_time_limit=60, time_limit=120)
def process_onboarding_data(user_id: str) -> None:
    """Seed first cycle entries from onboarding past_cycles, then compute predictions."""
```

---

## Phase 2 — Enhanced Cycle Dashboard & Calendar

### Backend: Update `app/modules/cycle/`

#### `models.py` — Add to `PredictedCycle`

```python
# New columns on PredictedCycle
model_type: Mapped[str | None] = mapped_column(String(20), nullable=True)      # "median"|"poly_reg"|"random_forest"|"xgboost"
confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)    # 0.0–1.0
training_data_points: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
```

#### `schemas.py` — Add

```python
class CalendarDay(BaseModel):
    date: date
    type: Literal["period", "predicted_period", "fertile_window", "predicted_fertile_window", "today", "none"]
    cycle_entry_id: uuid.UUID | None = None

class CalendarResponse(BaseModel):
    days: list[CalendarDay]                               # Backward compatible 6 months
    predictions: PredictionResponse | None = None
    next_period_in_days: int | None = None

class PredictionDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    predicted_next_period_start: date
    predicted_period_end: date | None = None
    predicted_fertile_window_start: date | None
    predicted_fertile_window_end: date | None
    model_type: str
    confidence_score: float | None
    training_data_points: int

class PredictionListResponse(BaseModel):
    predictions: list[PredictionDetail]                    # next 3 predicted cycles
    model_used: str
    data_quality: Literal["insufficient", "minimal", "good", "excellent"]
```

#### `services.py` — Add methods

```python
async def get_calendar(self, user_id: uuid.UUID, months_back: int = 3, months_forward: int = 3) -> dict
    # Fetch actual cycle entries + predicted cycles within range
    # Return sorted day-by-day CalendarResponse

async def get_prediction_list(self, user_id: uuid.UUID) -> dict
    # Return next 3 predicted cycles (extend single prediction to 3)
    # Use median cycle length to project forward

async def compute_predictions_enhanced(self, user_id: uuid.UUID) -> PredictedCycle
    # Refactored: calls prediction engine (Phase 3) if >=3 cycles, else median fallback
    # Stores model_type, confidence_score, training_data_points
```

#### `routes.py` — Add endpoints

```
GET    /api/v1/cycle/calendar        -> get_calendar    (?months_back=3&months_forward=3)
GET    /api/v1/cycle/predictions     -> get_predictions (updated: returns PredictionListResponse)
```

---

## Phase 3 — ML Prediction Engine

### Backend: `app/integrations/prediction_engine.py`

```python
"""
Cycle prediction engine. Supports three models:

1. Polynomial Regression (baseline) — fast, deterministic, works with small datasets
2. Random Forest — robust to outliers, requires >=6 cycles for meaningful results
3. XGBoost — highest accuracy, requires >=8 cycles and hyperparameter tuning

Fallback chain:
  < 3 cycles  → 28-day default heuristic
  3-5 cycles  → Median (current logic) + Polynomial Regression
  6-7 cycles  → Polynomial Regression + Random Forest (ensemble)
  8+ cycles   → All three models, ensemble weighted by recency
"""

import numpy as np
from sklearn.preprocessing import PolynomialFeatures
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
import xgboost as xgb
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass
class PredictionResult:
    next_period_start: date
    next_period_end: date | None
    fertile_window_start: date
    fertile_window_end: date
    confidence: float
    model_used: str
    data_points: int


class CyclePredictor:
    def __init__(self):
        self._poly_reg: LinearRegression | None = None
        self._rf_model: RandomForestRegressor | None = None
        self._xgb_model: xgb.XGBRegressor | None = None

    def predict(
        self,
        cycle_start_dates: list[date],
        cycle_lengths: list[int],
        period_lengths: list[int],
    ) -> PredictionResult:
        # 1. Determine model based on data count
        # 2. Train model on historical data
        #    - Features: cycle_index (0..n), cycle_length_n-1, period_length_n-1, day_of_year
        #    - Target: cycle_length
        # 3. Predict next cycle length and period length
        # 4. Compute fertile window (standard 14 days before next period)
        # 5. Return PredictionResult with confidence score

    def _features(self, cycle_start_dates, cycle_lengths, period_lengths) -> np.ndarray:
        # Build feature matrix for model training
        pass

    def _train_models(self, X: np.ndarray, y: np.ndarray) -> None:
        # Train poly_reg, rf, xgb on X, y
        pass

    def _ensemble_predict(self, X: np.ndarray) -> tuple[float, float]:
        # Weighted ensemble of all trained models
        pass

    def _confidence(self, model_used: str, n: int, residuals: list[float]) -> float:
        # Heuristic: more data + simpler model + lower residuals = higher confidence
        pass
```

### Backend: Update `app/modules/cycle/services.py`

#### `compute_predictions` refactored:

```python
async def compute_predictions(self, user_id: uuid.UUID) -> PredictedCycle:
    # 1. Fetch cycle entries ordered by start_date DESC (limit 12)
    # 2. Extract cycle_lengths, period_lengths, start_dates
    # 3. Call CyclePredictor.predict()
    # 4. Upsert PredictedCycle with new fields
    # 5. If confidence < 0.3, also store the median fallback model separately
```

### Backend: Update `app/modules/cycle/tasks.py`

#### Enhance `update_cycle_predictions`:

```python
@celery_app.task(name="app.modules.cycle.tasks.update_cycle_predictions",
                 soft_time_limit=300, time_limit=600)
def update_cycle_predictions() -> int:
    """Daily task: re-train and re-predict for all users with new data.
       Now invokes CyclePredictor instead of simple median."""
```

New task for model training:
```python
@celery_app.task(name="app.modules.cycle.tasks.train_prediction_model",
                 soft_time_limit=600, time_limit=1200)
def train_prediction_model(user_id: str) -> None:
    """Train models for a specific user, run after new cycle entry is logged."""
```

---

## Phase 4 — Sentiment Keyword Extraction

### Backend: Update `app/modules/wellness/`

#### `models.py` — Add to `JournalEntry`

```python
# New column
sentiment_keywords: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
```

Structure:
```json
["happy", "energetic", "anxious"]
```

#### `services.py` — Update `analyze_sentiment`

```python
async def analyze_sentiment(self, entry_id: uuid.UUID) -> None:
    # 1. Fetch entry
    # 2. Decrypt content
    # 3. Call huggingface for sentiment (existing)
    # 4. Extract keywords:
    #    - Split content into words
    #    - Filter stop words, punctuation, short words (<3 chars)
    #    - Use a small keyword lexicon or TF-IDF scoring
    #    - Store top 5 keywords in entry.sentiment_keywords
    # 5. Update entry
    # 6. Emit event: "journal_analyzed" for recommendation engine
```

Keyword extraction approach (no additional API dependency):
```python
import re
from collections import Counter

# Emotion/mood lexicon (expandable)
EMOTION_WORDS = {
    "happy", "sad", "anxious", "energetic", "tired", "stressed",
    "calm", "irritable", "hopeful", "grateful", "overwhelmed",
    "lonely", "motivated", "confident", "scared", "angry",
    # ... 50-100 common emotion words
}

def extract_keywords(text: str, top_n: int = 5) -> list[str]:
    words = re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())
    # Score: emotion words weighted 2x, common words 1x
    scored = Counter()
    for w in words:
        scored[w] += 2 if w in EMOTION_WORDS else 1
    return [w for w, _ in scored.most_common(top_n)]
```

---

## Phase 5 — Wellness Recommendations

### Backend: Update `app/modules/wellness/`

#### `models.py` — New table

```python
class Recommendation(Base):
    __tablename__ = "recommendations"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    category: Mapped[str] = mapped_column(String(30), nullable=False)    # "wellness"|"lifestyle"|"motivation"|"cycle"
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(String(1000), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(200), nullable=True)  # Why this recommendation
    priority: Mapped[int] = mapped_column(SmallInteger, default=0)        # 0-5, higher = more urgent
    dismissed: Mapped[bool] = mapped_column(default=False, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
```

#### `schemas.py` — Add

```python
class RecommendationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    category: str
    title: str
    body: str
    reason: str | None
    priority: int
    generated_at: datetime

class RecommendationListResponse(BaseModel):
    recommendations: list[RecommendationResponse]
    generated_at: datetime | None
```

#### `recommendation_engine.py` (new file in wellness module)

```python
"""
Recommendation engine. Generates personalized recommendations based on:
- Sentiment trends (from journal entries)
- Mood patterns (from mood logs)
- Cycle phase (from cycle predictions)
- Lifestyle data (from onboarding)

Rule-based system that improves as more data accumulates.
"""

RECOMMENDATIONS = {
    "negative_sentiment_3days": {
        "category": "wellness",
        "title": "Take a moment for yourself",
        "body": "You've been feeling down for a few days. Try a 5-minute breathing exercise or take a short walk.",
        "reason": "Negative sentiment detected in recent journal entries",
    },
    "low_energy": {
        "category": "lifestyle",
        "title": "Boost your energy naturally",
        "body": "Low energy during this phase is normal. Try light stretching and staying hydrated.",
        "reason": "Energy dip detected in your cycle phase",
    },
    "pre_period_mood": {
        "category": "cycle",
        "title": "Your period is approaching",
        "body": "It's common to feel irritable or tired before your period. Rest up and be gentle with yourself.",
        "reason": "Predicted period in 3 days + mood pattern suggests PMS",
    },
    # ... 15-20 curated recommendations
}

def generate_recommendations(
    sentiment_trend: str,           # "improving"|"stable"|"declining"
    recent_moods: list[str],
    cycle_phase: str | None,        # "period"|"follicular"|"ovulation"|"luteal"|None
    avg_mood_intensity: float | None,
    has_journal_entries: bool,
) -> list[dict]:
    """Rule-based engine. Returns list of recommendation dicts."""
    results = []
    # Rules:
    # - If sentiment declining for 3+ entries → "negative_sentiment_3days"
    # - If luteal phase + irritability → "pre_period_mood"
    # - If period phase + low energy → "low_energy"
    # - If no journal entries → "start_journaling"
    # - If consistent positive mood → "maintain_habit"
    return results
```

#### `services.py` — Add methods

```python
async def generate_recommendations(self, user_id: uuid.UUID) -> list[Recommendation]:
    # 1. Fetch recent sentiment data from journal entries (last 14 days)
    # 2. Fetch recent mood logs (last 7 days)
    # 3. Fetch user's cycle predictions
    # 4. Call recommendation_engine.generate_recommendations()
    # 5. Store results in recommendations table (replace old active ones)
    # 6. Return

async def get_recommendations(self, user_id: uuid.UUID) -> list[Recommendation]:
    # Return active (non-dismissed) recommendations, ordered by priority DESC, generated_at DESC

async def dismiss_recommendation(self, rec_id: uuid.UUID, user_id: uuid.UUID) -> None:
    # Set dismissed=True

async def refresh_recommendations(self, user_id: uuid.UUID) -> list[Recommendation]:
    # Called after new journal entry or mood log
    # Re-generate recommendations based on latest data
```

#### `routes.py` — Add endpoints

```
GET    /api/v1/wellness/recommendations            -> get_recommendations
POST   /api/v1/wellness/recommendations/refresh    -> refresh_recommendations (200, returns new list)
POST   /api/v1/wellness/recommendations/{rec_id}/dismiss -> dismiss_recommendation (204)
```

#### `tasks.py` — Add task

```python
@celery_app.task(name="app.modules.wellness.tasks.generate_weekly_recommendations",
                 soft_time_limit=120, time_limit=300)
def generate_weekly_recommendations() -> int:
    """Weekly task: generate fresh recommendations for all active users.
       Complements the existing generate_weekly_insights task."""
```

---

## Mobile: Onboarding Navigation & Screens

### Navigation Updates

#### `src/navigation/types.ts` — Add

```typescript
export type OnboardingStackParamList = {
  OnboardingWelcome: undefined;
  PersonalInfo: undefined;
  Lifestyle: undefined;
  CurrentCycle: undefined;
  PastCycles: { cycleIndex: number } | undefined;  // index 0, 1, 2
  OnboardingComplete: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Onboarding: NavigatorScreenParams<OnboardingStackParamList>;  // NEW
  Main: NavigatorScreenParams<MainTabParamList>;
  Chat: NavigatorScreenParams<ChatStackParamList>;
};
```

#### `src/navigation/OnboardingStack.tsx` (new)

```
OnboardingWelcome → PersonalInfo → Lifestyle → CurrentCycle → PastCycles (×3) → OnboardingComplete
```

All screens: `headerShown: false` (custom header with progress indicator).

#### `src/navigation/RootNavigator.tsx` — Update

```typescript
// After hydration and user is set:
if (user && !onboardingCompleted) {
  return <OnboardingStack />;
}
```

The `onboardingCompleted` flag comes from a new `useOnboardingStatus()` hook or stored in the onboarding store.

### Screens in `src/screens/onboarding/`

| Screen | File | Content |
|--------|------|---------|
| WelcomeScreen | `OnboardingWelcomeScreen.tsx` | Gradient header + flower icon, "Let's set up your personalized dashboard", subtitle, "Get started" button |
| PersonalInfoScreen | `PersonalInfoScreen.tsx` | Age (numeric input), Height (picker: cm/ft toggle), Weight (picker: kg/lbs toggle) |
| LifestyleScreen | `LifestyleScreen.tsx` | Stress level (3 toggle buttons: Low/Moderate/High), Exercise frequency (3 buttons), Sleep hours (slider 4-12), Diet (3 buttons: Balanced/Normal/Junk) |
| CurrentCycleScreen | `CurrentCycleScreen.tsx` | Cycle start date (date picker), Cycle length (picker 20-45), Period length (picker 2-10), Symptoms (multi-select grid) |
| PastCyclesScreen | `PastCyclesScreen.tsx` | Same fields as CurrentCycleScreen, for 3 past cycles. Shows progress "2 of 3" |
| CompleteScreen | `OnboardingCompleteScreen.tsx` | Confirmation animation, "Your dashboard is ready!", "Go to Dashboard" button |

**All screens share**:
- Consistent gradient header (matching LoginScreen design)
- "Continue" / "Back" navigation buttons
- Progress dots at top (step 1/6, step 2/6, etc.)
- Data saved to Zustand store during flow; submitted as single API call at end

### State Management

#### `src/stores/onboardingStore.ts` (new)

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
  // Actions
  setPersonalInfo: (age: number, heightCm: number, weightKg: number) => void;
  setLifestyle: (data: LifestyleData) => void;
  setCurrentCycle: (data: CurrentCycleData) => void;
  addPastCycle: (data: PastCycle) => void;
  submitOnboarding: () => Promise<void>;
}
```

#### `src/services/api/onboarding.ts` (new)

```typescript
export const onboardingService = {
  async submit(data: OnboardingCreate): Promise<OnboardingResponse>,
  async getStatus(): Promise<{ completed: boolean }>,
  async getData(): Promise<OnboardingResponse>,
};
```

#### `src/services/queries/onboarding.ts` (new)

```typescript
export function useOnboardingSubmit(): UseMutationResult<...>;
export function useOnboardingStatus(): UseQueryResult<{ completed: boolean }>;
```

#### `src/validation/onboarding.ts` (new)

Zod schemas for each step:
```typescript
export const personalInfoSchema = z.object({
  age: z.number().int().min(13).max(120),
  heightCm: z.number().min(50).max(250),
  weightKg: z.number().min(20).max(300),
});

export const lifestyleSchema = z.object({
  stressLevel: z.enum(['low', 'moderate', 'high']),
  exerciseFrequency: z.enum(['low', 'moderate', 'high']),
  sleepHours: z.number().min(0).max(24),
  diet: z.enum(['balanced', 'normal', 'junk']),
});

export const currentCycleSchema = z.object({
  cycleStartDate: z.string(),       // date string
  cycleLength: z.number().int().min(20).max(45),
  periodLength: z.number().int().min(2).max(10),
  symptoms: z.array(z.string()),
});

export const pastCycleSchema = currentCycleSchema;
```

---

## Mobile: Cycle Screen Updates

### `CycleDashboardScreen.tsx` — Full rewrite

```
Layout:
┌─────────────────────────────┐
│  [Header: "Your Cycle"]     │  gradient + flower
├─────────────────────────────┤
│  Next period in 12 days     │  large stat card (pink bg)
│  ┌─────────────────────┐    │
│  │  March 2025         │    │  PeriodCalendar component
│  │ Mo Tu We Th Fr Sa Su│    │
│  │          1  2  3    │    │  - Red fill = period day
│  │  4  5  6  7  8  9 10│    │  - Light red = predicted
│  │ 11 12 13 14 15 16 17│    │  - Purple dot = fertile
│  │ 18 19 20 21 22 23 24│    │  - Blue outline = today
│  │ 25 26 27 28 29 30 31│    │
│  └─────────────────────┘    │
├─────────────────────────────┤
│  Quick Actions              │
│  [Log Period] [Predictions] │  two buttons
│  [History]    [Analytics]   │
└─────────────────────────────┘
```

### `CyclePredictionsScreen.tsx` — Update

- Fetch real prediction data from `/cycle/predictions`
- Show next 3 predicted cycles with dates
- Display confidence score as a bar
- Show model used (Median / Poly Reg / Random Forest / XGBoost)
- Show data quality indicator

### `PeriodCalendar.tsx` (new component, `src/components/ui/`)

```typescript
interface PeriodCalendarProps {
  month: Date;                              // Month to display
  entries: CycleEntry[];                    // Actual logged periods
  predictions: PredictionDetail[];          // Predicted periods
  onDatePress?: (date: Date) => void;
}

// Uses react-native-calendars or custom implementation with:
// - Month/year header with prev/next arrows
// - 7-column day grid
// - Color coding:
//   - 🔴 Red fill + bold = actual period day
//   - 🟡 Light red fill = predicted period day
//   - 🟣 Purple indicator = fertile window
//   - 🔵 Blue circle = today
//   - ⚪ Default = normal day
```

---

## Mobile: Wellness Screen Updates

### `JournalEntryScreen.tsx` — Update

After journal entry is saved and sentiment analysis completes:
- Show sentiment result: emoji + label (Positive / Neutral / Negative) + score bar
- Show extracted keywords as tags
- Show a "Get Recommendation" button → navigates to Insights

### `InsightsScreen.tsx` — Update

- Fetch recommendations from `/wellness/recommendations`
- Display recommendations as cards grouped by category
- Each card: icon + title + body + "Dismiss" button
- Empty state: "No recommendations yet. Keep journaling!"
- Swipe to dismiss

### `WellnessHomeScreen.tsx` — Update

- Add quick journal entry button at top
- Show mood trend sparkline (last 7 days)
- Show today's sentiment if logged
- Show active recommendation count badge
- Link to Insights screen

### `SentimentBadge.tsx` (new component)

```typescript
interface SentimentBadgeProps {
  label: 'positive' | 'neutral' | 'negative';
  score?: number;
  size?: 'sm' | 'md' | 'lg';
}

// Visual: colored pill with emoji
// Positive = green + 😊
// Neutral = amber + 😐
// Negative = red + 😔
// Score bar underneath (0-100%)
```

### `RecommendationCard.tsx` (new component)

```typescript
interface RecommendationCardProps {
  title: string;
  body: string;
  category: 'wellness' | 'lifestyle' | 'motivation' | 'cycle';
  onDismiss: () => void;
  onAction?: () => void;
}

// Visual: card with category icon on left
// Dismiss button (X) top right
// "Apply" / "View" action button at bottom
// Color coded by category:
//   wellness = teal
//   lifestyle = green
//   motivation = purple
//   cycle = pink
```

---

## Migrations

| # | File | Changes |
|---|------|---------|
| `0005` | `0005_onboarding_table.py` | Create `user_onboarding` table |
| `0006` | `0006_add_prediction_model_fields.py` | Add `model_type`, `confidence_score`, `training_data_points` to `predicted_cycles` |
| `0007` | `0007_add_sentiment_keywords.py` | Add `sentiment_keywords` JSONB to `journal_entries` |
| `0008` | `0008_recommendations_table.py` | Create `recommendations` table |

All migrations reversible (downgrade defined). One migration per logical change.

---

## Dependencies Added

### Backend (`pyproject.toml`)

```toml
[tool.poetry.dependencies]
scikit-learn = "^1.5.0"
xgboost = "^2.1.0"
numpy = "^1.26.0"
pandas = "^2.2.0"
```

### Mobile (`package.json`)

```json
{
  "dependencies": {
    "react-native-calendars": "^1.1307.0"
  }
}
```

---

## Testing Strategy

### Backend Tests

| Module | File | Tests |
|--------|------|-------|
| Onboarding | `tests/modules/onboarding/test_services.py` | Create onboarding, update, is_complete, validation |
| Onboarding | `tests/modules/onboarding/test_routes.py` | PUT/GET/status endpoints, auth required |
| Cycle (enhanced) | `tests/modules/cycle/test_predictions.py` | Calendar endpoint, enhanced predictions, prediction list |
| Cycle (enhanced) | `tests/modules/cycle/test_models.py` | CyclePredictor with mock data (2 entries, 6 entries, 10 entries) |
| Wellness (enhanced) | `tests/modules/wellness/test_recommendations.py` | Generate recommend, get/dismiss, refresh |
| Wellness (enhanced) | `tests/modules/wellness/test_keywords.py` | Keyword extraction from different text inputs |
| Integration | `tests/integrations/test_prediction_engine.py` | CyclePredictor.fit/predict with known data |

### Mobile Tests

| File | Tests |
|------|-------|
| `tests/validation/onboarding.test.ts` | Zod schema validation for all onboarding forms |
| `tests/components/PeriodCalendar.test.tsx` | Calendar renders correct colored cells |
| `tests/components/SentimentBadge.test.tsx` | Badge shows correct color/emoji per label |
| `tests/components/RecommendationCard.test.tsx` | Card renders correct icon per category |

### Test Fixtures

- `tests/modules/onboarding/conftest.py`: OnboardingCreate factory
- `tests/modules/cycle/conftest.py`: CycleEntry factory (multiple lengths for ML)
- `tests/integrations/conftest.py`: CyclePredictor test data (controlled sequences)

---

## Validation Criteria

### Backend

- [ ] Onboarding CRUD: user creates/updates/gets onboarding data
- [ ] Onboarding status: endpoint returns `{completed: true}` after submission
- [ ] Calendar endpoint returns correct day-by-day type labels for 6 months
- [ ] Predictions: models train without error on 3+ data points
- [ ] Predictions: fall back to 28-day heuristic for <3 entries
- [ ] Predictions: confidence score increases with more data
- [ ] Keyword extraction: returns ≤5 keywords from journal text
- [ ] Recommendations: return non-empty list if user has journal entries
- [ ] Recommendations: dismiss sets `dismissed=True`
- [ ] Recommendations: refresh re-generates based on latest data
- [ ] All migrations run and reverse cleanly
- [ ] All existing cycle + wellness tests still pass

### Mobile

- [ ] Onboarding flow: user can complete all 6 steps and see confirmation
- [ ] Onboarding flow: progress dots update correctly
- [ ] Onboarding flow: back navigation preserves entered data
- [ ] Dashboard calendar: shows colored period/predicted/fertile/today cells
- [ ] Predictions screen: shows 3 future predictions with confidence
- [ ] Journal entry: shows sentiment badge + keywords after analysis
- [ ] Recommendations: cards display with correct category colors
- [ ] TypeScript: `npx tsc --noEmit` passes with 0 errors
- [ ] E2E: login → onboarding → dashboard → log journal → see recommendation

---

## Rollout Order

```
Week 1: Backend Phase 1 (onboarding module + migration 0005)
        + Mobile onboarding screens + navigation

Week 2: Backend Phase 2 (calendar endpoint, prediction list)
        + Backend Phase 3 (prediction engine, migration 0006)
        + Mobile cycle dashboard + prediction screen updates

Week 3: Backend Phase 4 (keyword extraction, migration 0007)
        + Backend Phase 5 (recommendation engine + table, migration 0008)
        + Mobile wellness screen updates + new components

Week 4: Integration testing + bug fixes
        + API contract update (plans/30-mobile-api-contract.md)
```

---

## Appendix: Mobile API Contract Changes

### New Endpoints

| Method | Path | Request | Response |
|--------|------|---------|----------|
| PUT | `/api/v1/onboarding` | `OnboardingCreate` | `OnboardingResponse` (201 created, 200 updated) |
| GET | `/api/v1/onboarding` | — | `OnboardingResponse` (404 if not set up) |
| GET | `/api/v1/onboarding/status` | — | `{"completed": bool}` |
| GET | `/api/v1/cycle/calendar` | `?months_back=3&months_forward=3` | `CalendarResponse` |
| GET | `/api/v1/cycle/predictions` | — | `PredictionListResponse` (updated) |
| GET | `/api/v1/wellness/recommendations` | — | `RecommendationListResponse` |
| POST | `/api/v1/wellness/recommendations/refresh` | — | `RecommendationListResponse` |
| POST | `/api/v1/wellness/recommendations/{rec_id}/dismiss` | — | 204 |

### Updated Schemas

**`CycleEntryResponse`** — unchanged (backward compatible)

**`PredictionDetail`** (replaces old `PredictionResponse`):
```json
{
  "id": "uuid",
  "predicted_next_period_start": "2025-04-15",
  "predicted_period_end": "2025-04-20",
  "predicted_fertile_window_start": "2025-04-01",
  "predicted_fertile_window_end": "2025-04-06",
  "model_type": "random_forest",
  "confidence_score": 0.87,
  "training_data_points": 8
}
```

**`JournalEntryResponse`** — add field:
```json
{
  "sentiment_keywords": ["happy", "energetic", "grateful"]
}
```
