import type { PhaseContent, PhaseKey, RecommendationContentRow } from '../types';

/**
 * Pain & discomfort — phase-locked content.
 * Rows are data-only (no logic). Cramps card is additionally gated on the
 * pain band 4–6 in the engine; Lower Back Pain resolves to its own card
 * (no longer a cramps alias — Full eng plan3 §3.2 behavioral fix).
 */

const cramps: RecommendationContentRow = {
  title: 'Heat + gentle stretch',
  body: 'Place a heat pack or warm water bottle on your lower abdomen for 15–20 minutes. Combine with gentle Cat-Cow stretches.',
  cta: 'Log water intake',
  action: 'water',
};

const lowerBack: RecommendationContentRow = {
  title: 'Support your lower back',
  body: 'Apply heat to the lower back and try standing hip circles or forward folds to release deep tension.',
  cta: 'Start a 5 min stretch',
  action: 'days-stretch',
};

const headacheMenstrual: RecommendationContentRow = {
  title: 'Rest in a dark, quiet room',
  body: 'Menstrual headaches often follow estrogen dips. Hydrate, rest in dim light, and use a cool cloth on your forehead.',
  cta: 'Log water intake',
  action: 'water',
};

const headacheFolic: RecommendationContentRow = {
  title: 'Keep a steady rhythm',
  body: 'Rising estrogen keeps headaches away with consistent sleep and meals. Keep caffeine steady and hydrate early.',
  cta: 'Log water intake',
  action: 'water',
};

const headacheLuteal: RecommendationContentRow = {
  title: 'Ease PMS tension',
  body: 'Luteal headaches often pair with tension. Try magnesium-rich snacks and gentle neck rolls before bed.',
  cta: 'Wind down early',
  action: 'breathing',
};

const migraineLuteal: RecommendationContentRow = {
  title: 'Safeguard against the aura spike',
  body: 'Migraine tends to cluster pre-period. Dim lights early, reduce screens, and keep water close before symptoms peak.',
  cta: 'Take a short rest',
  action: 'breathing',
};

const breastMenstrual: RecommendationContentRow = {
  title: 'Wear a supportive bra',
  body: 'Breast tenderness from hormonal shifts eases with a soft, supportive bra and light, layered clothing.',
  cta: 'Mark as done',
  action: 'mark-done',
};

export const PAIN_CONTENT: Record<PhaseKey, PhaseContent> = {
  menstrual: {
    'Abdominal Cramps': cramps,
    'Lower Back Pain': lowerBack,
    Headache: headacheMenstrual,
    Migraine: migraineLuteal,
    'Breast Tenderness': breastMenstrual,
  },
  follicular: {
    'Abdominal Cramps': {
      title: 'Stretch it out',
      body: 'Gently stretch the hips and lower back for 10 minutes. Your follicular phase recovers well with movement.',
      cta: 'Start a stretch',
      action: 'days-stretch',
    },
    'Lower Back Pain': {
      title: 'Mobilize early',
      body: 'Light hip-openers and standing backbends keep new-cycle aches from settling in during the follicular lift.',
      cta: 'Start a 5 min stretch',
      action: 'days-stretch',
    },
    Headache: headacheFolic,
  },
  fertile: {
    'Abdominal Cramps': {
      title: 'Stretch it out',
      body: 'Warm-up-free stretching loosens tension; mid-fertile cramps respond to gentle yoga flow.',
      cta: 'Start a stretch',
      action: 'days-stretch',
    },
    'Lower Back Pain': {
      title: 'Move, don’t rest',
      body: 'Gentle movement and spine stretching beat stillness for fertile-window back aches — try a slow pelvic circle.',
      cta: 'Start a 5 min stretch',
      action: 'days-stretch',
    },
  },
  ovulation: {
    'Abdominal Cramps': {
      title: 'Light yoga',
      body: 'Slow, supported yoga poses quiet cramps without overloading an energetic phase.',
      cta: 'Start a stretch',
      action: 'days-stretch',
    },
    Headache: headacheFolic,
  },
  luteal: {
    'Abdominal Cramps': {
      title: 'Magnesium + Omega-3',
      body: 'Magnesium (banana, pumpkin seeds, leafy greens) and Omega-3 can soften luteal cramps.',
      cta: 'Add a magnesium snack',
      action: 'mark-done',
    },
    'Lower Back Pain': {
      title: 'Prepare for period week',
      body: 'Luteal aching often previews period pain. Stretch your back daily and plan rest for the coming days.',
      cta: 'Wind down early',
      action: 'breathing',
    },
    Headache: headacheLuteal,
    Migraine: migraineLuteal,
    'Breast Tenderness': breastMenstrual,
  },
};