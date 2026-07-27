# Day 6 — EventEngine (Event Subscribers)

## Goal
Build the `EventEngine` that subscribes to app events and orchestrates Luna's responses: award XP, play animations, show speech bubbles.

---

## 6.1 Create `src/services/companion/EventEngine.ts`

```typescript
/**
 * EventEngine — Luna's ears and reflexes.
 *
 * Subscribes to the app event bus and reacts:
 * - Awards XP / coins based on the action
 * - Triggers the appropriate animation
 * - Queues a speech bubble via the DialogueEngine
 * - Exposes a reactive hook for the UI to consume
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { eventBus } from '../eventBus';
import { useCompanionStore, XP_REWARDS, COIN_REWARDS, calculateLevel, getLevelTitle } from '../../stores/companionStore';
import { dialogueEngine } from './DialogueEngine';
import type { AnimationState } from './AnimationEngine';

// ── Speech bubble event ──
export interface SpeechBubbleEvent {
  id: string;
  text: string;
  animation: AnimationState;
  durationMs: number;
  timestamp: number;
}

// ── Event → Dialog mapping ──
interface Reaction {
  dialogContext: string;
  animation: AnimationState;
  durationMs: number;
  getMoodContext?: (payload: any) => string | undefined;
}

const EVENT_REACTIONS: Record<string, Reaction> = {
  journal_saved: {
    dialogContext: 'journal_saved',
    animation: 'happy',
    durationMs: 3000,
  },
  mood_logged: {
    dialogContext: 'mood_logged',
    animation: 'happy', // overridden by mood below
    durationMs: 3500,
    getMoodContext: (payload: any) => payload.mood,
  },
  period_logged: {
    dialogContext: 'period_logged',
    animation: 'celebrate',
    durationMs: 4000,
  },
  period_corrected: {
    dialogContext: 'period_logged',
    animation: 'happy',
    durationMs: 3000,
  },
  water_logged: {
    dialogContext: 'water_logged',
    animation: 'wave',
    durationMs: 3000,
  },
  exercise_completed: {
    dialogContext: 'exercise_completed',
    animation: 'celebrate',
    durationMs: 3500,
  },
  sleep_logged: {
    dialogContext: 'late_night',
    animation: 'sleep',
    durationMs: 3000,
  },
  period_approaching: {
    dialogContext: 'period_approaching',
    animation: 'sad',
    durationMs: 3500,
  },
};

// ── Animation override by mood ──
const MOOD_ANIMATIONS: Record<string, AnimationState> = {
  happy: 'happy',
  sad: 'sad',
  anxious: 'sad',
  angry: 'sad',
  neutral: 'idle_blink',
};

/**
 * React hook that provides the current speech bubble state.
 * Used by LunaOverlay to display the bubble.
 */
export function useSpeechBubble() {
  const [current, setCurrent] = useState<SpeechBubbleEvent | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((text: string, animation: AnimationState, durationMs: number) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    const bubble: SpeechBubbleEvent = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text,
      animation,
      durationMs,
      timestamp: Date.now(),
    };

    setCurrent(bubble);

    timeoutRef.current = setTimeout(() => {
      setCurrent(null);
    }, durationMs);
  }, []);

  const dismiss = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCurrent(null);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { current, show, dismiss };
}

/**
 * Initialize the event engine — subscribe to all relevant events.
 * Call this once when Luna is "installed" (feature flag enabled).
 * Returns an unsubscribe function.
 */
export function initEventEngine(showBubble: (text: string, animation: AnimationState, durationMs: number) => void): () => void {
  const unsubscribers: (() => void)[] = [];

  const handleEvent = async (eventName: string, payload: any) => {
    const reaction = EVENT_REACTIONS[eventName];
    if (!reaction) return;

    const store = useCompanionStore.getState();
    if (store.isHidden) return;
    if (store.installStatus !== 'ready') return; // Don't react before assets are downloaded

    // Award XP
    const xpAmount = (XP_REWARDS as any)[eventName];
    if (xpAmount) {
      await store.addXP(xpAmount);
    }

    // Award coins
    const coinAmount = (COIN_REWARDS as any)[eventName];
    if (coinAmount) {
      await store.addCoins(coinAmount);
    }

    // Determine animation (override by mood if applicable)
    let animation = reaction.animation;
    if (reaction.getMoodContext) {
      const mood = reaction.getMoodContext(payload);
      if (mood && MOOD_ANIMATIONS[mood]) {
        animation = MOOD_ANIMATIONS[mood];
      }
    }

    // Get dialogue
    const moodContext = reaction.getMoodContext?.(payload);
    const dialog = dialogueEngine.get(reaction.dialogContext as any, moodContext);

    // Show speech bubble (the hook will trigger the animation)
    showBubble(dialog, animation, reaction.durationMs);
  };

  // Subscribe to all events defined in EVENT_REACTIONS
  for (const eventName of Object.keys(EVENT_REACTIONS)) {
    const unsub = eventBus.on(eventName as any, (payload) => {
      handleEvent(eventName, payload);
    });
    unsubscribers.push(unsub);
  }

  // Also subscribe to welcome_back on app foreground (with debounce)
  let lastForegroundTime = 0;
  const FOREGROUND_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes
  const welcomeUnsub = eventBus.on('app_foregrounded', () => {
    const store = useCompanionStore.getState();
    if (store.isHidden) return;
    if (store.installStatus !== 'ready') return;
    const now = Date.now();
    if (now - lastForegroundTime < FOREGROUND_DEBOUNCE_MS) return;
    lastForegroundTime = now;
    const welcomeText = dialogueEngine.getWelcomeBack();
    showBubble(welcomeText, 'wave', 3000);
  });
  unsubscribers.push(welcomeUnsub);

  // Return cleanup function
  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}
```

---

## 6.2 Create a Convenience Hook for Components

**File:** `src/hooks/useLunaReactions.ts`

```typescript
/**
 * Convenience hook for components to trigger Luna reactions directly.
 * E.g., after saving a journal from within a form, the component can call:
 *   triggerLunaReaction('journal_saved', { userId, journalId: 'abc' });
 */

import { useCallback } from 'react';
import { eventBus } from '../services/eventBus';
import type { EventName, EventPayload } from '../services/eventBus';

export function useLunaReaction() {
  const trigger = useCallback(<N extends EventName>(event: N, payload: EventPayload<N>) => {
    eventBus.emit(event, payload);
  }, []);

  return { trigger };
}
```

---

## 6.3 Update Existing Services to Emit Events

Ensure each local service emits the relevant event. Here is the checklist of files to modify:

| File | Event to Emit | Location |
|------|---------------|----------|
| `JournalLocalService.ts` (upsert) | `journal_saved` | After DB write success |
| `MoodLocalService.ts` (upsert) | `mood_logged` | After DB write success |
| `CycleLocalService.ts` (insert period) | `period_logged` | After DB write success |
| `CycleLocalService.ts` (correction) | `period_corrected` | After correction |

**Example patch for `JournalLocalService.ts`:**

```typescript
import { eventBus } from '../../services/eventBus';

// Inside the upsert method, after the DB write:
eventBus.emit('journal_saved', {
  userId: record.user_id,
  journalId: record.id,
  sentiment: record.sentiment_label,
});
```

---

## 6.4 Test the EventEngine

**File:** `src/__tests__/EventEngine.test.ts`

```typescript
import { eventBus } from '../services/eventBus';
import { initEventEngine } from '../services/companion/EventEngine';

describe('EventEngine', () => {
  let cleanup: (() => void) | null = null;
  const showBubbleMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset store to known state
    const { useCompanionStore } = require('../stores/companionStore');
    useCompanionStore.setState({
      userId: 'test-user',
      xp: 0,
      coins: 0,
      isHidden: false,
      isHydrated: true,
    });
    // Mock the async store actions to be sync for testing
    useCompanionStore.getState().addXP = jest.fn();
    useCompanionStore.getState().addCoins = jest.fn();
  });

  afterEach(() => {
    cleanup?.();
    eventBus.clear();
  });

  it('reacts to journal_saved', () => {
    cleanup = initEventEngine(showBubbleMock);
    eventBus.emit('journal_saved', { userId: 'test-user', journalId: 'j1' });
    expect(showBubbleMock).toHaveBeenCalledWith(
      expect.any(String),
      'happy',
      3000
    );
  });

  it('reacts to mood_logged with mood-specific animation', () => {
    cleanup = initEventEngine(showBubbleMock);
    eventBus.emit('mood_logged', { userId: 'test-user', moodLogId: 'm1', mood: 'sad', intensity: 3 });
    expect(showBubbleMock).toHaveBeenCalledWith(
      expect.any(String),
      'sad',
      3500
    );
  });

  it('reacts to period_logged with celebrate animation', () => {
    cleanup = initEventEngine(showBubbleMock);
    eventBus.emit('period_logged', { userId: 'test-user', cycleEntryId: 'c1', date: '2026-07-25' });
    expect(showBubbleMock).toHaveBeenCalledWith(
      expect.any(String),
      'celebrate',
      4000
    );
  });

  it('does not react when cat is hidden', () => {
    const { useCompanionStore } = require('../stores/companionStore');
    useCompanionStore.setState({ isHidden: true });
    cleanup = initEventEngine(showBubbleMock);
    eventBus.emit('journal_saved', { userId: 'test-user', journalId: 'j1' });
    expect(showBubbleMock).not.toHaveBeenCalled();
  });

  it('awards XP on events', () => {
    const { useCompanionStore } = require('../stores/companionStore');
    const addXPSpy = jest.fn();
    useCompanionStore.setState({ addXP: addXPSpy });
    cleanup = initEventEngine(showBubbleMock);
    eventBus.emit('journal_saved', { userId: 'test-user', journalId: 'j1' });
    expect(addXPSpy).toHaveBeenCalledWith(10);
  });
});
```

---

## ✅ Day 6 Validation

- [ ] `src/services/companion/EventEngine.ts` created
- [ ] `initEventEngine()` subscribes to all 8 events + `app_foregrounded`
- [ ] Each event awards correct XP and coins from constants
- [ ] Mood events resolve to mood-specific animations
- [ ] `installStatus !== 'ready'` check prevents reactions during download
- [ ] `useSpeechBubble()` hook created with show/dismiss + auto-dismiss timer
- [ ] `useLunaReaction()` hook created for manual triggering
- [ ] Event emissions added to JournalLocalService, MoodLocalService, CycleLocalService
- [ ] `app_foregrounded` triggers welcome-back message (debounced: only if backgrounded > 5 min)
- [ ] Hidden state suppresses all reactions
- [ ] Cleanup function unsubscribes all listeners
- [ ] Unit tests pass
- [ ] App builds without TypeScript errors
