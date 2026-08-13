/**
 * Shared keyword → Luna reply path (luna plan Phase 3 / Phase 7b).
 *
 * Both the chat `simulateAIResponse` text branch and the Home always-on
 * listening branch resolve user text through the SAME keywords and card
 * formatting, so a spoken "today's tip" reply matches the typed one.
 */
export const INSIGHT_KEYWORDS = [
  'health',
  'tip',
  'today',
  'period',
  'cramps',
  'energy',
  'mood',
  'sleep',
];

/** True when `text` mentions any of the recommendation-branch keywords. */
export function matchesInsightKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return INSIGHT_KEYWORDS.some((k) => lower.includes(k));
}

/**
 * Formats the today's-recommendation card into reply text.
 * Returns null when there's no usable card today (nothing to say).
 */
export function buildInsightReply(card: {
  title: string;
  body: string;
  cta?: string | null;
} | null): string | null {
  if (!card) {
    return null;
  }
  return `${card.title}: ${card.body}${card.cta ? ` ${card.cta}` : ''}`;
}

/**
 * Full response for the chat branch, including the medical disclaimer.
 * Returns null when the query is not a keyword hit or there is no card.
 */
export function buildInsightReplyWithDisclaimer(card: {
  title: string;
  body: string;
  cta?: string | null;
} | null): string | null {
  const reply = buildInsightReply(card);
  if (!reply) {
    return null;
  }
  return `${reply}\n\n⚕️ I'm AI-powered and not a substitute for professional medical advice.`;
}