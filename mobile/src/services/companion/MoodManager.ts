import { VOLATILITY_THRESHOLD } from '../../constants/companion';

export type Mood = 'happy' | 'sad' | 'anxious' | 'angry' | 'neutral';
export type MoodTrend = 'improving' | 'declining' | 'stable' | 'volatile';

export const MOODS: Mood[] = ['happy', 'sad', 'anxious', 'angry', 'neutral'];

export const MOOD_SCORES: Record<Mood, number> = {
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
    this.history = initialHistory.slice(-this.maxHistory);
  }

  addMood(mood: Mood): MoodTrend {
    this.history.push(mood);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    if (this.history.length < 3) return 'stable';

    const scores = this.history.map((m) => MOOD_SCORES[m]);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const first = scores[0];
    const last = scores[scores.length - 1];

    const variance = scores.reduce((sum, s) => sum + Math.abs(s - avg), 0) / scores.length;
    if (variance > VOLATILITY_THRESHOLD) return 'volatile';

    if (last > first + 2) return 'improving';
    if (last < first - 2) return 'declining';
    return 'stable';
  }

  getRecommendation(mood: Mood): string | null {
    switch (mood) {
      case 'sad':
        return "I'm here for you. Let's take a moment together";
      case 'anxious':
        return "Let's take a deep breath. In... and out...";
      case 'angry':
        return "It's okay to feel angry. Let's walk it off";
      default:
        return null;
    }
  }

  getAnimationForMood(mood: Mood, trend: MoodTrend): string {
    if (trend === 'declining' && (mood === 'sad' || mood === 'anxious')) {
      return 'sad';
    }
    if (trend === 'improving') {
      return 'happy';
    }
    if (trend === 'volatile') {
      return 'idle_blink';
    }
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
