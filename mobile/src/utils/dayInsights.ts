import type { DayObservation } from 'src/components/ui/DayDetailSheet';

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

export function getInsightForDay(obs: DayObservation): string | null {
  const result = getInsight(obs);
  return result?.text ?? null;
}
