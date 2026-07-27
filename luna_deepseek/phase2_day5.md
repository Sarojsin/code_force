# Phase 2 Day 5 — EventEngine Health Reactions + Achievement Watcher

## Goal
Add health event reactions to the EventEngine (water, food, exercise, medication), and create the AchievementEngine skeleton with a `queueMicrotask`-based watcher that checks achievements after each event — without blocking the event loop.

---

## 5.1 Add Health Event Reactions to `EVENT_REACTIONS`

**File:** `src/services/companion/EventEngine.ts`

Extend the `EVENT_REACTIONS` map:

```typescript
const EVENT_REACTIONS: Record<string, Reaction> = {
  // ... existing reactions (journal_saved, mood_logged, period_logged, etc.) ...

  water_logged: {
    dialogContext: 'water',
    animation: 'wave',
    durationMs: 3000,
  },
  food_logged: {
    dialogContext: 'food',
    animation: 'happy',
    durationMs: 3000,
  },
  exercise_completed: {
    dialogContext: 'exercise',
    animation: 'celebrate',
    durationMs: 3500,
  },
  medication_logged: {
    dialogContext: 'medication',
    animation: 'happy',
    durationMs: 3000,
  },
};
```

---

## 5.2 Wire Health Events in `handleEvent`

The `handleEvent` function is already synchronous (from Phase 1 fix). Add the achievement check offload at the end:

```typescript
const handleEvent = (eventName: string, payload: any) => {
  const reaction = EVENT_REACTIONS[eventName];
  if (!reaction) {
    return;
  }

  const store = useCompanionStore.getState();
  if (store.isHidden) {
    return;
  }
  if (store.installStatus !== 'ready') {
    return;
  }

  // Award XP/Coins
  const xpAmount = (XP_REWARDS as any)[eventName];
  if (xpAmount) {
    Promise.resolve(store.addXP(xpAmount)).catch(() => {});
  }

  const coinAmount = (COIN_REWARDS as any)[eventName];
  if (coinAmount) {
    Promise.resolve(store.addCoins(coinAmount)).catch(() => {});
  }

  // Resolve animation
  let animation = reaction.animation;
  if (reaction.getMoodContext) {
    const mood = reaction.getMoodContext(payload);
    if (mood && MOOD_ANIMATIONS[mood]) {
      animation = MOOD_ANIMATIONS[mood];
    }
  }

  // Show speech bubble
  const moodContext = reaction.getMoodContext
    ? reaction.getMoodContext(payload)
    : undefined;
  const dialog = dialogueEngine.get(reaction.dialogContext as any, moodContext);
  showBubble(dialog, animation, reaction.durationMs);

  // ── Offload achievement check (non-blocking) ──
  const userId = payload.userId || store.userId;
  if (userId) {
    queueMicrotask(async () => {
      try {
        const newAchievements = await achievementEngine.checkAchievements(
          userId,
          eventName
        );
        for (const achievement of newAchievements) {
          // Persist unlocked achievement
          const existing =
            (store.memory?.achievements as string[]) || [];
          if (!existing.includes(achievement.id)) {
            await store.updateMemory('achievements', [
              ...existing,
              achievement.id,
            ]);
            // Show achievement popup via a dedicated callback
            showAchievementPopup?.(achievement);
          }
        }
      } catch {
        // Silent fail — achievements are non-critical
      }
    });
  }
};
```

**Note:** `showAchievementPopup` is a new optional parameter on `initEventEngine`. We'll define it fully in Day 8.

---

## 5.3 Create `src/services/companion/AchievementEngine.ts` (Skeleton)

```typescript
import { healthMetricsLocalService } from '../localDb';
import { companionStore } from '../../stores/companionStore';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (metrics: UserMetrics) => boolean;
}

export interface UserMetrics {
  sleepStreak: number;
  waterStreak: number;
  foodStreak: number;
  exerciseStreak: number;
  medicationStreak: number;
}

export const ACHIEVEMENTS: Achievement[] = [
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
  {
    id: 'hydration_hero_5',
    name: 'Hydration Hero 💧',
    description: 'Drink 2L+ water for 5 consecutive days',
    icon: '💧',
    condition: (u) => u.waterStreak >= 5,
  },
  {
    id: 'hydration_hero_30',
    name: 'Hydration Master 🏆',
    description: 'Drink 2L+ water for 30 consecutive days',
    icon: '🏆',
    condition: (u) => u.waterStreak >= 30,
  },
  {
    id: 'meal_tracker_10',
    name: 'Meal Tracker 🥗',
    description: 'Log 3 meals/day for 10 consecutive days',
    icon: '🥗',
    condition: (u) => u.foodStreak >= 10,
  },
  {
    id: 'movement_star_5',
    name: 'Movement Star 💪',
    description: 'Log exercise for 5 consecutive days',
    icon: '💪',
    condition: (u) => u.exerciseStreak >= 5,
  },
  {
    id: 'health_explorer_7',
    name: 'Health Explorer 📊',
    description: 'Log all 5 metrics for 7 consecutive days',
    icon: '📊',
    condition: (u) =>
      u.sleepStreak >= 7 &&
      u.waterStreak >= 7 &&
      u.foodStreak >= 7 &&
      u.exerciseStreak >= 7 &&
      u.medicationStreak >= 7,
  },
];

class AchievementEngine {
  async checkAchievements(
    userId: string,
    _triggerEvent?: string
  ): Promise<Achievement[]> {
    const metrics = await this.getUserMetrics(userId);
    const unlocked: Achievement[] = [];
    const store = companionStore.getState?.();
    const existingAchievements: string[] =
      (store?.memory?.achievements as string[]) || [];

    for (const achievement of ACHIEVEMENTS) {
      if (existingAchievements.includes(achievement.id)) continue; // already unlocked
      if (achievement.condition(metrics)) {
        unlocked.push(achievement);
      }
    }
    return unlocked;
  }

  private async getUserMetrics(userId: string): Promise<UserMetrics> {
    const [sleepStreak, waterStreak, foodStreak, exerciseStreak, medicationStreak] =
      await Promise.all([
        healthMetricsLocalService.getStreak(userId, 'sleep'),
        healthMetricsLocalService.getStreak(userId, 'water'),
        healthMetricsLocalService.getStreak(userId, 'food'),
        healthMetricsLocalService.getStreak(userId, 'exercise'),
        healthMetricsLocalService.getStreak(userId, 'medication'),
      ]);
    return {
      sleepStreak,
      waterStreak,
      foodStreak,
      exerciseStreak,
      medicationStreak,
    };
  }
}

export const achievementEngine = new AchievementEngine();
```

---

## 5.4 Update `initEventEngine` Signature

**File:** `src/services/companion/EventEngine.ts`

Add the optional `showAchievementPopup` callback parameter:

```typescript
export function initEventEngine(
  showBubble: (text: string, animation: AnimationState, durationMs: number) => void,
  showAchievementPopup?: (achievement: Achievement) => void
): () => void {
  // ... existing code ...
}
```

Update the barrel export in `src/services/companion/index.ts`:

```typescript
export { initEventEngine, useSpeechBubble } from './EventEngine';
export { achievementEngine, ACHIEVEMENTS } from './AchievementEngine';
export type { Achievement } from './AchievementEngine';
```

---

## 5.5 Validation

- [ ] New health reactions added to `EVENT_REACTIONS` map
- [ ] `handleEvent` awards XP/coins and shows bubble for health events
- [ ] Achievement check runs via `queueMicrotask` (does not block render)
- [ ] `AchievementEngine.checkAchievements()` returns only NEWLY unlocked achievements (not previously unlocked)
- [ ] Already-unlocked achievements are skipped
- [ ] `initEventEngine` accepts optional `showAchievementPopup`
- [ ] Barrel exports the new types
- [ ] `tsc --noEmit` passes with 0 new errors
