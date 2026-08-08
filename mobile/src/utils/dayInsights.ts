import type { DayObservation } from 'src/components/ui/DayDetailSheet';
import type { PhaseRange } from 'src/utils/cyclePhases';
import { getSafetyForDay } from 'src/utils/symptomSafety';
import type { RedFlag, SafetyTier } from 'src/utils/symptomSafety';

interface InsightResult {
  icon: string;
  text: string;
}

const PAIN_INSIGHTS: Record<number, string> = {
  0: 'No pain today — wonderful!',
  1: 'Mild discomfort. Stay hydrated.',
  2: 'A little sore. A warm compress may help.',
  3: 'Moderate pain. Rest when you can.',
  4: 'Noticeable pain. Gentle stretching may ease it.',
  5: 'Mid-range. Consider ibuprofen if needed.',
  6: 'Pain is building. Prioritise rest.',
  7: 'Significant pain. Stay warm and hydrated.',
  8: 'High pain. Take medication if you have it.',
  9: 'Very high pain. Reach out for support.',
  10: 'Severe pain — please rest and seek help if it persists.',
};

const ENERGY_INSIGHTS: Record<number, string> = {
  1: 'Low energy today. Listen to your body and rest.',
  2: 'Moderate energy. Light activity is fine.',
  3: 'Good energy — great time to be active!',
};

const WATER_INSIGHTS = [
  { threshold: 0, msg: 'No water logged yet today. Try to hydrate!' },
  { threshold: 4, msg: 'A few glasses in. Keep sipping throughout the day.' },
  { threshold: 8, msg: 'Halfway there — nice work staying hydrated.' },
  { threshold: 12, msg: 'Well hydrated today!' },
];

/**
 * Motivational-layer copy for maintenance / motivation tiers (plan §7).
 * Deliberately non-toxic — no "just cheer up".
 */
const MAINTENANCE_MESSAGES = [
  'Keep tracking — a couple more days of notes will reveal your natural pattern.',
  'You matched the effort. Day by day the picture sharpens — keep it up.',
  'Logs compound. A few consistent days gives you a much clearer view.',
];

const MOTIVATION_MESSAGES = [
  "Your body is working hard right now. You don't need to be superhuman today.",
  'A calm day is worth logging — rest is part of the pattern too.',
  'Feeling good today. Worth noting the small wins.',
];

function getInsight(obs: DayObservation): InsightResult | null {
  if (obs.painLevel >= 5) {
    return { icon: '🌡️', text: PAIN_INSIGHTS[obs.painLevel] };
  }
  if (obs.energyLevel === 1) {
    return { icon: '😴', text: ENERGY_INSIGHTS[1] };
  }
  if (obs.waterGlasses > 0 && obs.waterGlasses < 4) {
    return { icon: '💧', text: WATER_INSIGHTS[1].msg };
  }
  if (obs.waterGlasses >= 12) {
    return { icon: '💧', text: WATER_INSIGHTS[3].msg };
  }
  if (obs.symptoms.includes('Cramps') && obs.painLevel >= 3) {
    return { icon: '💫', text: 'Cramps detected. A warm compress or gentle movement may help.' };
  }
  if (obs.symptoms.includes('Fatigue') && obs.energyLevel === 1) {
    return { icon: '😴', text: 'Fatigue + low energy. Consider a short nap or lighter schedule.' };
  }
  if (obs.symptoms.includes('Headache')) {
    return { icon: '🤕', text: 'Headache logged. Hydration and rest are your friends.' };
  }
  return null;
}

export interface DayInsightResult {
  /** Tier key from `symptomSafety`. */
  tier: SafetyTier;
  /** Motivational copy — only populated for `maintenance` / `motivation` tiers. */
  motivation: string | null;
  /** Red-flag copy surfaced by the classifier (empty unless `seek_care`). */
  rules: RedFlag[];
}

/**
 * Tier-aware insight for a logged day. `seek_care` and `recommendation` tiers
 * render in their own UI slots (future PRs); `dayInsights` only renders for
 * `maintenance` and `motivation` (plan §7).
 */
export function getDayInsight(
  obs: DayObservation,
  phaseKey: PhaseRange['key'],
): DayInsightResult {
  const safety = getSafetyForDay({
    painLevel: obs.painLevel,
    phaseKey,
    selectedSymptomNames: obs.symptoms,
    avgPeriodDays: null,
  });

  const result: DayInsightResult = { tier: safety.tier, motivation: null, rules: safety.flags };

  switch (safety.tier) {
    case 'maintenance':
      result.motivation = pickMaintenanceMessage(obs);
      break;
    case 'motivation':
      result.motivation = pickMotivationMessage(obs);
      break;
    case 'seek_care':
    case 'recommendation':
    default:
      // Their own slots render — no motivational copy here.
      result.motivation = null;
  }

  return result;
}

/** Motivational copy only — for the AIInsightCard in maintenance / motivation tiers. */
export function getMotivationForDay(
  obs: DayObservation,
  phaseKey: PhaseRange['key'],
): string | null {
  return getDayInsight(obs, phaseKey).motivation;
}

/** Legacy single-text helper (kept for the existing dayInsights tests). */
export function getInsightForDay(obs: DayObservation): string | null {
  const result = getInsight(obs);
  return result?.text ?? null;
}

function pickMaintenanceMessage(obs: DayObservation): string {
  const idx = hashIndex(obs.painLevel * 7 + obs.waterGlasses, MAINTENANCE_MESSAGES.length);
  return MAINTENANCE_MESSAGES[idx];
}

function pickMotivationMessage(obs: DayObservation): string {
  const seed = (obs.energyLevel ?? 2) + obs.waterGlasses;
  const idx = hashIndex(seed, MOTIVATION_MESSAGES.length);
  return MOTIVATION_MESSAGES[idx];
}

function hashIndex(value: number, mod: number): number {
  return ((value % mod) + mod) % mod;
}