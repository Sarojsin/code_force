import type { PhaseKey, RecommendationContentRow } from '../types';

/** Phase-locked motivational cards — shown on a normal day (no symptoms, pain < 2). */

export const MOTIVATION_CARDS: Record<PhaseKey, RecommendationContentRow> = {
  menstrual: {
    title: 'Rest is productive',
    body: 'Your period is a natural slow-down. Honor lower energy with warmth, gentle movement and an earlier night.',
    cta: 'Wind down early',
    action: 'mark-done',
  },
  follicular: {
    title: 'Energy is rising',
    body: 'The follicular phase is your fresh-start window. Ride the lift with a short walk or a new idea.',
    cta: 'Take a short walk',
    action: 'walk',
  },
  fertile: {
    title: 'Your body is thriving',
    body: 'The fertile window often brings steady energy and focus — use it for the thing you keep postponing.',
    cta: 'Take a short walk',
    action: 'walk',
  },
  ovulation: {
    title: 'Peak vitality',
    body: 'Ovulation is often your highest-energy day. A brisk walk or a social plan fits beautifully.',
    cta: 'Take a short walk',
    action: 'walk',
  },
  luteal: {
    title: 'Steady over shiny',
    body: 'Luteal days favor routine over novelty. Protect sleep and keep plans gentle — the wave is temporary.',
    cta: 'Wind down early',
    action: 'breathing',
  },
};

/** Gentle comfort cards — pain ≥ 2 but no symptom matched a content row. */

export const COMFORT_CARDS: Record<PhaseKey, RecommendationContentRow> = {
  menstrual: {
    title: 'Warmth soothes',
    body: 'A heat pack on the lower belly and a slow 5-minute stretch ease unlabelled menstrual discomfort.',
    cta: 'Start a 5 min stretch',
    action: 'days-stretch',
  },
  follicular: {
    title: 'Loose, easy movement',
    body: 'Gentle mobility keeps the follicular lift working — hips, spine and a breather outdoors.',
    cta: 'Take a short walk',
    action: 'walk',
  },
  fertile: {
    title: 'Slow strings',
    body: 'Even mild fertile-window aches respond to slow stretching and a steady water intake.',
    cta: 'Start a 5 min stretch',
    action: 'days-stretch',
  },
  ovulation: {
    title: 'Lighten the load',
    body: 'Ovulation tension eases with lighter movement — a walk or supported yoga instead of harder training.',
    cta: 'Take a short walk',
    action: 'walk',
  },
  luteal: {
    title: 'Nurture the build-up',
    body: 'Luteal discomfort is a cue to soften: warmth, gentle movement and earlier nights.',
    cta: 'Wind down early',
    action: 'breathing',
  },
};