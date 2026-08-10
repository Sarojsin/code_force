import type { PhaseContent, PhaseKey, RecommendationContentRow } from '../types';

/** Skin & hair — phase-locked content (hormone-sensitive). */

const acneLuteal: RecommendationContentRow = {
  title: 'Cleanse gently',
  body: 'Progesterone spikes oil before your period. Use a gentle cleanser and hands-off care to avoid irritation.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const acneOvulation: RecommendationContentRow = {
  title: 'Oil-balanced routine',
  body: 'Ovulation estrogen/surge changes oil. Rinse with lukewarm water and swap heavy moisturizer for a gel.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const drySkinLuteal: RecommendationContentRow = {
  title: 'Moisture before bed',
  body: 'Luteal lows can dry skin. Apply a pea of fragrance-free moisturizer at night and drink extra water.',
  cta: 'Log water intake',
  action: 'water',
};

const hairAny: RecommendationContentRow = {
  title: 'Be gentle, keep zinc up',
  body: 'Keep your hair routine gentle and ensure zinc and iron-rich foods — hormonal shedding is usually temporary.',
  cta: 'Mark as done',
  action: 'mark-done',
};

export const SKIN_CONTENT: Record<PhaseKey, PhaseContent> = {
  menstrual: {
    'Acne / Pimples': acneLuteal,
    'Hair Thinning / Loss': hairAny,
    'Dry / Itchy Skin': drySkinLuteal,
  },
  follicular: {
    'Oily Skin': {
      title: 'Light, clean layers',
      body: 'Follicular energy pairs with a fresh, oil-balanced routine — rinse lightly and avoid pore-clogging SPFs.',
      cta: 'Mark as done',
      action: 'mark-done',
    },
  },
  fertile: {},
  ovulation: {
    'Acne / Pimples': acneOvulation,
  },
  luteal: {
    'Acne / Pimples': acneLuteal,
    'Hair Thinning / Loss': hairAny,
    'Dry / Itchy Skin': drySkinLuteal,
    'Excess Facial / Body Hair': {
      title: 'Soothing removal',
      body: 'If excess hair bothers you during luteal changes, choose a soothing method and avoid harsh waxing pre-period.',
      cta: 'Mark as done',
      action: 'mark-done',
    },
  },
};