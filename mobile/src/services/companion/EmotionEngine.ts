import { MoodManager, type Mood, type MoodTrend } from './MoodManager';
import type { AnimationState } from './AnimationEngine';

class EmotionEngine {
  private manager: MoodManager;

  constructor(initialHistory: Mood[] = []) {
    this.manager = new MoodManager(initialHistory);
  }

  processMood(mood: string, _currentAnimation: AnimationState): {
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

export { MoodManager, EmotionEngine };

export function createEmotionEngine(): EmotionEngine {
  const memory =
    (require('../../stores/companionStore').useCompanionStore.getState()
      ?.memory as Record<string, any>) || {};
  return new EmotionEngine((memory.moodHistory as Mood[]) || []);
}
