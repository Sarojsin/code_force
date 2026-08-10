import type { PhaseRange } from 'src/utils/cyclePhases';

/** Actionable CTA kinds the recommendation engine can emit. */
export type RecommendationAction =
  | 'water'
  | 'breathing'
  | 'days-stretch'
  | 'walk'
  | 'journal'
  | 'doctor'
  | 'mark-done'
  | null;

export interface RecommendationCard {
  /** Stable slug, e.g. "menstrual-cramps" or "general-headache". */
  id: string;
  icon: string;
  title: string;
  body: string;
  cta?: string | null;
  action?: RecommendationAction;
}

/** Content-only row (no id/icon) — composed by the engine at emit time. */
export interface RecommendationContentRow {
  title: string;
  body: string;
  cta?: string | null;
  action?: RecommendationAction;
}

export type PhaseKey = PhaseRange['key'];

/** Phase-locked content keyed by canonical symptom name. */
export interface PhaseContent {
  [symptom: string]: RecommendationContentRow;
}