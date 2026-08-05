import type { MoodLog } from 'src/services/api';

interface DayMetrics {
  sleep_minutes: number | null;
  water_glasses: number | null;
  pain_level: number | null;
  energy_level: number | null;
}

export interface ReadinessBreakdown {
  sleep: number;
  mood: number;
  water: number;
  activity: number;
}

const PHASE_WEIGHTS: Record<string, Record<string, number>> = {
  follicular:  { sleep: 0.2, mood: 0.3, water: 0.2, activity: 0.3 },
  ovulation:   { sleep: 0.2, mood: 0.4, water: 0.2, activity: 0.2 },
  luteal:      { sleep: 0.4, mood: 0.3, water: 0.2, activity: 0.1 },
  menstrual:   { sleep: 0.4, mood: 0.3, water: 0.2, activity: 0.1 },
  fertile:     { sleep: 0.25, mood: 0.35, water: 0.2, activity: 0.2 },
};

export function computeReadiness(
  phaseKey: string,
  dayData: DayMetrics | null,
  moodLogs: MoodLog[],
): number | null {
  if (!dayData && moodLogs.length === 0) return null;

  const weights = PHASE_WEIGHTS[phaseKey] ?? PHASE_WEIGHTS.follicular;

  // Sleep score: 0-8h maps to 0-1
  const sleepHours = (dayData?.sleep_minutes ?? 0) / 60;
  const sleepScore = Math.min(sleepHours / 8, 1);

  // Mood score: average intensity of last 3 logs / 10
  const recentMoods = moodLogs.slice(-3);
  const moodScore = recentMoods.length > 0
    ? recentMoods.reduce((s, m) => s + m.intensity, 0) / recentMoods.length / 10
    : 0.5;

  // Water score: 0-8 glasses maps to 0-1
  const waterGlasses = dayData?.water_glasses ?? 0;
  const waterScore = Math.min(waterGlasses / 8, 1);

  // Activity score: inverted pain (0 pain = 1, 10 pain = 0)
  const painLevel = dayData?.pain_level ?? 0;
  const activityScore = 1 - (painLevel / 10);

  return Math.round(
    ((sleepScore * weights.sleep) +
     (moodScore * weights.mood) +
     (waterScore * weights.water) +
     (activityScore * weights.activity)) * 100
  );
}

export function computeReadinessBreakdown(
  phaseKey: string,
  dayData: DayMetrics | null,
  moodLogs: MoodLog[],
): ReadinessBreakdown | null {
  const score = computeReadiness(phaseKey, dayData, moodLogs);
  if (score === null) return null;
  const sleepHours = (dayData?.sleep_minutes ?? 0) / 60;
  const recentMoods = moodLogs.slice(-3);
  const waterGlasses = dayData?.water_glasses ?? 0;
  const painLevel = dayData?.pain_level ?? 0;

  return {
    sleep: Math.round(Math.min(sleepHours / 8, 1) * 100),
    mood: recentMoods.length > 0 ? Math.round(recentMoods.reduce((s, m) => s + m.intensity, 0) / recentMoods.length / 10 * 100) : 50,
    water: Math.round(Math.min(waterGlasses / 8, 1) * 100),
    activity: Math.round((1 - (painLevel / 10)) * 100),
  };
}
