import type { PhaseContent, PhaseKey, RecommendationContentRow } from '../types';

/** Reproductive & menstrual — phase-locked content. */

const heavyBleeding: RecommendationContentRow = {
  title: 'Track duration + hydrate',
  body: 'Heavy flow means extra fluid and iron loss. Hydrate, note how long it lasts, and eat iron-rich foods.',
  cta: 'Log water intake',
  action: 'water',
};

const spottingLuteal: RecommendationContentRow = {
  title: 'Note the pattern',
  body: 'Spotting can be normal, but logging when it happens helps a clinician spot trends. Rest more this week.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const pmsAny: RecommendationContentRow = {
  title: 'Soften the PMT week',
  body: 'For PMS symptoms, gentle movement, earlier nights and less caffeine smooth the pre-period window.',
  cta: 'Take a short walk',
  action: 'walk',
};

const pmddLuteal: RecommendationContentRow = {
  title: 'PMDD needs structure',
  body: 'PMDD symptoms deserve a planned week: predictable sleep, tracked mood and a clinician if they dominate your life.',
  cta: 'Consider mentioning this at your next check-up',
  action: 'doctor',
};

const ovulationPain: RecommendationContentRow = {
  title: 'One-sided ache is ovulation',
  body: 'Painful ovulation is usually one-sided and brief — heat on the lower belly and rest usually settle it.',
  cta: 'Log water intake',
  action: 'water',
};

const painfulUrination: RecommendationContentRow = {
  title: 'Drink + track frequency',
  body: 'Painful urination needs fluids and tracking — if it persists or worsens, rule out a UTI with your doctor.',
  cta: 'Log water intake',
  action: 'water',
};

export const REPRODUCTIVE_CONTENT: Record<PhaseKey, PhaseContent> = {
  menstrual: {
    'Heavy / Prolonged Bleeding': heavyBleeding,
    'PMS Symptoms': pmsAny,
  },
  follicular: {},
  fertile: {
    'Painful Ovulation': ovulationPain,
  },
  ovulation: {
    'Painful Ovulation': ovulationPain,
  },
  luteal: {
    'Bleeding / Spotting Between Periods': spottingLuteal,
    'PMS Symptoms': pmsAny,
    'PMDD (Severe PMS)': pmddLuteal,
    'Painful Urination': painfulUrination,
  },
};