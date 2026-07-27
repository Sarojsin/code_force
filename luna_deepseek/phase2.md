# Phase 2 — Luna Companion Cat: Complete Implementation Plan

## Objective

Transform Luna's Pet House into a Health Companion Hub—a functional health dashboard where users log sleep, food, water, exercise, and medication. Replace the cosmetic Outfit Shop with an Achievement System that rewards real health habits. Keep all other Phase 2 features (Quotes, Sounds, Emotion System, Recommendations).

---

## Phase 2 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     LUNA PHASE 2 ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Health Hub  │    │  Achievement │    │  Emotion     │      │
│  │  Dashboard   │───▶│  System      │───▶│  System      │      │
│  │  (Pet House) │    │  (Badges)    │    │  (Mood Mgr)  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Health      │    │  Dialogue    │    │  Sound       │      │
│  │  Metrics     │───▶│  Engine      │───▶│  Effects     │      │
│  │  (SQLite)    │    │  (Quotes)    │    │  (expo-av)   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Recommendation Engine (Backend API for health articles) │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Cloud Backup (Phase 3 — Manual Export/Import)          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 2 Features (Priority Order)

| # | Feature | Effort | Dependencies | Health Value |
|---|---------|--------|--------------|--------------|
| 1 | 200+ Quotes | 1 day | None | Low (but high engagement) |
| 2 | Sound Effects | 2 days | expo-av | Low |
| 3 | Emotion System | 3 days | None | Medium |
| 4 | Health Companion Hub | 5 days | None | High |
| 5 | Achievement System | 3 days | Health Hub | High |
| 6 | Recommendation Engine | 4 days | Backend endpoint | High |
| 7 | Cloud Backup | Defer to Phase 3 | All | Medium |

**Total Phase 2 Effort:** ~18 days (excluding Cloud Backup)

---

## Priority 1: 200+ Quotes (1 day)

### Objective

Expand `dialogues.json` from ~80 to 200+ entries. No code changes—just data.

### Files to Modify

| File | Change |
|------|--------|
| `assets/companion/dialogues.json` | Add new quotes across all categories |

### New Quote Categories to Add

| Category | Context | Example |
|----------|---------|---------|
| `health_sleep` | After logging sleep | "Sleep is your superpower! 😴" |
| `health_water` | After logging water | "Your cells are thanking you! 💧" |
| `health_food` | After logging a meal | "Nourishing your body! 🥗" |
| `health_exercise` | After logging exercise | "Your future self thanks you! 💪" |
| `health_medication` | After logging medication | "Taking care of yourself! 🌸" |
| `health_streak` | When achieving a streak | "You're on fire! Keep going! 🔥" |
| `health_milestone` | Unlocking an achievement | "You earned this! 🏆" |

### Dialogue Engine Update

```typescript
// In DialogueEngine.ts — add new context resolution
const HEALTH_CONTEXTS = ['sleep', 'water', 'food', 'exercise', 'medication'];

get(context: string): string {
  // If context is a health metric, use health_ prefix
  if (HEALTH_CONTEXTS.includes(context)) {
    const healthKey = `health_${context}`;
    const pool = this.dialogues[healthKey];
    if (pool && pool.length > 0) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }
  // ... existing logic
}
```

---

## Priority 2: Sound Effects (2 days)

### Objective

Add meows, purrs, and other sounds to Luna's animations.

### Dependencies

```bash
npx expo install expo-av
```

### Files to Create/Modify

| File | Change |
|------|--------|
| `assets/companion/sounds/meow.mp3` | New asset |
| `assets/companion/sounds/purr.mp3` | New asset |
| `assets/companion/sounds/yawn.mp3` | New asset |
| `assets/companion/sounds/celebrate.mp3` | New asset |
| `services/companion/SoundEngine.ts` | NEW |
| `services/companion/AnimationEngine.ts` | Integrate sound triggers |

### SoundEngine Implementation

```typescript
// src/services/companion/SoundEngine.ts
import { Audio } from 'expo-av';
import { SOUNDS_DIR } from './assetPaths';
import { useCompanionStore } from '../../stores/companionStore';

type SoundName = 'meow' | 'purr' | 'yawn' | 'celebrate';

const SOUND_MAP: Record<SoundName, string> = {
  meow: 'meow.mp3',
  purr: 'purr.mp3',
  yawn: 'yawn.mp3',
  celebrate: 'celebrate.mp3',
};

const ANIMATION_SOUND_MAP: Record<string, SoundName> = {
  happy: 'meow',
  pet: 'purr',
  sleep: 'yawn',
  celebrate: 'celebrate',
};

class SoundEngine {
  private sounds: Map<string, Audio.Sound> = new Map();
  private loaded = false;

  async loadAssets(): Promise<void> {
    if (this.loaded) return;
    for (const [key, filename] of Object.entries(SOUND_MAP)) {
      const sound = new Audio.Sound();
      try {
        await sound.loadAsync({ uri: SOUNDS_DIR + filename });
        this.sounds.set(key, sound);
      } catch {
        // Silent fail — sounds are optional
      }
    }
    this.loaded = true;
  }

  async playForAnimation(animationState: string): Promise<void> {
    const mute = useCompanionStore.getState().muteSounds;
    if (mute) return;

    const soundName = ANIMATION_SOUND_MAP[animationState];
    if (!soundName) return;

    const sound = this.sounds.get(soundName);
    if (!sound) return;

    try {
      await sound.replayAsync();
    } catch {
      // Silent fail
    }
  }
}

export const soundEngine = new SoundEngine();
```

### AnimationEngine Integration

```typescript
// Inside AnimationEngine.ts, add to play function:
if (!reduceAnimations && !muteSounds) {
  soundEngine.playForAnimation(state);
}
```

---

## Priority 3: Emotion System (3 days)

### Objective

Track user's mood trend over time and adjust Luna's behavior accordingly.

### Files to Create

| File | Purpose |
|------|---------|
| `services/companion/MoodManager.ts` | State machine for mood tracking |
| `services/companion/EmotionEngine.ts` | Bridges EventEngine → AnimationEngine |

### MoodManager Implementation

```typescript
// src/services/companion/MoodManager.ts
type Mood = 'happy' | 'sad' | 'anxious' | 'angry' | 'neutral';
type MoodTrend = 'improving' | 'declining' | 'stable' | 'volatile';

const MOOD_SCORES: Record<Mood, number> = {
  happy: 10,
  neutral: 5,
  sad: 2,
  anxious: 3,
  angry: 1,
};

class MoodManager {
  private history: Mood[] = [];
  private maxHistory = 5;

  addMood(mood: Mood): MoodTrend {
    this.history.push(mood);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    if (this.history.length < 3) return 'stable';

    // Calculate trend
    const scores = this.history.map(m => MOOD_SCORES[m]);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const first = scores[0];
    const last = scores[scores.length - 1];

    if (last > first) return 'improving';
    if (last < first) return 'declining';
    return 'stable';
  }

  getRecommendation(mood: Mood): string | null {
    switch (mood) {
      case 'sad':
        return "I'm here for you. Let's take a moment together.";
      case 'anxious':
        return "Let's take a deep breath. In... and out...";
      case 'angry':
        return "It's okay to feel angry. Let's walk it off.";
      default:
        return null;
    }
  }
}

export const moodManager = new MoodManager();
```

### EmotionEngine Integration

```typescript
// In EventEngine.ts — after processing mood_logged event:
const mood = payload.mood as Mood;
const trend = moodManager.addMood(mood);
const recommendation = moodManager.getRecommendation(mood);

if (recommendation) {
  showBubble(recommendation, trend === 'declining' ? 'sad' : 'happy', 3500);
}
```

---

## Priority 4: Health Companion Hub (5 days)

### Objective

Transform the Pet House into a functional health dashboard where users log sleep, food, water, exercise, and medication.

### Files to Create

| File | Purpose |
|------|---------|
| `screens/companion/HealthHubScreen.tsx` | Main dashboard screen |
| `components/ui/HealthMetricCard.tsx` | Circular metric card |
| `components/ui/StreakBadge.tsx` | Streak indicator |
| `services/localDb/HealthMetricsLocalService.ts` | SQLite CRUD for metrics |
| `stores/healthMetricsStore.ts` | Zustand store for metrics |

### Database Schema

```sql
-- Add to src/db/schema.ts
export const healthMetrics = sqliteTable('health_metrics', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  metric_type: text('metric_type', {
    enum: ['sleep', 'water', 'food', 'exercise', 'medication']
  }).notNull(),
  value: text('value'),                 // JSON payload
  logged_at: text('logged_at').notNull(),
  created_at: text('created_at').default(sql`(datetime('now'))`),
});

export type HealthMetric = typeof healthMetrics.$inferSelect;
export type NewHealthMetric = typeof healthMetrics.$inferInsert;
```

### HealthHubScreen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ 🌸 Luna's Health Hub                                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Luna says: "Good morning! Let's start the day right! 🌸" ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐        │
│  │ 🛏️    │  │ 🍽️    │  │ 💧    │  │ 🏋️    │  │ 💊    │        │
│  │ Sleep  │  │ Food   │  │ Water │  │ Exer. │  │ Med.  │        │
│  │ 7.5h   │  │ 3/3    │  │ 1.8L  │  │ 25min │  │ ✅    │        │
│  │ [Log]  │  │ [Log]  │  │ [Log] │  │ [Log] │  │ [Log] │        │
│  └───────┘  └───────┘  └───────┘  └───────┘  └───────┘        │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 📊 Today's Progress                                         ││
│  │ ████████░░░░░░░░ 70% complete                               ││
│  │ Sleep ✅  Water 🔲  Food ✅  Exercise 🔲  Med 🔲           ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🏆 Achievements                                             ││
│  │ 🌟 Sleep Streak (7 days)   💧 Hydration Hero (5 days)     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 💡 Health Tip                                               ││
│  │ "Drinking water before meals can help with digestion."      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### HealthMetricCard Component

```tsx
interface HealthMetricCardProps {
  icon: string;
  label: string;
  value: string;
  target: string;
  onPress: () => void;
}

function HealthMetricCard({ icon, label, value, target, onPress }: HealthMetricCardProps) {
  const progress = calculateProgress(value, target);
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.target}>Target: {target}</Text>
      <ProgressBar progress={progress} style={styles.progress} />
    </Pressable>
  );
}
```

### HealthMetricsLocalService

```typescript
// src/services/localDb/HealthMetricsLocalService.ts
import { BaseLocalService } from './BaseLocalService';
import { healthMetrics } from '../../db/schema';
import type { HealthMetric, NewHealthMetric } from '../../db/schema';

export class HealthMetricsLocalService extends BaseLocalService<HealthMetric> {
  protected table = healthMetrics;
  protected tableName = 'health_metrics';

  async getToday(userId: string): Promise<HealthMetric[]> {
    const today = new Date().toISOString().split('T')[0];
    try {
      const db = getDb();
      return db
        .select()
        .from(healthMetrics)
        .where(and(
          eq(healthMetrics.user_id, userId),
          sql`date(${healthMetrics.logged_at}) = ${today}`
        ))
        .orderBy(desc(healthMetrics.logged_at));
    } catch (error) {
      this.handleError('getToday', error);
      return [];
    }
  }

  async logMetric(userId: string, type: string, value: any): Promise<void> {
    try {
      const db = getDb();
      await db.insert(healthMetrics).values({
        id: crypto.randomUUID(),
        user_id: userId,
        metric_type: type,
        value: JSON.stringify(value),
        logged_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
      eventBus.emit(`${type}_logged`, { userId, ...value });
    } catch (error) {
      this.handleError('logMetric', error);
    }
  }

  async getStreak(userId: string, metricType: string): Promise<number> {
    // Count consecutive days the metric was logged
    try {
      const db = getDb();
      const rows = await db
        .select({ logged_at: healthMetrics.logged_at })
        .from(healthMetrics)
        .where(and(
          eq(healthMetrics.user_id, userId),
          eq(healthMetrics.metric_type, metricType)
        ))
        .orderBy(desc(healthMetrics.logged_at));

      // Calculate streak
      let streak = 0;
      let currentDate = new Date();
      for (const row of rows) {
        const rowDate = new Date(row.logged_at);
        if (rowDate.toDateString() === currentDate.toDateString()) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }
      return streak;
    } catch {
      return 0;
    }
  }
}
```

### Event Bus Integration

Add new events to `eventBus.ts`:

```typescript
// In EventMap
sleep_logged: { userId: string; hours: number; quality: 1-5 };
water_logged: { userId: string; amount: number };
food_logged: { userId: string; mealType: string; notes?: string };
exercise_logged: { userId: string; type: string; duration: number };
medication_logged: { userId: string; name: string; taken: boolean };
```

---

## Priority 5: Achievement System (3 days)

### Objective

Reward users with badges for consistent health habits.

### Files to Create

| File | Purpose |
|------|---------|
| `services/companion/AchievementEngine.ts` | Streak/milestone detection |
| `components/ui/AchievementBadge.tsx` | Badge display |

### Achievement Definitions

```typescript
// src/services/companion/AchievementEngine.ts
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (user: UserMetrics) => boolean;
}

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'sleep_streak_7',
    name: 'Sleep Streak 🌙',
    description: 'Log sleep for 7 consecutive days',
    icon: '🌙',
    condition: (u) => u.sleepStreak >= 7,
  },
  {
    id: 'sleep_streak_30',
    name: 'Sleep Master 🌟',
    description: 'Log sleep for 30 consecutive days',
    icon: '🌟',
    condition: (u) => u.sleepStreak >= 30,
  },
  // ... 10+ achievements
];

class AchievementEngine {
  async checkAchievements(userId: string): Promise<Achievement[]> {
    const unlocked = [];
    const userMetrics = await this.getUserMetrics(userId);
    for (const achievement of ACHIEVEMENTS) {
      if (achievement.condition(userMetrics)) {
        unlocked.push(achievement);
      }
    }
    return unlocked;
  }

  private async getUserMetrics(userId: string): Promise<UserMetrics> {
    const sleepStreak = await healthMetricsService.getStreak(userId, 'sleep');
    // ... other metrics
    return { sleepStreak, waterStreak, foodStreak, exerciseStreak, medicationStreak };
  }
}
```

### Achievement Unlock Flow

When a user logs a metric, check if any achievements are unlocked:

```typescript
// In EventEngine.ts — after any health log event:
const newAchievements = await achievementEngine.checkAchievements(userId);
for (const achievement of newAchievements) {
  // Show popup: "🏆 Achievement Unlocked: Sleep Streak!"
  showBubble(`You earned: ${achievement.name}! 🏆`, 'celebrate', 4000);
  // Store as unlocked (in companionMetadata.memory.achievements)
  await companionStore.updateMemory('achievements', [
    ...existingAchievements,
    achievement.id,
  ]);
}
```

---

## Priority 6: Recommendation Engine (4 days)

### Objective

Provide health tips based on user's logged metrics.

### Backend Endpoint

```python
# backend/app/modules/wellness/routes.py
@router.get("/health-tips")
async def get_health_tips(
    user_id: UUID,
    metric_type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    tips = await wellness_service.get_health_tips(db, user_id, metric_type)
    return {"data": tips}
```

### Mobile Integration

```typescript
// src/services/healthTips.ts
async function getHealthTip(metricType: string): Promise<string | null> {
  try {
    const response = await apiClient.get(`/wellness/health-tips?metric_type=${metricType}`);
    return response.data.data[0]?.tip ?? null;
  } catch {
    return null; // Offline fallback
  }
}
```

### Offline Fallback

```typescript
// Built-in fallback tips (bundled in the app)
const FALLBACK_TIPS: Record<string, string[]> = {
  sleep: [
    "Consistent sleep schedule improves your cycle.",
    "Blue light before bed disrupts melatonin.",
  ],
  water: [
    "Water helps reduce menstrual bloating.",
    "Staying hydrated reduces fatigue.",
  ],
  // ...
};
```

---

## Priority 7: Cloud Backup (Deferred to Phase 3)

### Phase 3 — Manual Export/Import

| Feature | Description |
|---------|-------------|
| Export | Generate JSON file of all Luna data (XP, coins, levels, outfits, achievements). |
| Import | User selects the JSON file → app restores Luna data. |

No automatic sync. Users must manually export/import.

---

## Validation Checklist (Phase 2)

- [ ] 200+ quotes in `dialogues.json`
- [ ] Sound effects play on animations (meow, purr, yawn, celebrate)
- [ ] `muteSounds` toggle disables all sounds
- [ ] `MoodManager` tracks mood trend (improving/declining/stable)
- [ ] Luna's behavior adapts to mood trend
- [ ] Health Hub dashboard shows all 5 metrics (sleep, food, water, exercise, medication)
- [ ] Each metric card logs data and updates display
- [ ] Progress bar shows today's completion (X/5 metrics logged)
- [ ] Streak tracking works across app restarts
- [ ] Achievements unlock at correct thresholds
- [ ] Achievement popup appears when unlocked
- [ ] Achievements persist in SQLite
- [ ] Health tips appear in the hub (with offline fallback)
- [ ] All events trigger Luna reactions (speech + animation)
- [ ] App builds without TypeScript errors
- [ ] Tests pass for all new services

---

## Files Created/Modified Summary (Phase 2)

### New Files

```
mobile/src/
  screens/companion/HealthHubScreen.tsx
  components/ui/HealthMetricCard.tsx
  components/ui/StreakBadge.tsx
  components/ui/AchievementBadge.tsx
  services/companion/SoundEngine.ts
  services/companion/MoodManager.ts
  services/companion/AchievementEngine.ts
  services/localDb/HealthMetricsLocalService.ts
  stores/healthMetricsStore.ts
  assets/companion/sounds/*.mp3
  assets/companion/health_tips_fallback.json
  __tests__/healthMetricsStore.test.ts
  __tests__/AchievementEngine.test.ts
```

### Modified Files

```
mobile/src/
  db/schema.ts                         + healthMetrics table
  services/eventBus.ts                 + new health event types
  services/companion/AnimationEngine.ts + sound triggers
  services/companion/EventEngine.ts    + health reactions + achievements
  services/companion/DialogueEngine.ts + health contexts
  stores/companionStore.ts             + achievements storage
  app/App.tsx                          + healthMetrics hydration
  navigation/MainTabs.tsx              + Health Hub tab
```

---

## Phase 2 Summary

| Priority | Feature | Status |
|----------|---------|--------|
| 1 | 200+ Quotes | ✅ Planned |
| 2 | Sound Effects | ✅ Planned |
| 3 | Emotion System | ✅ Planned |
| 4 | Health Companion Hub | ✅ Planned |
| 5 | Achievement System | ✅ Planned |
| 6 | Recommendation Engine | ✅ Planned |
| 7 | Cloud Backup | ⏳ Deferred to Phase 3 |

---

## Redesigning Luna's Pet House — Health Companion Hub 🌸

You are absolutely right. The Outfit Shop is pure gamification fluff. It adds no health value. The Pet House, however, has massive potential if we reorient it as a Health Dashboard, not a virtual pet house.

Here is the redesigned Pet House — a functional health companion hub that drives real behavior change.

### The New Vision: Health Companion Hub

Instead of a "house" with a bed and food bowl, Luna's screen becomes a daily health command center. Each interactive element maps directly to a health metric:

| Interactive Element | Health Action | Data Tracked | Offline? |
|---------------------|---------------|--------------|----------|
| Sleep Log (Bed) | User taps to log sleep hours. | Sleep start/end, quality rating. | ✅ Yes |
| Meal Log (Food Bowl) | User logs meals (breakfast, lunch, dinner, snacks). | Meal times, food notes, hunger cues. | ✅ Yes |
| Hydration Log (Water Bowl) | User logs water intake (tap to add 250ml). | Total water consumed, hydration streaks. | ✅ Yes |
| Exercise Log (Toy Box) | User logs exercise (type, duration). | Exercise minutes, type trends. | ✅ Yes |
| Medication/Supplement Reminder (Medicine Cabinet) | User logs when they take supplements/medication. | Adherence streaks. | ✅ Yes |

### Why This Works

| Old Pet House (Gimmick) | New Health Companion Hub (Functional) |
|-------------------------|---------------------------------------|
| Click bed → Luna sleeps (cute but useless). | Click bed → Sleep logging + Luna says "Sleep is important!" |
| Click food bowl → Luna eats (cosmetic). | Click food bowl → Meal logging + Luna says "Nutrition matters!" |
| Outfit Shop → Buy hats (zero health value). | Removed entirely. Focus on health metrics. |
| Toy Box → Luna plays (cute). | Toy Box → Exercise logging + Luna cheers "You moved!" |

### What the Outfit Shop Becomes — "Achievement Unlocks"

Instead of a store, Luna has a "Milestone Wall" where users unlock achievements based on their health progress:

| Achievement | Unlock Condition |
|-------------|-----------------|
| 🌟 Sleep Streak | Log sleep for 7 consecutive days. |
| 🌟 Sleep Streak (30 days) | Log sleep for 30 consecutive days. |
| 💧 Hydration Hero | Drink 2L+ water for 5 consecutive days. |
| 🏆 Hydration Hero (30 days) | Drink 2L+ water for 30 consecutive days. |
| 🥗 Meal Tracker | Log 3 meals/day for 10 consecutive days. |
| 💪 Movement Star | Log exercise for 5 days. |
| 📊 Health Explorer | Log all 5 metrics for 7 consecutive days. |

These are pure achievements — no store, no coins, no "buying" hats. Just visual recognition of health progress.

### The User Experience — Daily Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│ 🌸 Luna's Health Hub                                        │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ 🛏️      │  │ 🍽️      │  │ 💧      │  │ 🏋️      │       │
│  │ Sleep   │  │ Food    │  │ Water   │  │ Exercise│       │
│  │ 7.5 hrs │  │ 3 meals │  │ 1.8 L   │  │ 25 min  │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Luna says: "You logged 7.5 hours of sleep! Good job! 😴"││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Today's Goal: Drink 2L water (You're at 1.8L)          ││
│  │ [Log now]                                                ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ 🏆 Milestones Unlocked                                  ││
│  │ 🌟 Sleep Streak (7 days)   💧 Hydration Hero (5 days)  ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### Implementation Changes (Phase 2 Reframed)

| Original Phase 2 Feature | Revised Feature | Status |
|---------------------------|-----------------|--------|
| Pet House Screen | Health Companion Hub | ✅ Redesigned |
| Outfit Shop | Removed (Achievement system instead) | ❌ Deleted |
| 200+ Quotes | Keep (already part of DialogueEngine) | ✅ |
| Sound Effects | Keep — meows for encouragement | ✅ |
| Emotion System | Keep — Luna reacts to mood | ✅ |
| Recommendation Engine | Keep — health tips based on metrics | ✅ |
| Cloud Backup | Defer to Phase 3 (manual export) | ⏳ |

### The "Outfit Shop" Replacement — Achievement Badges

| Badge | Icon | How to Unlock |
|-------|------|---------------|
| Sleep Streak (7 days) | 🌙 | Log sleep for 7 consecutive days. |
| Sleep Streak (30 days) | 🌟 | Log sleep for 30 consecutive days. |
| Hydration Hero (5 days) | 💧 | Drink 2L+ water for 5 consecutive days. |
| Hydration Hero (30 days) | 🏆 | Drink 2L+ water for 30 consecutive days. |
| Meal Tracker (10 days) | 🥗 | Log 3 meals/day for 10 consecutive days. |
| Exercise (5 days) | 💪 | Log exercise for 5 days. |
| Health Explorer | 📊 | Log all 5 metrics for 7 consecutive days. |

These are pure achievements — no store, no coins, no "buying" hats. Just visual recognition of health progress.

---

## Why This Redesign is Superior

| Aspect | Old Outfit Shop | New Achievement System |
|--------|-----------------|------------------------|
| Health Value | 0% | 100% (rewards real health habits). |
| User Motivation | "Buy cute cat hat." | "Log sleep to get the 🌟 badge." |
| Data Tracking | None (cosmetic). | All metrics are tracked → feeds into recommendations. |
| Luna's Role | Passive (you dress her). | Active (she celebrates your achievements). |
| Complexity | Asset variant system (complex). | Simple SQLite badge tracking (easy). |

---

## Summary

| Decision | Rationale |
|----------|-----------|
| ✅ Keep Pet House → Rename to Health Companion Hub. | Functional health dashboard, not a cosmetic pet house. |
| ❌ Remove Outfit Shop entirely. | Zero health value; replaced by achievement badges. |
| ✅ Add Achievement System. | Tracks health habits, not consumption. |
| ✅ Keep all other Phase 2 features. | Quotes, sounds, emotion, recommendations, cloud backup (deferred). |

**Proceed with this redesign.** It aligns perfectly with SheCare's mission: health tracking, not cosmetic fluff. 🚀🌸🐱
