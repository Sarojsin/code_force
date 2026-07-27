# Phase 2 Day 9 — Emotion System: MoodManager + EmotionEngine

## Goal
Build the `MoodManager` (trend tracking over last 5 moods) and `EmotionEngine` (bridges mood context to animation selection). Luna's behavior adapts to whether the user's mood is improving, declining, stable, or volatile.

---

## 9.1 Create `src/constants/companion.ts`

```typescript
/** Threshold for mood volatility detection (higher = less sensitive) */
export const VOLATILITY_THRESHOLD = 3.5;
```

## 9.2 Create `src/services/companion/MoodManager.ts`

**User-scoped design:** Instead of a singleton, `MoodManager` accepts initial history from `companionStore.memory.moodHistory`. This isolates mood data per user and persists across restarts.

```typescript
import { VOLATILITY_THRESHOLD } from '../../constants/companion';

export type Mood = 'happy' | 'sad' | 'anxious' | 'angry' | 'neutral';
export type MoodTrend = 'improving' | 'declining' | 'stable' | 'volatile';

const MOOD_SCORES: Record<Mood, number> = {
  happy: 10,
  neutral: 5,
  sad: 2,
  anxious: 3,
  angry: 1,
};

export class MoodManager {
  private history: Mood[] = [];
  private maxHistory = 5;

  constructor(initialHistory: Mood[] = []) {
    // Take the last maxHistory entries from persisted history
    this.history = initialHistory.slice(-this.maxHistory);
  }

  /**
   * Add a mood entry and return the current trend.
   */
  addMood(mood: Mood): MoodTrend {
    this.history.push(mood);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    if (this.history.length < 3) return 'stable';

    const scores = this.history.map((m) => MOOD_SCORES[m]);
    const avg =
      scores.reduce((a, b) => a + b, 0) / scores.length;
    const first = scores[0];
    const last = scores[scores.length - 1];

    // Check for volatility (large swings)
    const variance =
      scores.reduce((sum, s) => sum + Math.abs(s - avg), 0) / scores.length;
    if (variance > VOLATILITY_THRESHOLD) return 'volatile';

    if (last > first + 2) return 'improving';
    if (last < first - 2) return 'declining';
    return 'stable';
  }

  /**
   * Get a recommendation message based on the current mood.
   */
  getRecommendation(mood: Mood): string | null {
    switch (mood) {
      case 'sad':
        return "I'm here for you. Let's take a moment together 🌸";
      case 'anxious':
        return "Let's take a deep breath. In... and out... 🌬️";
      case 'angry':
        return "It's okay to feel angry. Let's walk it off 🚶‍♀️";
      default:
        return null;
    }
  }

  /**
   * Get the trend-adjusted animation for a mood.
   * Declining trend → more caring animations.
   */
  getAnimationForMood(mood: Mood, trend: MoodTrend): string {
    if (trend === 'declining' && (mood === 'sad' || mood === 'anxious')) {
      return 'sad'; // Luna matches the user's low energy
    }
    if (trend === 'improving') {
      return 'happy'; // Luna celebrates the upward trend
    }
    if (trend === 'volatile') {
      return 'idle_blink'; // Luna stays neutral during volatility
    }
    // Default mapping
    switch (mood) {
      case 'happy':
        return 'happy';
      case 'sad':
        return 'sad';
      case 'anxious':
        return 'sad';
      case 'angry':
        return 'sad';
      default:
        return 'idle_blink';
    }
  }

  getHistory(): Mood[] {
    return [...this.history];
  }

  reset(): void {
    this.history = [];
  }
}
```

**Key behavior changes:**
- `declining + (sad/anxious)` → Luna shows `sad` animation (empathy)
- `improving` → Luna shows `happy` animation (celebration)
- `volatile` → Luna shows `idle_blink` (neutral, calming)
- Less than 3 data points → `stable` (not enough signal)

---

## 9.3 Update `eventBus.ts` — Add `moodHistory` to Memory

**File:** `src/services/eventBus.ts` — No changes needed (existing `mood_logged` event works). But update `companionStore.memory` shape:

When handling `mood_logged` in `EventEngine.ts`, persist mood history:

```typescript
// In EventEngine.ts handleEvent, after emotionEngine.processMood():
const history = moodManager.getHistory();
// Persist to SQLite for user isolation
store.updateMemory('moodHistory', history);
```

## 9.4 Create `src/services/companion/EmotionEngine.ts`

The EmotionEngine bridges `EventEngine` → `MoodManager` → `AnimationEngine`. It's imported inside `EventEngine.handleEvent` when processing `mood_logged` events.

```typescript
import { MoodManager, type Mood, type MoodTrend } from './MoodManager';
import type { AnimationState } from './AnimationEngine';

class EmotionEngine {
  private manager: MoodManager;

  /**
   * Create with persisted mood history for user isolation.
   * Pass `companionStore.getState().memory?.moodHistory` for existing users.
   */
  constructor(initialHistory: Mood[] = []) {
    this.manager = new MoodManager(initialHistory);
  }

  /**
   * Process a mood_logged event and return the adjusted animation.
   */
  processMood(mood: string, currentAnimation: AnimationState): {
    animation: AnimationState;
    trend: MoodTrend;
    recommendation: string | null;
    history: Mood[];
  } {
    const validMood = this.toMood(mood);
    const trend = this.manager.addMood(validMood);
    const recommendation = this.manager.getRecommendation(validMood);
    const animation = this.manager.getAnimationForMood(
      validMood,
      trend
    ) as AnimationState;

    return {
      animation,
      trend,
      recommendation,
      history: this.manager.getHistory(),
    };
  }

  /**
   * Get a context key for dialogue engine based on trend.
   */
  getDialogueContext(trend: MoodTrend, recommendation: string | null): string {
    if (trend === 'declining' && recommendation) return 'mood_sad';
    if (trend === 'improving') return 'mood_happy';
    return 'mood_neutral';
  }

  private toMood(mood: string): Mood {
    const valid: Mood[] = ['happy', 'sad', 'anxious', 'angry', 'neutral'];
    return valid.includes(mood as Mood) ? (mood as Mood) : 'neutral';
  }
}

export { MoodManager };

/**
 * Factory: create EmotionEngine with persisted history from companionStore.
 * Call this during EventEngine init rather than exporting a singleton.
 */
export function createEmotionEngine(): EmotionEngine {
  const memory =
    (require('../../stores/companionStore').useCompanionStore.getState()
      ?.memory as Record<string, any>) || {};
  return new EmotionEngine((memory.moodHistory as Mood[]) || []);
}
```

---

## 9.5 Export from Barrel

**File:** `src/services/companion/index.ts`

```typescript
export { MoodManager, type Mood, type MoodTrend } from './MoodManager';
export { EmotionEngine, createEmotionEngine } from './EmotionEngine';
```

---

## 9.6 Validation

- [ ] `MoodManager` constructor accepts initial history array
- [ ] `MoodManager.addMood('happy')` returns a trend
- [ ] `MoodManager.addMood('sad')` returns a trend
- [ ] 3 consecutive 'sad' entries produce 'declining' trend
- [ ] 3 consecutive 'happy' entries produce 'improving' trend
- [ ] Mixed happy/sad produces 'volatile' or 'stable'
- [ ] `MoodManager.getAnimationForMood('sad', 'declining')` returns 'sad'
- [ ] `MoodManager.getAnimationForMood('happy', 'improving')` returns 'happy'
- [ ] `EmotionEngine.processMood()` returns `{animation, trend, recommendation, history}`
- [ ] History is returned and can be persisted to `companionStore.memory.moodHistory`
- [ ] `createEmotionEngine()` reads persisted history from companionStore
- [ ] Two MoodManager instances with different histories are isolated
- [ ] Less than 3 moods → trend is `'stable'`
- [ ] `VOLATILITY_THRESHOLD` is imported from `../../constants/companion`
- [ ] `tsc --noEmit` passes with 0 new errors
