import type { PhaseRange } from 'src/utils/cyclePhases';

/**
 * Expert recommendation engine (plan §8) — pure & unit-tested.
 * Phase-locked content matrix: Cramps / Fatigue / Bloating × 5 phases.
 * Returns max 3 actionable cards for the `recommendation` tier.
 */

export type RecommendationAction = 'water' | 'breathing' | 'days-stretch' | 'mark-done' | null;

export interface RecommendationCard {
  /** Stable slug, e.g. "menstrual-heat". */
  id: string;
  icon: string;
  title: string;
  body: string;
  cta?: string | null;
  action?: RecommendationAction;
}

export interface RecommendationInput {
  phaseKey: PhaseRange['key'];
  painLevel: number;
  selectedSymptoms: string[];
  /** Symptom name → normalized severity (1/3/5). Default 3 when absent. */
  severities?: Record<string, number>;
}

export const MAX_CARDS = 3;

/** Taxonomy names referenced by the content matrix. */
const CRAMPS_NAMES = ['Abdominal Cramps', 'Cramps', 'Lower Back Pain'];
const FATIGUE_NAMES = ['Fatigue', 'Low Energy'];
const BLOATING_NAMES = ['Bloating'];

/** Pain band for which the Cramps card is relevant (recommendation tier). */
const CRAMPS_PAIN_MIN = 4;
const CRAMPS_PAIN_MAX = 6;

type PhaseKey = PhaseRange['key'];

interface ContentRow {
  cramps: Pick<RecommendationCard, 'title' | 'body' | 'cta' | 'action'>;
  fatigue: Pick<RecommendationCard, 'title' | 'body' | 'cta' | 'action'>;
  bloating: Pick<RecommendationCard, 'title' | 'body' | 'cta' | 'action'>;
}

const MATRIX: Record<PhaseKey, ContentRow> = {
  menstrual: {
    cramps: {
      title: 'Heat + gentle stretch',
      body: 'Place a heat pack or warm water bottle on your lower abdomen for 15–20 minutes. Combine with gentle Cat-Cow stretches.',
      cta: 'Log water intake',
      action: 'water',
    },
    fatigue: {
      title: 'Rest + iron-rich foods',
      body: 'Iron drops during your period. Lean protein, leafy greens or beans help your energy recover.',
      cta: 'Just 5 minutes of sunlight',
      action: 'mark-done',
    },
    bloating: {
      title: 'Hydrate, limit salt',
      body: 'Extra water plus a little less sodium eases menstrual bloating fast.',
      cta: 'Log water intake',
      action: 'water',
    },
  },
  follicular: {
    cramps: {
      title: 'Stretch it out',
      body: 'Gently stretch the hips and lower back for 10 minutes. Your follicular phase recovers well with movement.',
      cta: 'Start a stretch',
      action: 'days-stretch',
    },
    fatigue: {
      title: 'Light cardio',
      body: 'Low effort walking or cycling for 15–20 minutes lifts energy in the follicular window.',
      cta: 'Take a short walk',
      action: 'mark-done',
    },
    bloating: {
      title: 'Increase fiber',
      body: 'Oats, berries and green vegetables keep digestion steady during follicular.',
      cta: 'Add a fiber snack',
      action: 'mark-done',
    },
  },
  fertile: {
    cramps: {
      title: 'Stretch it out',
      body: 'Warm-up free stretching loosens tension; mid-fertile cramps respond to gentle yoga flow.',
      cta: 'Start a stretch',
      action: 'days-stretch',
    },
    fatigue: {
      title: 'Light cardio',
      body: 'Low-effort brisk walks or gentle bike rides fit the fertile window without draining you.',
      cta: 'Take a short walk',
      action: 'mark-done',
    },
    bloating: {
      title: 'Drink more water',
      body: 'Extra hydration around ovulation can soften bloating from rising hormones.',
      cta: 'Log water intake',
      action: 'water',
    },
  },
  ovulation: {
    cramps: {
      title: 'Light yoga',
      body: 'Slow, supported yoga poses quiet cramps without overloading an energetic phase.',
      cta: 'Start a stretch',
      action: 'days-stretch',
    },
    fatigue: {
      title: 'HIIT or moderate strength',
      body: 'Short intervals or light strength work are fine, but respect tiredness.',
      cta: 'Meet your body where it is',
      action: 'mark-done',
    },
    bloating: {
      title: 'Drink more water',
      body: 'Drink an extra glass between meals to ease ovulation bloating.',
      cta: 'Log water intake',
      action: 'water',
    },
  },
  luteal: {
    cramps: {
      title: 'Magnesium + Omega-3',
      body: 'Magnesium (banana, pumpkin seeds, leafy greens) and Omega-3 can soften luteal cramps.',
      cta: 'Add a magnesium snack',
      action: 'mark-done',
    },
    fatigue: {
      title: 'Sleep hygiene',
      body: 'Luteal energy dips with hormone changes; protect sleep and keep strength light.',
      cta: 'Wind down early',
      action: 'breathing',
    },
    bloating: {
      title: 'Reduce carbs/sodium',
      body: 'Cut bloat by banking sodium and refined carbs; favor small, frequent, fibrous meals.',
      cta: 'Swap a high-salt snack',
      action: 'mark-done',
    },
  },
};

function hasAny(selected: string[], names: string[]): boolean {
  return names.some((n) => selected.includes(n));
}

/**
 * Main entry: map a phase + observed symptoms to up to 3 cards.
 * Cards ordered cramps → fatigue → bloating (priority), stable slugs.
 */
export function getRecommendations(input: RecommendationInput): RecommendationCard[] {
  const { phaseKey, painLevel, selectedSymptoms } = input;
  const row = MATRIX[phaseKey];
  const cards: RecommendationCard[] = [];

  const hasCramps = hasAny(selectedSymptoms, CRAMPS_NAMES);
  const painInWindow = painLevel >= CRAMPS_PAIN_MIN && painLevel <= CRAMPS_PAIN_MAX;

  if (hasCramps && painInWindow) {
    cards.push({
      id: `${phaseKey}-cramps`,
      icon: '🔥',
      ...row.cramps,
    });
  }

  if (hasAny(selectedSymptoms, FATIGUE_NAMES)) {
    cards.push({
      id: `${phaseKey}-fatigue`,
      icon: '🌿',
      ...row.fatigue,
    });
  }

  if (hasAny(selectedSymptoms, BLOATING_NAMES)) {
    cards.push({
      id: `${phaseKey}-bloating`,
      icon: '💧',
      ...row.bloating,
    });
  }

  return cards.slice(0, MAX_CARDS);
}