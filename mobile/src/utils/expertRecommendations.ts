import type { PhaseRange } from 'src/utils/cyclePhases';
import type { CycleDay } from 'src/db/schema';
import type { RecommendationAction, RecommendationCard, RecommendationContentRow } from './recommendations';
import { PHASE_MATRIX, GENERAL_MATRIX, MOTIVATION_CARDS, COMFORT_CARDS } from './recommendations';

/**
 * Expert recommendation engine (Full eng plan3) — pure & unit-tested.
 * Full symptom-keyed matrix: phase-locked rows per phase, a phase-agnostic
 * general fallback, plus phase-locked motivation and comfort cards. Returns
 * at most `MAX_CARDS` cards for the `recommendation` tier.
 */

export type { RecommendationAction, RecommendationCard } from './recommendations';

export interface RecommendationInput {
  phaseKey: PhaseRange['key'];
  painLevel: number;
  selectedSymptoms: string[];
  /** Symptom name → normalized severity (1/3/5). Default 3 when absent. */
  severities?: Record<string, number>;
}

export const MAX_CARDS = 3;

/** Alias map — legacy names resolve to canonical master names (behavior fix
 *  plan3 §3.2: Lower Back Pain is NO LONGER a cramps alias; it has its own row). */
const ALIAS_MAP: Record<string, string> = {
  Cramps: 'Abdominal Cramps',
  'Low Energy': 'Fatigue',
};

/** Icons per canon name. Symbols only — the carousel maps them to Lucide. */
const ICON_BY_SYMPTOM: Record<string, string> = {
  'Abdominal Cramps': '🔥',
  'Lower Back Pain': '🦴',
  Headache: '🤕',
  Migraine: '😖',
  'Breast Tenderness': '💗',
  Bloating: '🎈',
  Constipation: '🚧',
  Diarrhea: '💩',
  Nausea: '🤢',
  Vomiting: '🤮',
  'Increased Appetite': '🍽️',
  'Food Cravings': '🍫',
  'Acne / Pimples': '🔴',
  'Oily Skin': '✨',
  'Greasy Hair': '💇',
  'Hair Thinning / Loss': '🪮',
  'Excess Facial / Body Hair': '🌿',
  'Dry / Itchy Skin': '🧴',
  Fatigue: '😴',
  'Low Energy': '🪫',
  'Increased Discharge': '💧',
  'Fluid Retention': '🧊',
  'Weight Gain': '⚖️',
  'Hot Flashes': '🌡️',
  Chills: '🥶',
  Dizziness: '🌀',
  'Trouble Sleeping': '🌙',
  'Sleeping Too Much': '😪',
  'Night Sweats': '🌙',
  'Heart Palpitations': '💓',
  'Feeling Unwell / Weakness': '🥺',
  'Frequent Urination / UTIs': '🚽',
  'Vision Changes': '👁️',
  'Mood Swings': '🎢',
  Irritability: '😤',
  'Anxiety / Nervousness': '😰',
  'Depressed Mood / Sadness': '😔',
  'Tearfulness / Crying Spells': '😢',
  'Brain Fog': '🌫️',
  'Difficulty Concentrating': '🎯',
  'Feeling Overwhelmed': '🌊',
  'Social Withdrawal': '🐢',
  'Reduced Libido': '🦋',
  'Severe Depression / Self-Harm': '🆘',
  'Heavy / Prolonged Bleeding': '🩸',
  'Irregular Cycles': '🔄',
  'Bleeding / Spotting Between Periods': '🩹',
  'Absent Period / Amenorrhea': '⭕',
  'Painful Ovulation': '📌',
  'PMS Symptoms': '🌩️',
  'PMDD (Severe PMS)': '⛈️',
  'Painful Urination': '🔥',
};

const FALLBACK_ICON = '💫';
const DEFAULT_SEVERITY = 3;

/** Pain band for the Cramps card (recommendation tier). */
const CRAMPS_PAIN_MIN = 4;
const CRAMPS_PAIN_MAX = 6;

/** Severity threshold for the heavy-bleeding card (only shown when intense). */
const HEAVY_BLEEDING_SEVERITY_MIN = 5;

/** Severity-gated symptoms: card only emits above the given severity. */
const SEVERITY_GATED: Record<string, number> = {
  'Heavy / Prolonged Bleeding': HEAVY_BLEEDING_SEVERITY_MIN,
};

const PHASE_KEYS = ['menstrual', 'follicular', 'fertile', 'ovulation', 'luteal'] as const;

/** Legacy id slugs — keep persisted `recommendations_completed` ids stable. */
const LEGACY_SLUGS: Record<string, string> = {
  'Abdominal Cramps': 'cramps',
  Fatigue: 'fatigue',
  Bloating: 'bloating',
};

function slugFor(name: string): string {
  return (
    LEGACY_SLUGS[name] ??
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  );
}

function isSeverityGate(name: string, severity: number | undefined): boolean {
  const min = SEVERITY_GATED[name];
  if (min === undefined) return false;
  return (severity ?? DEFAULT_SEVERITY) < min;
}

/**
 * Main entry: map a phase + observed symptoms to up to `MAX_CARDS` cards.
 * Priority: phase-locked row → general fallback → none (skipped).
 * Cramps card additionally requires pain ∈ [4,6]. Heavy bleeding requires
 * severity ≥ 5. Dedupes by stable id and caps at MAX_CARDS.
 */
export function getRecommendations(input: RecommendationInput): RecommendationCard[] {
  const { phaseKey, painLevel, selectedSymptoms, severities } = input;

  // Safety owns the ≥7 band; drop out quietly above the recommendation band.
  if (painLevel >= 7) return [];

  const noSymptoms = selectedSymptoms.length === 0 && painLevel < 2;
  if (noSymptoms) {
    const motivation = MOTIVATION_CARDS[phaseKey];
    return [
      {
        id: `${phaseKey}-motivation`,
        icon: '✨',
        ...motivation,
      },
    ];
  }

  const phaseContent = PHASE_MATRIX[phaseKey] ?? {};
  const cards: RecommendationCard[] = [];
  const seen = new Set<string>();

  const push = (row: RecommendationContentRow, id: string, icon: string): void => {
    if (seen.has(id)) return;
    seen.add(id);
    cards.push({ id, icon, ...row });
  };

  for (const raw of selectedSymptoms) {
    if (cards.length >= MAX_CARDS) break;
    const name = ALIAS_MAP[raw] ?? raw;
    let row = phaseContent[name];
    if (!row) row = GENERAL_MATRIX[name];
    if (!row) continue;

    if (isSeverityGate(name, severities?.[name])) continue;
    if (
      name === 'Abdominal Cramps' &&
      (painLevel < CRAMPS_PAIN_MIN || painLevel > CRAMPS_PAIN_MAX)
    ) {
      continue;
    }

    const inPhase = phaseContent[name] !== undefined;
    const id = inPhase ? `${phaseKey}-${slugFor(name)}` : `general-${slugFor(name)}`;
    const icon = ICON_BY_SYMPTOM[name] ?? FALLBACK_ICON;
    push(row, id, icon);
  }

  // Pain ≥ 2 but nothing matched → gentle comfort card, phase-locked.
  if (cards.length === 0 && painLevel >= 2) {
    const comfort = COMFORT_CARDS[phaseKey];
    push(comfort, `${phaseKey}-comfort`, '💫');
  }

  return cards.slice(0, MAX_CARDS);
}

/** Compatibility export — the 5 canonical phase keys in order. */
export const RECOMMENDATION_PHASE_KEYS = PHASE_KEYS;
export type RecommendationActionAlias = RecommendationAction;

/**
 * Single defensive mapping layer (plan5 Note 4): converts a `CycleDay` row into
 * engine input WITHOUT throwing on missing/null fields. Every read falls back to
 * a safe empty value before reaching `getRecommendations`.
 *
 * Note: `CycleDay` has no `cyclePhaseKey` column — the phase comes from the
 * caller's `CurrentCycleState.phaseKey` (absorbed divergence, plan5 §3.2).
 */
export function getRecommendationInputFromDay(
  day: CycleDay | null | undefined,
  phaseKey: PhaseRange['key'],
): RecommendationInput {
  const symptomRows = day?.symptoms ?? [];
  const severities: Record<string, number> = {};
  for (const row of symptomRows) {
    if (row && typeof row.name === 'string') {
      severities[row.name] = typeof row.severity === 'number' ? row.severity : 3;
    }
  }
  const painLevel = typeof day?.pain_level === 'number' && day.pain_level >= 0 ? day.pain_level : 0;
  return {
    phaseKey,
    painLevel,
    selectedSymptoms: symptomRows.filter((r) => r && typeof r.name === 'string').map((r) => r.name),
    severities,
  };
}