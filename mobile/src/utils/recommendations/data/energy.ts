import type { PhaseContent, PhaseKey, RecommendationContentRow } from '../types';

/** Energy & fatigue — phase-locked content (legacy `*-fatigue` ids preserved). */

const fatigueMenstrual: RecommendationContentRow = {
  title: 'Rest + iron-rich foods',
  body: 'Iron drops during your period. Lean protein, leafy greens or beans help your energy recover.',
  cta: 'Just 5 minutes of sunlight',
  action: 'mark-done',
};

const fatigueFolic: RecommendationContentRow = {
  title: 'Light cardio',
  body: 'Low effort walking or cycling for 15–20 minutes lifts energy in the follicular window.',
  cta: 'Take a short walk',
  action: 'walk',
};

const fatigueFertile: RecommendationContentRow = {
  title: 'Light cardio',
  body: 'Low-effort brisk walks or gentle bike rides fit the fertile window without draining you.',
  cta: 'Take a short walk',
  action: 'walk',
};

const fatigueOvulation: RecommendationContentRow = {
  title: 'Meet your body where it is',
  body: 'Short intervals or light strength work are fine, but respect tiredness during this energising phase.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const fatigueLuteal: RecommendationContentRow = {
  title: 'Sleep hygiene',
  body: 'Luteal energy dips with hormone changes; protect sleep and keep strength light.',
  cta: 'Wind down early',
  action: 'breathing',
};

export const ENERGY_CONTENT: Record<PhaseKey, PhaseContent> = {
  menstrual: { Fatigue: fatigueMenstrual },
  follicular: { Fatigue: fatigueFolic },
  fertile: { Fatigue: fatigueFertile },
  ovulation: { Fatigue: fatigueOvulation },
  luteal: { Fatigue: fatigueLuteal },
};