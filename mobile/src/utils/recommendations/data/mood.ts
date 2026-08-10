import type { PhaseContent, PhaseKey, RecommendationContentRow } from '../types';

/** Mood & mind — phase-locked content (PMS-heavy phases get real UX). */

const moodSwingsLuteal: RecommendationContentRow = {
  title: 'Name the wave',
  body: 'Big mood shifts in the luteal phase are hormonal — name the feeling, slow down, and postpone hard decisions.',
  cta: 'Try 2 min breathing',
  action: 'breathing',
};

const moodSwingsMood: RecommendationContentRow = {
  title: 'Mood-first rest',
  body: 'Menstrual lows respond to sleep consistency and low-stimulus evenings — let your pace drop without guilt.',
  cta: 'Wind down early',
  action: 'mark-done',
};

const anxietyLuteal: RecommendationContentRow = {
  title: 'Box-breath the spike',
  body: 'Luteal anxiety peaks with cortisol jitter — breathe in 4, hold 4, out 4. Grounding beats rumination.',
  cta: 'Try 2 min breathing',
  action: 'breathing',
};

const irritabilityLuteal: RecommendationContentRow = {
  title: 'Cool the fuse',
  body: 'Irritability rises with PMS. Step away for a walk or a glass of water before responding.',
  cta: 'Take a short walk',
  action: 'walk',
};

const brainFogAny: RecommendationContentRow = {
  title: 'Shrink the day',
  body: 'Brain fog gets worse with overload — pick one priority, move your body, and let the rest wait.',
  cta: 'Take a short walk',
  action: 'walk',
};

const tearyBearer: RecommendationContentRow = {
  title: 'Let it pass gently',
  body: 'Tearfulness is common and valid. Rest, warmth, and talking to one person you trust can ease it.',
  cta: 'Try 2 min breathing',
  action: 'breathing',
};

const lowLibidoAny: RecommendationContentRow = {
  title: 'Reconnect at your pace',
  body: 'Libido dips across the cycle are normal — focus on closeness, not performance, when desire is low.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const overwhelmAny: RecommendationContentRow = {
  title: 'Cut one commitment',
  body: 'Feeling overwhelmed? Drop the least essential task today and protect a meal and a break.',
  cta: 'Take a short walk',
  action: 'walk',
};

export const MOOD_CONTENT: Record<PhaseKey, PhaseContent> = {
  menstrual: {
    'Mood Swings': moodSwingsMood,
    'Anxiety / Nervousness': anxietyLuteal,
    'Tearfulness / Crying Spells': tearyBearer,
    'Depressed Mood / Sadness': tearyBearer,
  },
  follicular: {},
  fertile: {},
  ovulation: {},
  luteal: {
    'Mood Swings': moodSwingsLuteal,
    'Anxiety / Nervousness': anxietyLuteal,
    Irritability: irritabilityLuteal,
    'Brain Fog': brainFogAny,
    'Feeling Overwhelmed': overwhelmAny,
    'Tearfulness / Crying Spells': tearyBearer,
    'Reduced Libido': lowLibidoAny,
    'Social Withdrawal': {
      title: 'Keep one small anchor',
      body: 'Social withdrawal in the luteal phase is common — hold one low-pressure connection rather than all of them.',
      cta: 'Mark as done',
      action: 'mark-done',
    },
  },
};