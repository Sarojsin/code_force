# Wellness Tab UI Upgrade Plan: Context-Aware Calm

> **Overarching Principle:** Do not show generic numbers. Show numbers interpreted through the lens of the user's cycle phase and historical trends. This makes the app feel psychic.

## Status: IMPLEMENTING (Build Mode)

---

## 1. Available Data Sources

| Data Need | Hook | Data Type | Source |
|-----------|------|-----------|--------|
| Current cycle phase | `useCurrentCycleState()` | `phaseKey`, `phaseEmoji`, `phaseBg`, `phaseDesc`, `cycleDay`, `nextPeriodDays`, `predictedCycleLength` | `hooks/useCurrentCycleState.ts` |
| Mood logs (last 30d) | `useMoodLogs()` | `MoodLog[]` { id, user_id, mood, intensity, notes, logged_at } | `services/queries/wellness.ts` |
| Cycle analytics | `useCycleAnalytics()` | `common_symptoms`, `common_moods`, avg cycle length, total entries | `services/queries/cycle.ts` |
| Wellness insights | `useInsights()` | `total_journal_entries`, `total_mood_logs`, `average_mood_intensity`, `most_common_mood`, `recommendation` | `services/queries/wellness.ts` |
| Predictions | `useCyclePredictions()` | `prediction`, `days_until`, `model_used`, `data_quality` | `services/queries/cycle.ts` |
| Breathing exercises | `useBreathingExercises()` | `BreathingExercise[]` { id, name, duration_seconds, description, technique, audio_url } | `services/queries/wellness.ts` |
| Calendar data | `useCycleCalendar()` | `days` (Record<dateStr, phaseCode>), `predictions` | `services/queries/cycle.ts` |
| Today's day observation | `localDb.day.getByDate(userId, todayDateStr)` | `DailyDay` { mood, mood_intensity, pain_level, energy_level, sleep_minutes, water_glasses, notes, symptoms, medications } | `services/localDb/DayLocalService.ts` |
| Health tips | `wellnessService.getHealthTips(metric_type?, limit?)` | `HealthTipListResponse` — static tips | Backend endpoint `/api/v1/wellness/health-tips` |

### Phase Metadata (`src/utils/cyclePhases.ts`)

| Key | Label | Emoji | Bg | Fg | Accent | Desc |
|-----|-------|-------|----|----|--------|------|
| `menstrual` | Menstrual | 🩸 | #FFE4EC | #B83058 | #FF6B8A | "Rest & restore. Honour your body." |
| `follicular` | Follicular | 🌱 | #FFF4E3 | #A0621A | #F5A623 | "Rising energy. Fresh beginnings." |
| `ovulation` | Ovulation | 🌟 | #E5F9F0 | #1A6B45 | #3CC87A | "Peak vitality. Magnetic energy." |
| `luteal` | Luteal | 🌙 | #EFE8FA | #5A35A0 | #9B6BD4 | "Wind down. Nurture yourself." |
| `fertile` | Fertile | 🌱 | #F3E5F5 | #7B1FA2 | #CE93D8 | "Fertile window. Conception window." |

### Theme Tokens (`src/theme/tokens.ts`)

```ts
primary: '#FF6B8A'        // rose pink
primaryMuted: '#FFE8EF'
primaryLight: '#FFB3C6'
primaryDeep: '#E60039'
accent: '#9B7BFF'        // lavender
accentMuted: '#F0E8FF'
accentLight: '#C4B5FF'
roseQuartz: '#F1B8B8'
mint: '#3CC87A'
mauve: '#A89B9B'
surface: '#FFFFFF'
background: '#FFF8F0'
textPrimary: '#1A1D26'
textMuted: '#7B8194'
```

### Reusable UI Components (`src/components/ui/`)

- `Card` — variants: standard, hero, feature, glass, flat; props: `padded`, `elevated`, `onPress`, `variant`
- `Text` — `variant` (display, h1, h2, h3, body, bodySmall, caption, emoji, etc.) + semantic `color`
- `MoodPicker` — circular mood selection, 6+ predefined moods
- `Calendar` — full interactive calendar with `encodedDays`, `showPhaseLegend`, `phaseAccentForDate`
- `BottomSheet`, `Skeleton`, `HealthMetricCard`, `PredictionDetailCard`

---

## 2. Structural Recommendation: `useWellnessDashboard` Hook

**File:** `src/hooks/useWellnessDashboard.ts`

Aggregates all wellness data for the Insights tab so `WellnessHomeScreen` stays thin and declarative.

```ts
export function useWellnessDashboard() {
  const cycle = useCurrentCycleState();
  const moodLogs = useMoodLogs({ per_page: 30 });
  const insights = useInsights();
  const analytics = useCycleAnalytics();
  const predictions = useCyclePredictions();
  const userId = useAuthStore((s) => s.user?.id);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dayData = userId ? await localDb.day.getByDate(userId, todayStr) : null;
  const healthTips = useHealthTips();

  // Compute derived values
  const readinessScore = computeReadiness(cycle.phaseKey, dayData, moodLogs.data ?? []);
  const phaseRecommendations = filterTipsByPhase(healthTips.data ?? [], cycle.phaseKey, analytics?.common_symptoms);
  const moodInsight = getMoodInsight(moodLogs.data ?? [], cycle.phaseKey, cycle);

  return {
    cycle,
    moodLogs: moodLogs.data ?? [],
    insights: insights.data,
    analytics: analytics.data,
    readinessScore,
    phaseRecommendations,
    moodInsight,
    healthTips: healthTips.data ?? [],
    isLoading: cycle.isLoading || moodLogs.isLoading || insights.isLoading,
    dayData,
  };
}
```

**Why:** Keeps `WellnessHomeScreen` declarative. Makes testing trivial — just mock the hook's return.

---

## 3. Upgrade 1: Insights Tab (The "Dashboard")

### 3.1 Phase-Aware Hero Card

**Component:** `src/components/ui/wellness/PhaseAwareHero.tsx`

```ts
interface PhaseAwareHeroProps {
  cycleState: CurrentCycleState;
}
```

If `hasCycleData`:
- Header: `{phaseEmoji} {phaseLabel} Phase`
- Subheader: `Day {cycleDay} of {predictedCycleLength ?? '...'}`
- Desc: `{phaseDesc}` (e.g., "Peak vitality. Magnetic energy.")

If `!hasCycleData`:
- Header: "🌙 Welcome to Wellness"
- Subheader: "Track your cycle to see phase-aware insights"
- Button: "Start Tracking" → navigates to `LogPeriod`

Background: `LinearGradient` using phase-bg colors at varying opacity.

### 3.2 Phase-Aware Readiness Score

**File:** `src/utils/readinessScore.ts`

**Refinement:** Adjust weights based on cycle phase so the score feels psychic.

```ts
const PHASE_WEIGHTS: Record<string, Record<string, number>> = {
  follicular:  { sleep: 0.2, mood: 0.3, water: 0.2, activity: 0.3 },
  ovulation:   { sleep: 0.2, mood: 0.4, water: 0.2, activity: 0.2 },
  luteal:      { sleep: 0.4, mood: 0.3, water: 0.2, activity: 0.1 },
  menstrual:   { sleep: 0.4, mood: 0.3, water: 0.2, activity: 0.1 },
  fertile:     { sleep: 0.25, mood: 0.35, water: 0.2, activity: 0.2 },
};

export function computeReadiness(
  phaseKey: string,
  dayData: DailyDay | null,
  moodLogs: MoodLog[],
): number | null {
  if (!dayData && moodLogs.length === 0) return null;

  const weights = PHASE_WEIGHTS[phaseKey] ?? PHASE_WEIGHTS.follicular;

  // Sleep score: 0-8h maps to 0-1
  const sleepHours = (dayData?.sleep_minutes ?? 0) / 60;
  const sleepScore = Math.min(sleepHours / 8, 1);

  // Mood score: average intensity / 10
  const recentMoods = moodLogs.slice(-3);
  const moodScore = recentMoods.length > 0
    ? recentMoods.reduce((s, m) => s + m.intensity, 0) / recentMoods.length / 10
    : 0.5;

  // Water score: 0-8 glasses maps to 0-1
  const waterGlasses = dayData?.water_glasses ?? 0;
  const waterScore = Math.min(waterGlasses / 8, 1);

  // Activity score: inverted pain (0 pain -> 1, 10 pain -> 0)
  const painLevel = dayData?.pain_level ?? 0;
  const activityScore = 1 - (painLevel / 10);

  return Math.round(
    ((sleepScore * weights.sleep) +
     (moodScore * weights.mood) +
     (waterScore * weights.water) +
     (activityScore * weights.activity)) * 100
  );
}
```

**Component:** `src/components/ui/wellness/ReadinessScoreCard.tsx`

Large circular progress ring (0-100) in center, phase-accent colored. Below the ring: 4 mini metric cards:
- 🌙 Sleep: `{sleep_minutes / 60}h / 8h`
- 💧 Water: `{water_glasses}/8 glasses`
- 🏃 Activity: `{energy_level}/3`
- 🧘 Stress: `{10 - pain_level}/10`

### 3.3 Phase-Aware Dynamic Recommendations

**File:** `src/utils/filterRecommendations.ts`

**Refinement:** Filter health tips by phase + symptoms + priority.

```ts
// Phase -> health tip metric_type mapping
const PHASE_TIP_MAP: Record<string, string[]> = {
  menstrual: ['period', 'cramps', 'iron', 'sleep', 'stress'],
  follicular: ['energy', 'exercise', 'nutrition'],
  fertile: ['mood', 'nutrition', 'energy'],
  ovulation: ['mood', 'nutrition', 'exercise'],
  luteal: ['sleep', 'stress', 'bloating', 'water'],
};

export function filterTipsByPhase(
  tips: HealthTipResponse[],
  phaseKey: string,
  symptoms?: Array<{ symptom: string; count: number }>,
): HealthTipResponse[] {
  const relevantTypes = PHASE_TIP_MAP[phaseKey] ?? [];

  // Phase-based filter
  let filtered = tips.filter(
    (tip) => relevantTypes.includes(tip.metric_type)
  );

  // Boost symptom-matched tips to the front
  const symptomNames = new Set((symptoms ?? []).map((s) => s.symptom.toLowerCase()));
  if (symptomNames.size > 0) {
    filtered.sort((a, b) => {
      const aMatch = symptomNames.has(a.metric_type) ? -1 : 0;
      const bMatch = symptomNames.has(b.metric_type) ? -1 : 0;
      // Priority 3 first, then symptom match
      if (a.priority !== b.priority) return b.priority - a.priority;
      return bMatch - aMatch;
    });
  }

  return filtered.slice(0, 3);
}
```

**Component:** `src/components/ui/wellness/DynamicRecommendations.tsx`

```ts
interface DynamicRecommendationsProps {
  cycleState: CurrentCycleState;
  insights: WellnessInsights | undefined;
  analytics: CycleAnalytics | undefined;
  healthTips: HealthTipResponse[];
}
```

Each recommendation:
- Icon emoji + description text
- Badge (metric_type capitalized)
- For actionable items: checkbox with "Mark Done" (persisted in Zustand)

### 3.4 Mini Phase Timeline

**Component:** `src/components/ui/wellness/MiniPhaseTimeline.tsx`

```ts
interface MiniPhaseTimelineProps {
  cycleState: CurrentCycleState;
  predictions: PredictionDetail | null;
}

// Shows phases as pills: "Follicular -> Ovulation -> Luteal -> Menstrual"
// Today's phase highlighted with primary accent border + ring shadow
// Uses phase colors from PHASE_META
// Horizontal ScrollView, pills are non-interactive (tap calendar to navigate)
```

### 3.5 Visual Polish

- Gradient overlay on cards: `LinearGradient` from `transparent` to `phaseBg` at 3%
- Elevation: `shadowColor: phaseAccent`, `shadowOpacity: 0.08`, `shadowRadius: 12`
- Hairline borders: `borderColor: theme.colors.border`

### 3.6 Rewrite WellnessHomeScreen

**File:** `mobile/src/screens/wellness/WellnessHomeScreen.tsx`

Use `useWellnessDashboard()` to get all data, then render:
- `PhaseAwareHero` at the top
- `MiniPhaseTimeline` below hero
- `ReadinessScoreCard` as the main hero metric
- `MiniMetricsRow` below the score
- Tabbed section (Insights | Mood | Breathe) — same segmented control as before but with pill slider style
- For **Insights tab** content: `DynamicRecommendations`
- For **Mood tab** content: inline `MoodAreaChart` + `MoodInsightCard`
- For **Breathe tab** content: inline `BreathingExerciseCard` previews

---

## 4. Upgrade 2: Mood Tab (The "Chart")

### 4.1 Smooth Organic Curve Chart

**Component:** `src/components/ui/wellness/MoodAreaChart.tsx`

```ts
interface MoodAreaChartProps {
  moodLogs: MoodLog[];
  phaseColor: string;
  showTooltip?: boolean;
  onPointPress?: (log: MoodLog) => void;
}
```

- Uses `react-native-svg` `Path` with cubic bezier curves for smooth organic line
- Emoji labels at each data point (mapped from `MoodLog.mood` string -> emoji)
- "Today" point highlighted with a ring
- Area fill: gradient from `phaseBg` to transparent
- Line stroke: `phaseAccent` color

### 4.2 Zero-Data Graceful Degradation

**Refinement in `MoodAreaChart.tsx`:**

```ts
// If moodLogs.length < 2:
// Show placeholder state inside the chart area:
//   Emoji: 📊
//   Text: "Mood data is building. Check back in a few days to see your pattern."
//   Subtext: "Log your mood daily for the best insights."
// No SVG path rendered — avoids ugly 1-point chart.
```

### 4.3 Phase-Correlated Mood Insight

**File:** `src/utils/moodInsight.ts`

```ts
export function getMoodInsight(
  moodLogs: MoodLog[],
  phaseKey: string,
  cycleState: CurrentCycleState,
): string | null {
  if (!cycleState.hasCycleData) {
    return "Log moods to see patterns correlated with your cycle.";
  }

  // Filter moodLogs to dates within the current phase
  // This requires calendar data to determine which dates are in the current phase
  const phaseMoods = moodLogs; // simplified — full implementation uses calData

  if (phaseMoods.length >= 3) {
    const mostCommon = getMostCommonMood(phaseMoods);
    return `Your mood is usually ${mostCommon} during ${cycleState.phaseLabel}. Today is cycle day ${cycleState.cycleDay ?? '?'} — this aligns with your pattern!`;
  }

  // Fallback: show phase description
  return cycleState.phaseDesc;
}

function getMostCommonMood(moodLogs: MoodLog[]): string {
  const counts: Record<string, number> = {};
  moodLogs.forEach((m) => {
    counts[m.mood] = (counts[m.mood] ?? 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
}
```

**Component:** `src/components/ui/wellness/MoodInsightCard.tsx`

Renders the insight text with phase-appropriate emoji + background gradient.

### 4.4 Emoji Pills

**Component:** `src/components/ui/wellness/MoodPillList.tsx`

```ts
interface MoodPillListProps {
  moodLogs: MoodLog[];
  phaseAccent: string;
}

// Shows: ✨ Radiant 3x  😊 Happy 2x  😴 Tired 1x
// Each pill: phase-accent background at 15% opacity
// Intensity dots: filled/empty circles based on intensity / 2 (1-10 -> 1-5 dots)
```

### 4.5 Quick-Log Floating Button

**Component:** `src/components/ui/wellness/FloatingActionButton.tsx`

```ts
interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: string;
  label?: string;
}

// Circular button with primary gradient background
// Gentle pulse animation on mount (useSharedValue + withTiming)
// Haptic feedback on press (expo-haptics)
// Fixed position at bottom-right of MoodHistoryScreen
```

### 4.6 Rewrite MoodHistoryScreen

- Use `useMoodLogs()` instead of raw `wellnessService.getMoodLogs()`
- Replace bar chart with `MoodAreaChart`
- Add `MoodInsightCard` below chart
- Add `MoodPillList` below insight
- Add `FloatingActionButton` for quick logging
- Mood logs sorted descending by `logged_at` (already handled by `mergeMoodLogs`)

---

## 5. Upgrade 3: Breathe Tab (The "Exercises")

### 5.1 Immersive Exercise Cards

**Component:** `src/components/ui/wellness/BreathingExerciseCard.tsx`

```ts
interface BreathingExerciseCardProps {
  exercise: BreathingExercise;
  cycleState: CurrentCycleState;
  onPress: (exercise: BreathingExercise) => void;
}

// Color-coded by technique (from exercise.instructions.technique):
//   "box" -> Blue gradient (#E0F4FF -> #BBF4FF)
//   "deep" -> Purple gradient (#F0E8FF -> #E8DAFF)
//   "calm" -> Green gradient (#E6FFFA -> #BFFCC6)
//   default -> phase-accent tinted
//
// Background pattern: subtle SVG wave (for box) or leaf (for calm)
// Duration badge with hourglass icon
// Phase recommendation badge below title (PhaseRecommendationBadge.tsx)
```

### 5.2 Expanding Live Animation Modal

**Component:** `src/components/ui/wellness/BreathingExerciseModal.tsx`

```ts
interface BreathingExerciseModalProps {
  exercise: BreathingExercise;
  visible: boolean;
  onClose: () => void;
}

// Full-screen modal that fades in + scales up from card
// Large breathing circle with scale animation (Reanimated 3)
// Phase labels (inhale / hold / exhale / rest) with emoji visualization
// Progress ring that fills over duration (react-native-svg Circle stroke-dasharray)
// Haptic feedback synced to rhythm:
//   Inhale (4s): scale(1.3), haptic ImpactFeedbackStyle.Light
//   Hold (4s): scale(1.3)
//   Exhale (4s): scale(0.8), haptic
//   Rest (4s): scale(1.0) gentle pulse
// Close button + sound toggle (muted / unmuted)
```

### 5.3 Phase Recommendation Badge

**Component:** `src/components/ui/wellness/PhaseRecommendationBadge.tsx`

```ts
interface PhaseRecommendationBadgeProps {
  cycleState: CurrentCycleState;
}

// Renders:
// "🌅 Best for your Follicular phase — rising energy"
// "🌙 Deep relaxation during your Luteal phase"
// Color: phase-bg / phase-fg
```

### 5.4 Rewrite BreathingListScreen

- Use `useBreathingExercises()` (already returns real data from backend)
- Each exercise rendered as `BreathingExerciseCard` with phase recommendation
- Tap card -> opens `BreathingExerciseModal`
- Modal has close button that returns to list
- Phase recommendation shown via `PhaseRecommendationBadge` below each card

---

## 6. Micro-Interactions (The "Polish" Layer)

| Element | Upgrade | Implementation |
|---------|---------|----------------|
| Segmented Control | Pill-style slider with smooth sliding bg | `Animated.View` under active tab in `WellnessHomeScreen` |
| Mood Chart Taps | Tooltip: mood + intensity + notes | `MoodTooltip.tsx` — absolutely positioned near tap point |
| Breathing Haptics | Light haptic on inhale/exhale | `expo-haptics` — `ImpactFeedbackStyle.Light` |
| Mark Done Haptics | Haptic "nudge" on checkbox tap | `expo-haptics` — `NotificationFeedbackType.Success` |
| Empty States | Gentle illustration + text | "Mood data is building..." / "No tips yet. Track your cycle!" |
| Readiness Tap | Tap score -> expand to show breakdown | Touchable card that expands to show formula components |

---

## 7. Files to Create

### Hooks (1 file)
| File | Purpose |
|------|---------|
| `mobile/src/hooks/useWellnessDashboard.ts` | Aggregates all wellness data + derived values |
| `mobile/src/hooks/useHealthTips.ts` | React Query hook for health tips API |

### Utility Files (3 files)
| File | Purpose |
|------|---------|
| `mobile/src/utils/readinessScore.ts` | Phase-aware readiness formula + weights |
| `mobile/src/utils/filterRecommendations.ts` | Filters health tips by phase + symptoms + priority |
| `mobile/src/utils/moodInsight.ts` | Phase-correlated mood insight computation |

### UI Components (13 files)
| File | Purpose |
|------|---------|
| `mobile/src/components/ui/wellness/PhaseAwareHero.tsx` | Phase-aware hero card |
| `mobile/src/components/ui/wellness/ReadinessScoreCard.tsx` | Readiness score + mini metrics |
| `mobile/src/components/ui/wellness/MiniMetricsRow.tsx` | 4 mini metric cards |
| `mobile/src/components/ui/wellness/DynamicRecommendations.tsx` | Phase-aware recommendations w/ checkboxes |
| `mobile/src/components/ui/wellness/MiniPhaseTimeline.tsx` | Horizontal phase timeline |
| `mobile/src/components/ui/wellness/MoodAreaChart.tsx` | SVG smooth mood curve w/ zero-data handling |
| `mobile/src/components/ui/wellness/MoodInsightCard.tsx` | Phase-correlated mood insight |
| `mobile/src/components/ui/wellness/MoodPillList.tsx` | Emoji pills with intensity dots |
| `mobile/src/components/ui/wellness/FloatingActionButton.tsx` | Quick-log FAB |
| `mobile/src/components/ui/wellness/BreathingExerciseCard.tsx` | Immersive exercise card |
| `mobile/src/components/ui/wellness/BreathingExerciseModal.tsx` | Full-screen breathing modal |
| `mobile/src/components/ui/wellness/PhaseRecommendationBadge.tsx` | Phase-based recommendation |
| `mobile/src/components/ui/wellness/MoodTooltip.tsx` | Tooltip for chart taps |
| `mobile/src/components/ui/wellness/index.ts` | Barrel exports |

### Modified Files (3 screens + 1 API)
| File | Change |
|------|--------|
| `mobile/src/screens/wellness/WellnessHomeScreen.tsx` | Full rewrite with `useWellnessDashboard` + 8 components |
| `mobile/src/screens/wellness/MoodHistoryScreen.tsx` | Rewrite with area chart + pills + FAB |
| `mobile/src/screens/wellness/BreathingListScreen.tsx` | Rewrite with immersive cards + modal |
| `mobile/src/services/api/wellness.ts` | Add `getHealthTips()` method |

---

## 8. Implementation Priority

### Sprint 1 (P0 — Core Infrastructure)
1. Add `getHealthTips` to API client (`mobile/src/services/api/wellness.ts`)
2. Create `useHealthTips` hook
3. Create `src/utils/readinessScore.ts`
4. Create `src/utils/filterRecommendations.ts`
5. Create `src/utils/moodInsight.ts`
6. Create `src/hooks/useWellnessDashboard.ts`

### Sprint 2 (P0 — Insights Tab)
7. Create: `PhaseAwareHero`, `ReadinessScoreCard`, `MiniMetricsRow`
8. Create: `DynamicRecommendations`, `MiniPhaseTimeline`
9. Rewrite `WellnessHomeScreen.tsx`

### Sprint 3 (P0 — Mood Tab)
10. Create: `MoodAreaChart` (with zero-data handling), `MoodInsightCard`, `MoodPillList`, `FloatingActionButton`, `MoodTooltip`
11. Rewrite `MoodHistoryScreen.tsx`

### Sprint 4 (P0 — Breathing Tab)
12. Create: `BreathingExerciseCard`, `BreathingExerciseModal`, `PhaseRecommendationBadge`
13. Rewrite `BreathingListScreen.tsx`

### Sprint 5 (P1 — Polish)
14. Micro-interactions, haptics, empty states
15. Tests for new components and utility functions

---

## 9. Mood Emoji Mapping

`MoodLog.mood` stores mood as a string label. Need to map to emoji for the chart:

```ts
const MOOD_EMOJI_MAP: Record<string, string> = {
  Happy: '😊',
  Calm: '😌',
  Sad: '😢',
  Angry: '😠',
  Anxious: '😰',
  Tired: '😴',
  Loved: '🥰',
  Motivated: '💪',
  Radiant: '✨',
};
```

This mirrors the existing `MOOD_EMOJIS` from `MoodHistoryScreen.tsx` and the mood options in `MoodLogScreen.tsx`.

---

## 10. Gotchas

1. **`localDb.day.getByDate` signature:** Verified as `getByDate(userId: string, dateStr: string)` in `DayLocalService.ts`
2. **`HealthTipResponse` schema:** Currently has `id`, `metric_type`, `tip`, `priority` — no `phase` field. Phase filtering is done client-side.
3. **SVG dependency:** Already used in `MoodLogScreen.tsx` (`react-native-svg` with `Path`, `Circle`, `Defs`, `LinearGradient`, `Stop`)
4. **Haptics:** Already imported in `MoodLogScreen.tsx` (`expo-haptics`)
5. **Gradient:** Already in `WellnessHomeScreen.tsx` and `JournalEntryScreen.tsx` (`expo-linear-gradient`)
6. **Reanimated 3:** Already used throughout `WellnessHomeScreen.tsx` and `BreathingListScreen.tsx`
7. **Test file:** Update `__tests__/wellness.test.ts` to mock new hooks (`useHealthTips`, `useWellnessDashboard`)
8. **`getInsights` is a standalone function** in `wellnessServices.ts` — not the query hook. The query hook `useInsights()` uses `getWellnessKeys(userId)`.
