import { useSyncExternalStore } from 'react';
import { eventBus } from '../eventBus';
import { useCompanionStore, XP_REWARDS, COIN_REWARDS } from '../../stores/companionStore';
import { dialogueEngine } from './DialogueEngine';
import { voiceService } from './voiceService';
import { achievementEngine } from './AchievementEngine';
import { createEmotionEngine } from './EmotionEngine';
import { initMemoryService, memoryService } from './memoryService';
import type { Achievement } from './AchievementEngine';
import type { AnimationState } from './AnimationEngine';

export interface SpeechBubbleEvent {
  id: string;
  text: string;
  animation: AnimationState;
  durationMs: number;
  timestamp: number;
}

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
    animation: 'happy',
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
  exercise_logged: {
    dialogContext: 'exercise',
    animation: 'celebrate',
    durationMs: 3500,
  },
  medication_logged: {
    dialogContext: 'medication',
    animation: 'happy',
    durationMs: 3000,
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
  diary_page_created: {
    dialogContext: 'diary_page_created',
    animation: 'happy',
    durationMs: 3500,
  },
  diary_photo_added: {
    dialogContext: 'diary_photo_added',
    animation: 'wave',
    durationMs: 3000,
  },
  diary_page_saved: {
    dialogContext: 'diary_page_saved',
    animation: 'idle',
    durationMs: 3000,
  },
  diary_opened: {
    dialogContext: 'diary_opened',
    animation: 'idle',
    durationMs: 3000,
  },
  diary_media_synced: {
    dialogContext: 'diary_media_synced',
    animation: 'happy',
    durationMs: 3000,
  },
  day_logged: {
    dialogContext: 'day_logged',
    animation: 'happy',
    durationMs: 3000,
  },
};

const MOOD_ANIMATIONS: Record<string, AnimationState> = {
  happy: 'happy',
  sad: 'sad',
  anxious: 'sad',
  angry: 'sad',
  neutral: 'idle_blink',
};

// ─────────────────────────────────────────────────────────────────────────
// Phase 0: single shared bubble host.
// Previously `useSpeechBubble()` created per-instance state: HomeDashboard
// held an unrendered instance, LunaOverlay held the only renderer. Events
// updated the invisible instance. Now state lives at module scope and the
// hook subscribes via `useSyncExternalStore`.
// ─────────────────────────────────────────────────────────────────────────

let currentBubble: SpeechBubbleEvent | null = null;
let bubbleTimeout: ReturnType<typeof setTimeout> | null = null;
let speechIdRef: string | null = null;

type BubbleListener = () => void;
const bubbleListeners = new Set<BubbleListener>();

function emitBubbleChange(): void {
  bubbleListeners.forEach((listener) => listener());
}

function subscribeBubble(listener: BubbleListener): () => void {
  bubbleListeners.add(listener);
  return () => {
    bubbleListeners.delete(listener);
  };
}

function getBubbleSnapshot(): SpeechBubbleEvent | null {
  return currentBubble;
}

function clearBubbleTimer(): void {
  if (bubbleTimeout) {
    clearTimeout(bubbleTimeout);
    bubbleTimeout = null;
  }
}

export function showBubble(
  text: string,
  animation: AnimationState,
  durationMs: number
): void {
  clearBubbleTimer();
  if (speechIdRef) {
    voiceService.stop();
    speechIdRef = null;
  }

  const bubble: SpeechBubbleEvent = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    text,
    animation,
    durationMs,
    timestamp: Date.now(),
  };

  currentBubble = bubble;
  emitBubbleChange();

  if (voiceService.isEnabled()) {
    speechIdRef = bubble.id;
    void voiceService
      .speak(text, {
        onDone: () => {
          if (speechIdRef === bubble.id) {
            speechIdRef = null;
            currentBubble = null;
            emitBubbleChange();
          }
        },
        onStopped: () => {
          if (speechIdRef === bubble.id) {
            speechIdRef = null;
            currentBubble = null;
            emitBubbleChange();
          }
        },
      })
      .catch(() => {
        if (speechIdRef === bubble.id) {
          speechIdRef = null;
          currentBubble = null;
          emitBubbleChange();
        }
      });
    bubbleTimeout = setTimeout(() => {
      bubbleTimeout = null;
      if (speechIdRef === bubble.id) {
        speechIdRef = null;
        currentBubble = null;
        emitBubbleChange();
      }
    }, Math.max(durationMs, 15000));
  } else {
    bubbleTimeout = setTimeout(() => {
      bubbleTimeout = null;
      currentBubble = null;
      emitBubbleChange();
    }, durationMs);
  }
}

export function dismissBubble(): void {
  clearBubbleTimer();
  if (speechIdRef) {
    voiceService.stop();
    speechIdRef = null;
  }
  currentBubble = null;
  emitBubbleChange();
}

export function useSpeechBubble(): {
  current: SpeechBubbleEvent | null;
  show: typeof showBubble;
  dismiss: typeof dismissBubble;
} {
  const current = useSyncExternalStore(subscribeBubble, getBubbleSnapshot);
  return { current, show: showBubble, dismiss: dismissBubble };
}

export interface TodayInsightOverride {
  card: { title: string } | null;
  tier: 'seek_care' | 'recommendation' | 'maintenance' | 'motivation';
}

export interface EventEngineOptions {
  /**
   * Returns the shared "today's recommendation" snapshot (Phase 2). When it has
   * a card and the tier is `motivation`/`recommendation`, the proactive bubble
   * replaces the generic welcome-back / day_logged line. Never triggered on
   * `seek_care` (reserved for DayDetailSheet).
   */
  getTodayInsight?: () => TodayInsightOverride;
}

const INSIGHT_ANIMATION: Record<string, AnimationState> = {
  motivation: 'happy',
  recommendation: 'idle',
};

export function initEventEngine(
  showBubbleFn: (
    text: string,
    animation: AnimationState,
    durationMs: number
  ) => void,
  showAchievementPopup?: (achievement: Achievement) => void,
  options?: EventEngineOptions
): () => void {
  const show = showBubbleFn ?? showBubble;
  const getTodayInsight = options?.getTodayInsight;
  const unsubscribers: (() => void)[] = [];

  /**
   * Proactive insight override. Returns true when the insight replaced the
   * generic bubble; false otherwise (caller falls back to its default line).
   */
  const tryShowInsight = (durationMs: number): boolean => {
    if (!getTodayInsight) return false;
    const insight = getTodayInsight();
    if (!insight?.card) return false;
    if (insight.tier !== 'motivation' && insight.tier !== 'recommendation') return false;
    const store = useCompanionStore.getState();
    if (store.showInsights === false) return false;
    show(insight.card.title, INSIGHT_ANIMATION[insight.tier] ?? 'happy', durationMs);
    return true;
  };

  const checkAchievements = (eventName: string, payload: any) => {
    const store = useCompanionStore.getState();
    const userId = payload.userId || store.userId;
    if (!userId) return;

    queueMicrotask(async () => {
      try {
        const newAchievements = await achievementEngine.checkAchievements(userId, eventName);
        for (const achievement of newAchievements) {
          const existing = (store.memory?.achievements as string[]) || [];
          if (!existing.includes(achievement.id)) {
            await store.updateMemory('achievements', [...existing, achievement.id]);
            showAchievementPopup?.(achievement);
          }
        }
      } catch {
        // Silent fail
      }
    });
  };

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

    const xpAmount = (XP_REWARDS as any)[eventName];
    if (xpAmount) {
      Promise.resolve(store.addXP(xpAmount)).catch(() => {});
    }

    const coinAmount = (COIN_REWARDS as any)[eventName];
    if (coinAmount) {
      Promise.resolve(store.addCoins(coinAmount)).catch(() => {});
    }

    let animation = reaction.animation;

    // ── Emotion Engine integration for mood_logged ──
    if (eventName === 'mood_logged' && payload.mood) {
      const emotionEngine = createEmotionEngine();
      const result = emotionEngine.processMood(payload.mood as string, reaction.animation);
      animation = result.animation;

      store.updateMemory('moodHistory', result.history);

      if (result.recommendation) {
        show(result.recommendation, animation, 4000);
        checkAchievements(eventName, payload);
        return;
      }
    }

    if (reaction.getMoodContext) {
      const mood = reaction.getMoodContext(payload);
      if (mood && MOOD_ANIMATIONS[mood]) {
        animation = MOOD_ANIMATIONS[mood];
      }
    }

    // ── Proactive insight override for day_logged (luna plan Phase 2) ──
    // Shows the shared "today's recommendation" card instead of the generic
    // day_logged line when it's a motivation/recommendation tier.
    if (eventName === 'day_logged' && tryShowInsight(reaction.durationMs)) {
      checkAchievements(eventName, payload);
      return;
    }

    const moodContext = reaction.getMoodContext ? reaction.getMoodContext(payload) : undefined;
    const dialog = dialogueEngine.get(reaction.dialogContext as any, moodContext);

    show(dialog, animation, reaction.durationMs);

    checkAchievements(eventName, payload);
  };

  for (const eventName of Object.keys(EVENT_REACTIONS)) {
    const unsub = eventBus.on(eventName as any, (payload) => {
      handleEvent(eventName, payload);
    });
    unsubscribers.push(unsub);
  }

  let lastForegroundTime = 0;
  const FOREGROUND_DEBOUNCE_MS = 5 * 60 * 1000;
  const welcomeUnsub = eventBus.on('app_foregrounded', () => {
    const store = useCompanionStore.getState();
    if (store.isHidden) {
      return;
    }
    if (store.installStatus !== 'ready') {
      return;
    }
    const now = Date.now();
    if (now - lastForegroundTime < FOREGROUND_DEBOUNCE_MS) {
      return;
    }
    lastForegroundTime = now;
    const showWelcome = () => {
      // Proactive insight replaces the generic welcome-back bubble (Phase 2).
      if (tryShowInsight(4000)) return;
      show(dialogueEngine.getWelcomeBack(), 'wave', 3000);
    };
    if (store.userId) {
      memoryService
        .hydrateMemory(store.userId)
        .then((snapshot) => {
          dialogueEngine.setMemoryContext(snapshot);
          showWelcome();
        })
        .catch(() => showWelcome());
    } else {
      showWelcome();
    }
  });
  unsubscribers.push(welcomeUnsub);

  const memoryCleanup = initMemoryService();
  unsubscribers.push(memoryCleanup);

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}
