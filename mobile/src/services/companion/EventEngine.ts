import { useEffect, useCallback, useState, useRef } from 'react';
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

export function useSpeechBubble() {
  const [current, setCurrent] = useState<SpeechBubbleEvent | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechIdRef = useRef<string | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const show = useCallback((text: string, animation: AnimationState, durationMs: number) => {
    clearTimer();
    if (speechIdRef.current) {
      voiceService.stop();
      speechIdRef.current = null;
    }

    const bubble: SpeechBubbleEvent = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text,
      animation,
      durationMs,
      timestamp: Date.now(),
    };

    setCurrent(bubble);

    if (voiceService.isEnabled()) {
      speechIdRef.current = bubble.id;
      void voiceService
        .speak(text, {
          onDone: () => {
            if (speechIdRef.current === bubble.id) {
              speechIdRef.current = null;
              setCurrent(null);
            }
          },
          onStopped: () => {
            if (speechIdRef.current === bubble.id) {
              speechIdRef.current = null;
              setCurrent(null);
            }
          },
        })
        .catch(() => {
          if (speechIdRef.current === bubble.id) {
            speechIdRef.current = null;
            setCurrent(null);
          }
        });
      timeoutRef.current = setTimeout(() => {
        if (speechIdRef.current === bubble.id) {
          speechIdRef.current = null;
          setCurrent(null);
        }
      }, Math.max(durationMs, 15000));
    } else {
      timeoutRef.current = setTimeout(() => {
        setCurrent(null);
      }, durationMs);
    }
  }, [clearTimer]);

  const dismiss = useCallback(() => {
    clearTimer();
    if (speechIdRef.current) {
      voiceService.stop();
      speechIdRef.current = null;
    }
    setCurrent(null);
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      clearTimer();
      if (speechIdRef.current) {
        voiceService.stop();
        speechIdRef.current = null;
      }
    };
  }, [clearTimer]);

  return { current, show, dismiss };
}

export function initEventEngine(
  showBubble: (text: string, animation: AnimationState, durationMs: number) => void,
  showAchievementPopup?: (achievement: Achievement) => void
): () => void {
  const unsubscribers: (() => void)[] = [];

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
        showBubble(result.recommendation, animation, 4000);
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

    const moodContext = reaction.getMoodContext ? reaction.getMoodContext(payload) : undefined;
    const dialog = dialogueEngine.get(reaction.dialogContext as any, moodContext);

    showBubble(dialog, animation, reaction.durationMs);

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
    const showWelcome = () => showBubble(dialogueEngine.getWelcomeBack(), 'wave', 3000);
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
