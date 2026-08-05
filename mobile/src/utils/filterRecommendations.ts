import type { HealthTipResponse } from 'src/services/api/wellness';

// Phase -> health tip metric_type mapping
const PHASE_TIP_MAP: Record<string, string[]> = {
  menstrual: ['period', 'cramps', 'iron', 'sleep', 'stress'],
  follicular: ['energy', 'exercise', 'nutrition'],
  fertile: ['mood', 'nutrition', 'energy'],
  ovulation: ['mood', 'nutrition', 'exercise'],
  luteal: ['sleep', 'stress', 'bloating', 'water'],
};

export function filterTipsByPhase(
  tips: HealthTipResponse[],
  phaseKey: string,
  symptoms?: Array<{ symptom: string; count: number }>,
): HealthTipResponse[] {
  const relevantTypes = PHASE_TIP_MAP[phaseKey] ?? [];

  // Phase-based filter
  let filtered = tips.filter((tip) => relevantTypes.includes(tip.metric_type));

  // Boost symptom-matched tips + higher priority tips to the front
  if (symptoms && symptoms.length > 0) {
    const symptomNames = new Set(symptoms.map((s) => s.symptom.toLowerCase()));
    filtered.sort((a, b) => {
      // Priority 3 first
      if (a.priority !== b.priority) return b.priority - a.priority;
      // Then symptom match
      const aMatch = symptomNames.has(a.metric_type) ? -1 : 0;
      const bMatch = symptomNames.has(b.metric_type) ? -1 : 0;
      return bMatch - aMatch;
    });
  }

  return filtered.slice(0, 3);
}
