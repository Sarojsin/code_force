import type { PhaseRange } from 'src/utils/cyclePhases';

/**
 * Red-flag safety engine (plan §7).
 *
 * Pure & unit-tested: no I/O, no React. Maps a day's observation to a four-tier
 * pyramid and the rule flags that justify the top tier.
 *
 * Tiers: `seek_care` → `recommendation` → `maintenance` → `motivation`.
 * Rule 2 (sudden escalation) and Rule 3B (3-cycle history) are DEFERRED —
 * the classifier returns `flags: []` for them today (plan §7).
 */

export type SafetyTier = 'seek_care' | 'recommendation' | 'maintenance' | 'motivation';

export interface RedFlag {
  ruleId: 'rule-1' | 'rule-4';
  message: string;
}

export interface SafetyAssessment {
  tier: SafetyTier;
  flags: RedFlag[];
}

export interface SafetyInput {
  /** Pain slider value 0..10. */
  painLevel: number;
  /** Canonical phase key from `derivePhaseForDate`. */
  phaseKey: PhaseRange['key'] | (string & {});
  /** Selected symptom names (as stored on day rows). */
  selectedSymptomNames: string[];
  /**
   * Reserved for Rule 3B (3-consecutive-cycle gynecologist nudge) — deferred
   * in this PR. Kept in the contract so the UI signature won't churn.
   */
  avgPeriodDays?: number | null;
}

export const SEEK_CARE_THRESHOLD = 7;
export const RECOMMENDATION_PAIN_MIN = 4;
export const RECOMMENDATION_PAIN_MAX = 6;

/** Names that push a low-pain → `recommendation` tier (fatigue / bloating / digestive). */
const RECOMMENDATION_SYMPTOM_NAMES: ReadonlySet<string> = new Set([
  'Fatigue',
  'Low Energy',
  'Bloating',
  'Constipation',
  'Diarrhea',
  'Nausea',
  'Vomiting',
  'Increased Appetite',
  'Food Cravings',
]);

export const RULE_1_MESSAGE =
  "You've logged severe pain that's interfering with your daily life. Period pain shouldn't stop you. " +
  'If this is regular, we recommend speaking to a gynecologist to explore underlying causes like endometriosis.';

export const RULE_4_MESSAGE =
  'You logged pelvic pain — outside your period window. Cycle-independent pain can be a sign of ' +
  'endometriosis or a hormonal imbalance. Worth discussing with your doctor for a clearer picture.';

/**
 * Main classifier. Rule precedence:
 *  1. Rule 1 — severe pain (painLevel ≥ 7) → `seek_care`.
 *  2. Rule 4 — out-of-period pain (Rule 1 ∧ phaseKey ≠ 'menstrual') → `seek_care`,
 *     appended to the flag list with context-sensitive copy.
 *  3. Otherwise tier by pain band / symptom mix.
 */
export function getSafetyForDay(input: SafetyInput): SafetyAssessment {
  const { painLevel, phaseKey, selectedSymptomNames } = input;
  const flags: RedFlag[] = [];

  if (painLevel >= SEEK_CARE_THRESHOLD) {
    flags.push({ ruleId: 'rule-1', message: RULE_1_MESSAGE });
    if (phaseKey !== 'menstrual') {
      flags.push({ ruleId: 'rule-4', message: RULE_4_MESSAGE });
    }
    return { tier: 'seek_care', flags };
  }

  if (
    painLevel >= RECOMMENDATION_PAIN_MIN &&
    painLevel <= RECOMMENDATION_PAIN_MAX
  ) {
    return { tier: 'recommendation', flags };
  }
  if (selectedSymptomNames.some((name) => RECOMMENDATION_SYMPTOM_NAMES.has(name))) {
    return { tier: 'recommendation', flags };
  }

  if (painLevel >= 1 && painLevel <= 3) {
    return { tier: 'maintenance', flags };
  }

  return { tier: 'motivation', flags };
}

/** Compatibility helper — returns the tier key only (for non-blocking logs). */
export function tierOf(input: SafetyInput): SafetyTier {
  return getSafetyForDay(input).tier;
}