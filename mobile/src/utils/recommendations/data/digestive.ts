import type { PhaseContent, PhaseKey, RecommendationContentRow } from '../types';

/** Digestive & bloating — phase-locked content. */

const bloatingMenstrual: RecommendationContentRow = {
  title: 'Hydrate, limit salt',
  body: 'Extra water plus a little less sodium eases menstrual bloating fast.',
  cta: 'Log water intake',
  action: 'water',
};

const bloatingFolic: RecommendationContentRow = {
  title: 'Increase fiber',
  body: 'Oats, berries and green vegetables keep digestion steady during follicular.',
  cta: 'Add a fiber snack',
  action: 'mark-done',
};

const bloatingOvulation: RecommendationContentRow = {
  title: 'Drink more water',
  body: 'Drink an extra glass between meals to ease ovulation bloating.',
  cta: 'Log water intake',
  action: 'water',
};

const bloatingLuteal: RecommendationContentRow = {
  title: 'Reduce carbs/sodium',
  body: 'Cut bloat by banking sodium and refined carbs; favor small, frequent, fibrous meals.',
  cta: 'Swap a high-salt snack',
  action: 'mark-done',
};

const nauseaAny: RecommendationContentRow = {
  title: 'Sip ginger, eat small',
  body: 'Sip ginger tea and eat small, bland, frequent meals — a few crackers can settle a queasy stomach.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const diarrheaAny: RecommendationContentRow = {
  title: 'Rehydrate + bland foods',
  body: 'Replace fluids with an oral rehydration drink and stick to easy foods like rice, toast and banana.',
  cta: 'Log water intake',
  action: 'water',
};

const constipationLuteal: RecommendationContentRow = {
  title: 'Magnesium + fiber',
  body: 'Luteal progesterone slows transit. Add magnesium and water-rich fruit to help things move.',
  cta: 'Log water intake',
  action: 'water',
};

export const DIGESTIVE_CONTENT: Record<PhaseKey, PhaseContent> = {
  menstrual: {
    Bloating: bloatingMenstrual,
    Nausea: nauseaAny,
    Diarrhea: diarrheaAny,
  },
  follicular: {
    Bloating: bloatingFolic,
    Constipation: {
      title: 'Fiber-rich mornings',
      body: 'Start the day with oats or chia to keep digestion steady in the follicular window.',
      cta: 'Add a fiber snack',
      action: 'mark-done',
    },
  },
  fertile: {
    Bloating: bloatingFolic,
    Constipation: {
      title: 'Hydrate + fiber',
      body: 'Fertile-window bloating and sluggishness ease with extra water and a fiber boost.',
      cta: 'Log water intake',
      action: 'water',
    },
  },
  ovulation: {
    Bloating: bloatingOvulation,
  },
  luteal: {
    Bloating: bloatingLuteal,
    Constipation: constipationLuteal,
    Nausea: nauseaAny,
  },
};