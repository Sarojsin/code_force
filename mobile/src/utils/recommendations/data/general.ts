import type { RecommendationContentRow } from '../types';

/**
 * Phase-agnostic fallback content — keyed by canonical symptom name.
 * Used when a symptom has no phase-locked row in the current phase. Covers
 * energy, sleep, general digestive and remaining physical symptoms.
 */

const fatigueAny: RecommendationContentRow = {
  title: 'Recharge smart',
  body: 'Lean into a short nap or a lower-effort evening. Protein and daylight help steady energy.',
  cta: 'Take a short walk',
  action: 'walk',
};

const sleepTooMuchAny: RecommendationContentRow = {
  title: 'Anchor your morning',
  body: 'Oversleeping can feed fatigue. Wake at a set time, get daylight within the hour, and keep naps under 20 min.',
  cta: 'Take a short walk',
  action: 'walk',
};

const troubleSleepAny: RecommendationContentRow = {
  title: 'Wind-down ritual',
  body: 'Shut screens an hour before bed and repeat a calm ritual — dim lights, a warm feet bath, slow breathing.',
  cta: 'Try 2 min breathing',
  action: 'breathing',
};

const nightSweatsAny: RecommendationContentRow = {
  title: 'Layer + hydrate',
  body: 'Night sweats drain your sleep and fluids. Wear breathable layers, keep water close, and note how often it happens.',
  cta: 'Log water intake',
  action: 'water',
};

const hotFlashAny: RecommendationContentRow = {
  title: 'Cool the flash',
  body: 'Hot flashes ease with layered clothing, sips of cold water and slower, deeper breaths through the wave.',
  cta: 'Log water intake',
  action: 'water',
};

const dizzinessAny: RecommendationContentRow = {
  title: 'Sit, sip, rise slowly',
  body: 'Dizziness improves with slow position changes, steady hydration and a small salty snack if blood sugar dips.',
  cta: 'Log water intake',
  action: 'water',
};

const palpitationsAny: RecommendationContentRow = {
  title: 'Calm the beat',
  body: 'Palpitations often follow stress, caffeine or low iron. Sit and breathe slowly — if severe or with chest pain, seek care.',
  cta: 'Try 2 min breathing',
  action: 'breathing',
};

const unwellAny: RecommendationContentRow = {
  title: 'Rest = treatment',
  body: 'Feeling unwell is a signal to downshift — rest, warm hydration and a light meal beat pushing through.',
  cta: 'Log water intake',
  action: 'water',
};

const visionAny: RecommendationContentRow = {
  title: 'Rest the eyes',
  body: 'Eye strain or vision blur warrants a break and a check — rest your eyes, and if it persists talk to a clinician.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const fluidRetentionAny: RecommendationContentRow = {
  title: 'Water beats holding water',
  body: 'Retention often lifts with water, less sodium and light movement — feet up helps your veins keep up.',
  cta: 'Log water intake',
  action: 'water',
};

const dischargeAny: RecommendationContentRow = {
  title: 'Track the shift',
  body: 'Discharge varies through the cycle. Note color and timing — sudden changes with odor warrant a check-up.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const weightGainAny: RecommendationContentRow = {
  title: 'Normalize the number',
  body: 'Cycle-related water shifts can move the scale. Judge a few days of trends, not a single weigh-in.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const chillsAny: RecommendationContentRow = {
  title: 'Warm from the core',
  body: 'Chills need warmth and steady energy — a warm drink, an extra layer and a light meal stabilize temperature.',
  cta: 'Log water intake',
  action: 'water',
};

const constipationAny: RecommendationContentRow = {
  title: 'Water + prunes',
  body: 'Constipation responds to water, prunes or pears, and a gentle walk after meals.',
  cta: 'Log water intake',
  action: 'water',
};

const vomitingAny: RecommendationContentRow = {
  title: 'Rehydrate slowly',
  body: 'After vomiting, sip rehydration fluids a little at a time and rest upright — seek care if you cannot keep fluids down.',
  cta: 'Log water intake',
  action: 'water',
};

const appetiteUpAny: RecommendationContentRow = {
  title: 'Volume out, nutrients in',
  body: 'A bigger appetite is normal pre-period. Prioritize fiber and protein so the increase is nourishing.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const cravingsAny: RecommendationContentRow = {
  title: 'Satisfy the craving mindfully',
  body: 'Cravings spike with hormones. Plate a small mindful portion rather than denying — guilt is the real saboteur.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const acneAny: RecommendationContentRow = {
  title: 'Gentle consistent care',
  body: 'Keep a steady, gentle routine — cleanse lightly and avoid picking, which makes breakouts worse.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const oilySkinAny: RecommendationContentRow = {
  title: 'Light oil control',
  body: 'Use a gentle, non-clogging cleanser and avoid over-washing, which can push oil production up.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const greasyHairAny: RecommendationContentRow = {
  title: 'Routine rhythm',
  body: 'Greasy hair often follows hormone swings — keep your wash rhythm steady and rinse conditioners thoroughly.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const irritabilityAny: RecommendationContentRow = {
  title: 'Cool the fuse',
  body: 'Irritability peaks with PMS. Step away for a walk or a glass of water before responding.',
  cta: 'Take a short walk',
  action: 'walk',
};

const concentrationAny: RecommendationContentRow = {
  title: 'Shrink the day',
  body: 'Concentration dips are common in the luteal phase. Pick one priority and clear the rest.',
  cta: 'Take a short walk',
  action: 'walk',
};

const overwhelmedAny: RecommendationContentRow = {
  title: 'Cut one commitment',
  body: 'Feeling overwhelmed? Drop the least essential task today and protect a meal and a break.',
  cta: 'Take a short walk',
  action: 'walk',
};

const withdrawalAny: RecommendationContentRow = {
  title: 'Keep one small anchor',
  body: 'Social withdrawal is common in the luteal phase — hold one low-pressure connection rather than all of them.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const lowLibidoAny: RecommendationContentRow = {
  title: 'Reconnect at your pace',
  body: 'Libido dips across the cycle are normal — focus on closeness, not performance, when desire is low.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const spottingAny: RecommendationContentRow = {
  title: 'Note the pattern',
  body: 'Spotting can be normal, but logging when it happens helps a clinician spot trends. Rest more this week.',
  cta: 'Mark as done',
  action: 'mark-done',
};

const painfulUrinationAny: RecommendationContentRow = {
  title: 'Drink + track frequency',
  body: 'Painful urination needs fluids and tracking — if it persists or worsens, rule out a UTI with your doctor.',
  cta: 'Log water intake',
  action: 'water',
};

export const GENERAL_MATRIX: Record<string, RecommendationContentRow> = {
  Fatigue: fatigueAny,
  'Low Energy': fatigueAny,
  'Sleeping Too Much': sleepTooMuchAny,
  'Trouble Sleeping': troubleSleepAny,
  'Night Sweats': nightSweatsAny,
  'Hot Flashes': hotFlashAny,
  Dizziness: dizzinessAny,
  'Heart Palpitations': palpitationsAny,
  'Feeling Unwell / Weakness': unwellAny,
  'Vision Changes': visionAny,
  'Fluid Retention': fluidRetentionAny,
  'Increased Discharge': dischargeAny,
  'Weight Gain': weightGainAny,
  Chills: chillsAny,
  Constipation: constipationAny,
  Vomiting: vomitingAny,
  'Increased Appetite': appetiteUpAny,
  'Food Cravings': cravingsAny,
  'Acne / Pimples': acneAny,
  'Oily Skin': oilySkinAny,
  'Greasy Hair': greasyHairAny,
  Irritability: irritabilityAny,
  'Difficulty Concentrating': concentrationAny,
  'Feeling Overwhelmed': overwhelmedAny,
  'Social Withdrawal': withdrawalAny,
  'Reduced Libido': lowLibidoAny,
  'Bleeding / Spotting Between Periods': spottingAny,
  'Painful Urination': painfulUrinationAny,
};