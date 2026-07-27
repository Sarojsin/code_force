# Phase 2 Day 10 — Emotion System: EventEngine Integration

## Goal
Wire the `EmotionEngine` into `EventEngine.handleEvent` so that every `mood_logged` event triggers mood trend analysis, adjusts Luna's animation, and optionally shows a recommendation bubble.

---

## 10.1 Update `EventEngine.ts` — Mood-Logged Handler

**File:** `src/services/companion/EventEngine.ts`

Extend the `mood_logged` reaction to use the `EmotionEngine`:

```typescript
import { emotionEngine } from './EmotionEngine';
import { moodManager, type Mood } from './MoodManager';

// Update the handleEvent function — inside the mood_logged case:
if (eventName === 'mood_logged') {
  const mood = payload.mood as string;
  const { animation, recommendation } = emotionEngine.processMood(
    mood,
    reaction.animation
  );

  // Override animation with emotion-adjusted one
  animation = animation;

  // Show recommendation bubble if applicable
  if (recommendation) {
    // Use a longer duration for the recommendation
    showBubble(recommendation, animation, 4000);
  }
}
```

**Full updated `handleEvent` for `mood_logged`:**

```typescript
const handleEvent = (eventName: string, payload: any) => {
  const reaction = EVENT_REACTIONS[eventName];
  if (!reaction) return;

  const store = useCompanionStore.getState();
  if (store.isHidden) return;
  if (store.installStatus !== 'ready') return;

  // Award XP/Coins
  const xpAmount = (XP_REWARDS as any)[eventName];
  if (xpAmount) {
    Promise.resolve(store.addXP(xpAmount)).catch(() => {});
  }
  const coinAmount = (COIN_REWARDS as any)[eventName];
  if (coinAmount) {
    Promise.resolve(store.addCoins(coinAmount)).catch(() => {});
  }

  let animation = reaction.animation;
  const extraDuration = 0;

  // ── Emotion Engine integration for mood_logged ──
  if (eventName === 'mood_logged' && payload.mood) {
    const mood = payload.mood as string;
    const result = emotionEngine.processMood(mood, reaction.animation);
    animation = result.animation;

    // Persist mood history for user isolation (survives restarts)
    store.updateMemory('moodHistory', result.history);

    if (result.recommendation) {
      // Show a care recommendation
      showBubble(result.recommendation, animation, 4000);
      // Also show the standard dialogue after?
      // For now, the recommendation replaces the standard dialogue.
      // Emit achievement check in microtask
      queueMicrotask(async () => {
        try {
          const userId = payload.userId || store.userId;
          if (!userId) return;
          const newAchievements = await achievementEngine.checkAchievements(
            userId,
            eventName
          );
          for (const achievement of newAchievements) {
            const existing = (store.memory?.achievements as string[]) || [];
            if (!existing.includes(achievement.id)) {
              await store.updateMemory('achievements', [
                ...existing,
                achievement.id,
              ]);
              showAchievementPopup?.(achievement);
            }
          }
        } catch {
          // Silent fail
        }
      });
      return; // Exit early — recommendation shown
    }
  }

  // ── Standard dialogue for non-mood events (or mood without recommendation) ──
  const moodContext = reaction.getMoodContext
    ? reaction.getMoodContext(payload)
    : undefined;
  const dialog = dialogueEngine.get(
    reaction.dialogContext as any,
    moodContext
  );
  showBubble(dialog, animation, reaction.durationMs + extraDuration);

  // Offload achievement check (non-blocking)
  const userId = payload.userId || store.userId;
  if (userId) {
    queueMicrotask(async () => {
      try {
        const newAchievements = await achievementEngine.checkAchievements(
          userId,
          eventName
        );
        for (const achievement of newAchievements) {
          const existing = (store.memory?.achievements as string[]) || [];
          if (!existing.includes(achievement.id)) {
            await store.updateMemory('achievements', [
              ...existing,
              achievement.id,
            ]);
            showAchievementPopup?.(achievement);
          }
        }
      } catch {
        // Silent fail
      }
    });
  }
};
```

**Note:** `queueMicrotask` is available in React Native 0.70+. If targeting older versions, replace with `setTimeout(() => {}, 0)` in the achievement check helper.

**Important design decisions:**
1. **Recommendation replaces standard dialogue** for mood events — avoids double bubbles
2. **Early return** after recommendation — the standard dialogue path is skipped
3. **Achievement check always runs** — both for recommendation path and standard path
4. **`emotionEngine.processMood()` is stateless** — it delegates state to `MoodManager`

---

## 10.2 Update `MOOD_ANIMATIONS` in EventEngine

The `MOOD_ANIMATIONS` map is still referenced but the EmotionEngine now has the authoritative logic. Keep the existing map as a fallback for non-Luna contexts.

```typescript
// Keep as-is — still used by getMoodContext-based reactions
const MOOD_ANIMATIONS: Record<string, AnimationState> = {
  happy: 'happy',
  sad: 'sad',
  anxious: 'sad',
  angry: 'sad',
  neutral: 'idle_blink',
};
```

---

## 10.3 Update `createTestMoodLog` Helper (for test files)

If you maintain test helpers:

```typescript
// In test setup or factory:
export function createTestMoodLog(mood: string, intensity: number = 3) {
  return {
    userId: 'test-user',
    moodLogId: `mood-${Date.now()}`,
    mood,
    intensity,
  };
}
```

---

## 10.4 Validation

- [ ] `mood_logged` with `'sad'` triggers `emotionEngine.processMood()`
- [ ] Declining trend + sad → Luna shows sad animation + recommendation bubble
- [ ] Improving trend + happy → Luna shows happy animation
- [ ] Recommendation text matches the mood (`'sad'` → care message, `'anxious'` → breathing)
- [ ] Achievement check still runs after mood-logged processing
- [ ] Non-mood events (journal_saved, etc.) use standard path unchanged
- [ ] `tsc --noEmit` passes with 0 new errors
