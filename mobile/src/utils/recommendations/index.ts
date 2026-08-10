import type { PhaseContent, PhaseKey } from './types';
import { PAIN_CONTENT } from './data/pain';
import { DIGESTIVE_CONTENT } from './data/digestive';
import { SKIN_CONTENT } from './data/skin';
import { MOOD_CONTENT } from './data/mood';
import { REPRODUCTIVE_CONTENT } from './data/reproductive';
import { ENERGY_CONTENT } from './data/energy';

export type { RecommendationCard, RecommendationContentRow, RecommendationAction } from './types';
export { GENERAL_MATRIX } from './data/general';
export { MOTIVATION_CARDS, COMFORT_CARDS } from './data/motivation';

const ALL_KEYS: PhaseKey[] = ['menstrual', 'follicular', 'fertile', 'ovulation', 'luteal'];

const CATEGORY_SOURCES: Record<PhaseKey, PhaseContent> = {
  menstrual: {
    ...PAIN_CONTENT.menstrual,
    ...DIGESTIVE_CONTENT.menstrual,
    ...SKIN_CONTENT.menstrual,
    ...MOOD_CONTENT.menstrual,
    ...REPRODUCTIVE_CONTENT.menstrual,
    ...ENERGY_CONTENT.menstrual,
  },
  follicular: {
    ...PAIN_CONTENT.follicular,
    ...DIGESTIVE_CONTENT.follicular,
    ...SKIN_CONTENT.follicular,
    ...MOOD_CONTENT.follicular,
    ...REPRODUCTIVE_CONTENT.follicular,
    ...ENERGY_CONTENT.follicular,
  },
  fertile: {
    ...PAIN_CONTENT.fertile,
    ...DIGESTIVE_CONTENT.fertile,
    ...SKIN_CONTENT.fertile,
    ...MOOD_CONTENT.fertile,
    ...REPRODUCTIVE_CONTENT.fertile,
    ...ENERGY_CONTENT.fertile,
  },
  ovulation: {
    ...PAIN_CONTENT.ovulation,
    ...DIGESTIVE_CONTENT.ovulation,
    ...SKIN_CONTENT.ovulation,
    ...MOOD_CONTENT.ovulation,
    ...REPRODUCTIVE_CONTENT.ovulation,
    ...ENERGY_CONTENT.ovulation,
  },
  luteal: {
    ...PAIN_CONTENT.luteal,
    ...DIGESTIVE_CONTENT.luteal,
    ...SKIN_CONTENT.luteal,
    ...MOOD_CONTENT.luteal,
    ...REPRODUCTIVE_CONTENT.luteal,
    ...ENERGY_CONTENT.luteal,
  },
};

/** Full phase-locked content matrix (all categories merged) keyed by symptom name. */
export const PHASE_MATRIX: Record<PhaseKey, PhaseContent> = ALL_KEYS.reduce(
  (acc, key) => {
    acc[key] = CATEGORY_SOURCES[key];
    return acc;
  },
  {} as Record<PhaseKey, PhaseContent>,
);