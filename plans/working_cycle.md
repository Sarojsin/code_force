Complete Plan: Cycle Prediction System Overhaul
What's already fixed (previous session)
These changes are already applied to the codebase:

#	Fix	Files	Status
1	create_entry now recomputes predictions after new entry	backend/services.py:117-120, 129-131	Done
2	Calendar API returns predicted_cycle_length	backend/services.py:603	Done
3	CalendarResponse type updated on mobile	mobile/api/cycle.ts:24	Done
4	useCurrentCycleState hook exposes predictedCycleLength	mobile/hooks/useCurrentCycleState.ts:17,52,64	Done
5	Home dashboard ring uses real cycle length	mobile/HomeDashboardScreen.tsx:189,194,206	Done
What needs implementation (6 work items)
Work Item 1: Rolling Window Feature Builder
Goal: A shared function that builds the 3-cycle feature vector from raw CycleEntry rows. Both runtime prediction and the mobile offline prediction use this.

File: backend/app/integrations/prediction_engine.py

Add:

@dataclass
class RollingWindowFeatures:
    prev_1_cycle_length: int | None
    prev_1_period_length: int | None
    prev_1_irregular: int           # 1 = irregular, 0 = normal
    prev_2_cycle_length: int | None
    prev_2_period_length: int | None
    prev_2_irregular: int
    prev_3_cycle_length: int | None
    prev_3_period_length: int | None
    prev_3_irregular: int
    avg_cycle_length: float         # median of available cycle lengths
    avg_period_length: float        # median of available period lengths
    trend_slope: float | None       # linear regression of [prev_3, prev_2, prev_1]

def build_rolling_features(
    cycle_lengths: list[int],    # consecutive diffs, most recent first
    period_lengths: list[int],   # per-entry period lengths, most recent first
) -> RollingWindowFeatures:
Irregular flag logic:

cycle_length < 21 or cycle_length > 35 → irregular
period_length < 2 or period_length > 8 → irregular
Either condition triggers the flag
Trend slope:

Linear regression of x=[1,2,3] vs y=[prev_3_length, prev_2_length, prev_1_length]
With < 2 data points → None
Positive = cycles getting longer, Negative = getting shorter
Period length prediction:

avg_period_length = median([p for p in [prev_1, prev_2, prev_3] if p is not None])
Falls back to 5 if no data
Work Item 2: Update _predict_with_global_model() to use rolling features
File: backend/app/modules/cycle/services.py, lines 267-352

Current code (lines 274-277):

cycle_lengths = self._compute_cycle_lengths(entries)
period_lengths = [compute_period_length(e.period_start_date, e.period_end_date, 5) for e in entries]
avg_cycle = (u.avg_cycle_length or median(cycle_lengths)) if cycle_lengths else 28
New code:

cycle_lengths = self._compute_cycle_lengths(entries)
period_lengths = [compute_period_length(e.period_start_date, e.period_end_date, 5) for e in entries[:4]]
features = build_rolling_features(cycle_lengths, period_lengths)
Then pass features.avg_cycle_length instead of avg_cycle, features.trend_slope instead of u.trend_slope (which doesn't exist on the ORM), and features.avg_period_length for the period end calculation.

Also fix line 314:

# Current (broken — trend_slope column doesn't exist on User model):
user_trend_slope = u.trend_slope if u and hasattr(u, 'trend_slope') else None

# New (computed from rolling window):
user_trend_slope = features.trend_slope
Also update apply_global_model() signature in prediction_engine.py to accept the new features (sleep, exercise, diet) — see Work Item 5.

Work Item 3: Onboarding backfill initializes User ML metrics
File: backend/app/modules/onboarding/services.py, after line 124

Problem: After backfilling 4 CycleEntry rows, User.avg_cycle_length stays None. The first prediction falls back to 28-day default.

Add new method _initialize_user_ml_metrics():

Compute avg_cycle_length from current_cycle_length + past_cycles[].cycle_length
Compute cycle_length_std_dev (stdev of past cycle lengths if >= 2)
Set total_cycles_logged = len(past_cycles) + 1
Write to the User model
Call it at the end of create_or_update(), after _backfill_cycles():

if not was_already_completed:
    await self._backfill_cycles(user_id, data)
    await self._initialize_user_ml_metrics(user_id, data)
Work Item 4: Health fields updateable from profile settings
Goal: User can update age, height, weight, stress, exercise, sleep, diet after onboarding.

Backend (3 files)
4a. New schema — onboarding/schemas.py

class LifestyleUpdate(BaseModel):
    age: int | None = Field(None, ge=13, le=120)
    height_cm: float | None = Field(None, ge=50, le=250)
    weight_kg: float | None = Field(None, ge=20, le=300)
    stress_level: str | None = Field(None, pattern=r"^(low|moderate|high)$")
    exercise_frequency: str | None = Field(None, pattern=r"^(low|moderate|high)$")
    sleep_hours: float | None = Field(None, ge=0, le=24)
    diet: str | None = Field(None, pattern=r"^(balanced|normal|junk)$")
4b. New endpoint — onboarding/routes.py

@router.patch(
    "/lifestyle",
    response_model=OnboardingResponse,
    summary="Update health/lifestyle fields (partial).",
)
async def update_lifestyle(
    payload: LifestyleUpdate,
    current_user: CurrentUser,
    svc: OnboardingServiceDep,
) -> OnboardingResponse:
    onboarding = await svc.update_lifestyle(current_user.id, payload)
    return OnboardingResponse.model_validate(onboarding)
4c. New service method — onboarding/services.py

async def update_lifestyle(self, user_id: uuid.UUID, data: LifestyleUpdate) -> UserOnboarding:
    stmt = select(UserOnboarding).where(UserOnboarding.user_id == user_id)
    onboarding = (await self.db.execute(stmt)).scalar_one_or_none()
    if onboarding is None:
        raise OnboardingNotFoundError("Complete onboarding first.")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(onboarding, field, value)
    await self.db.commit()
    await self.db.refresh(onboarding)
    return onboarding
Mobile (4 files)
4d. New screen — mobile/src/screens/profile/EditHealthScreen.tsx

Field	Input type	Source
Age	Numeric input	UserOnboarding.age
Height	Picker (50-250 cm)	UserOnboarding.height_cm
Weight	Picker (20-300 kg)	UserOnboarding.weight_kg
Stress	Picker (Low/Moderate/High)	UserOnboarding.stress_level
Exercise	Picker (Low/Moderate/High)	UserOnboarding.exercise_frequency
Sleep	Slider (4-12 hrs)	UserOnboarding.sleep_hours
Diet	Picker (Balanced/Normal/Junk)	UserOnboarding.diet
Pre-fills from GET /api/v1/onboarding
Saves via PATCH /api/v1/onboarding/lifestyle
4e. API call — mobile/src/services/api/onboarding.ts

async updateLifestyle(data: Partial<OnboardingData>): Promise<OnboardingResponse> {
    const resp = await api.patch('/onboarding/lifestyle', data);
    return unwrap<OnboardingResponse>(resp.data);
},
4f. Navigation type — mobile/src/navigation/types.ts

Add EditHealth: undefined to ProfileStackParamList.

4g. Menu item — mobile/src/screens/profile/ProfileHomeScreen.tsx

Add to MENU_ITEMS:

{ label: 'Health Info', route: 'EditHealth', icon: '...' }
4h. Register screen — wherever the Profile stack navigator is defined, add EditHealth screen.

Work Item 5: Wire sleep/exercise/diet into prediction model
File: backend/app/integrations/prediction_engine.py

Add to apply_global_model() signature:

def apply_global_model(
    model: dict[str, Any],
    user_avg_cycle: float,
    user_std_cycle: float | None = None,
    user_trend_slope: float | None = None,
    user_avg_error: float | None = None,
    user_age_bucket_ordinal: float = 0,
    user_bmi_bucket_ordinal: float = 0,
    user_stress_level: str | None = None,
    user_avg_period_length: float = 5,
    user_local_delta: float = 0,
    user_sleep_hours: float | None = None,          # NEW
    user_exercise_frequency: str | None = None,     # NEW
    user_diet: str | None = None,                   # NEW
) -> tuple[int, float]:
Add to the prediction arithmetic:

if user_sleep_hours is not None:
    prediction += coef.get("sleep_hours", 0) * user_sleep_hours
if user_exercise_frequency:
    prediction += coef.get(f"exercise_{user_exercise_frequency}", 0)
if user_diet:
    prediction += coef.get(f"diet_{user_diet}", 0)
Update _predict_with_global_model() in services.py to read from onboarding and pass:

user_sleep_hours = onboarding.sleep_hours if onboarding else None
user_exercise_frequency = onboarding.exercise_frequency if onboarding else None
user_diet = onboarding.diet if onboarding else None
Also update mobile globalModel.ts to accept and pass these new features.

Work Item 6: Update build_calendar() to use rolling features for predicted_cycle_length
File: backend/app/modules/cycle/services.py, lines 554-559

Current code:

cycle_lengths = [
    (entries[i + 1].period_start_date - entries[i].period_start_date).days
    for i in range(len(entries) - 1)
    if 20 <= (entries[i + 1].period_start_date - entries[i].period_start_date).days <= 45
]
avg_cycle_length = round(median(cycle_lengths)) if cycle_lengths else 28
This is used for calendar phase rendering and returned as predicted_cycle_length. Replace with:

cycle_lengths = self._compute_cycle_lengths(entries)
period_lengths = [compute_period_length(e.period_start_date, e.period_end_date, 5) for e in entries[:4]]
features = build_rolling_features(cycle_lengths, period_lengths)
avg_cycle_length = round(features.avg_cycle_length)
File change summary
#	File	Change
1	backend/app/integrations/prediction_engine.py	Add RollingWindowFeatures, build_rolling_features(), _is_irregular(). Update apply_global_model() signature.
2	backend/app/modules/cycle/services.py	Update _predict_with_global_model() to use build_rolling_features(). Update build_calendar() to use rolling features.
3	backend/app/modules/onboarding/services.py	Add update_lifestyle() method. Add _initialize_user_ml_metrics() method. Call it after backfill.
4	backend/app/modules/onboarding/schemas.py	Add LifestyleUpdate schema.
5	backend/app/modules/onboarding/routes.py	Add PATCH /lifestyle endpoint.
6	mobile/src/screens/profile/EditHealthScreen.tsx	New file — health edit screen.
7	mobile/src/screens/profile/ProfileHomeScreen.tsx	Add "Health Info" menu item.
8	mobile/src/navigation/types.ts	Add EditHealth to ProfileStackParamList.
9	mobile/src/services/api/onboarding.ts	Add updateLifestyle() API call.
10	mobile/src/services/ml/globalModel.ts	Update LocalUserCycleData and calculatePrediction() to accept sleep/exercise/diet.
What the user experiences after all changes
Moment	Before	After
Home screen	Shows "19 days" (stale 28-day prediction)	Shows correct "26+ days" (real cycle length)
Ring progress	Always /28	/ {actual cycle length}
"Cycle avg" stat	Hardcoded 28	Real average from last 3 cycles
After logging period	Prediction doesn't update	Prediction recomputes immediately
First prediction after onboarding	Falls back to 28 days	Uses actual cycle lengths from onboarding data
User changes weight in settings	Not possible	Updates flow to prediction model next prediction
Model features	avg_cycle only (scalar)	3-cycle rolling window with irregular flags + trend slope

You're right, and it's a good catch. I read the actual pipeline to ground this. Here's my assessment.

Verdict: all three contradictions are real, and they share one root cause
Root cause: Cycle length is a derived quantity, not a raw input. A cycle's length is defined as next period start − this period start. It only becomes knowable/valid the moment the next period starts — i.e. the instant a cycle "completes." So the system should never ask a user for a cycle length. It should only ever ask for period start dates and compute lengths from the gaps.

Look at what the code actually does:

_compute_cycle_lengths() (services.py:419) builds features as diffs between consecutive period_start_dates — it never reads the user's typed cycle_length.
_backfill_cycles() (onboarding/services.py:78) also ignores cycle_length; it only stores period_start_date/period_end_date.
So the typed cycle_length fields are effectively dead for the feature pipeline — they're used only to seed user.avg_cycle_length in _initialize_user_ml_metrics. That's the contradiction made concrete: you ask the user for a value you don't actually trust/use for features, and for the active cycle you ask for a value the user is physically incapable of knowing.

The fix: model the domain correctly
Invariant: cycle_entries only ever stores period start dates. A cycle is "completed" iff a later entry exists. Lengths are always computed from gaps.

1. API contract — fields to remove / reinterpret
Remove current_cycle_length entirely. It's a self-prediction the user can't know. Replace with the raw reality:
current_cycle_start = the anchor (most recent period start)
current_period_length = how many days that bleeding lasted (this IS knowable — the period already ended)
Reinterpret past_cycles: for each past cycle, the user supplies cycle_start + period_length + symptoms. Drop the user-supplied cycle_length or make it optional/ignored — the system derives it as diff(adjacent start_dates).
2. The 3-cycle sliding window works by construction
With one current_cycle_start + up to 3 past_cycles, backfill stores 4 consecutive start dates:

[current, past1, past2, past3]  →  3 gaps = exactly the 3 completed-cycle features
The active cycle (current_cycle_start) is the prediction anchor (subject), never a feature.
The 3 gaps between those dates are the completed cycles (features).
build_rolling_features consume exactly 3 completed cycles. ✓
When the user logs their next period later:

New start inserted.
The old "active" cycle becomes completed (its length = new_start − old_current_start).
FIFO naturally drops the oldest — as long as the query keeps only the most recent N start dates.
3. Consistency between aggregates and features
_initialize_user_ml_metrics should also compute avg_cycle_length / std_dev / total_cycles_logged from the date gaps, not from user-typed lengths — so the seed metrics and the rolling features can never disagree. That closes the "Feature Mismatch" contradiction: no stale 28-day fallback, no broken FIFO.

4. Validation, not elimination — keep safe guards
Keep cycle_length off the input schema but optionally allow it only as an upstream cross-check (assert it matches the date-gap within tolerance) — for the completed past cycles where the user genuinely could know it. Never for the active cycle.

I'm confident this is the right design. It converts the schema from "user tells us their cycle lengths" to "system derives them from dates," which is exactly what the ML features already assume.

Want me to implement it? Concretely I'd:

Strip current_cycle_length from OnboardingCreate + PastCycleSchema in backend/app/modules/onboarding/schemas.py.
Rewrite build_calendar/_backfill/_initialize_user_ml_metrics to derive lengths from gaps (they mostly already do).
Update the mobile onboarding screens (remove the now-logically-invalid numeric inputs) + types + API contract doc.
Add/extend tests for the 4-dates→3-completed-cycles path and the active→completed transition.