import { ALIAS_MAP } from 'src/utils/expertRecommendations';
import type { NurseContent } from 'src/services/api/nurse_content';

/**
 * Pure content-recommendation engine (DayDetailSheet → VideoLibrary plan).
 * Scores nurse content against recently logged symptoms using a curated
 * symptom → keyword map plus a word-split fallback. Framework-free so it is
 * unit-testable without React Native mocks.
 */

/**
 * Curated canonical symptom → search keywords (plan sanity check #3).
 * Kept small on purpose — the fallback word-split covers any symptom without
 * an entry. Expand over time as new symptoms are logged.
 */
const SYMPTOM_KEYWORDS: Record<string, string[]> = {
  'Abdominal Cramps': ['cramps', 'abdominal', 'period pain', 'menstrual'],
  'Lower Back Pain': ['back pain', 'lumbar', 'spine'],
  Headache: ['headache', 'head pain', 'migraine'],
  Migraine: ['migraine', 'headache', 'head pain'],
  Fatigue: ['fatigue', 'energy', 'tired', 'exhaustion'],
  'Low Energy': ['fatigue', 'energy', 'tired', 'exhaustion'],
  Bloating: ['bloating', 'bloat', 'gas', 'swollen'],
  Nausea: ['nausea', 'queasy', 'sick'],
  'Trouble Sleeping': ['sleep', 'insomnia', 'restless'],
  'Sleeping Too Much': ['sleep', 'oversleep', 'rest'],
  'Mood Swings': ['mood', 'emotional', 'irritability'],
  Irritability: ['mood', 'irritability', 'emotional'],
  'Anxiety / Nervousness': ['anxiety', 'stress', 'calm', 'nervous'],
  'Depressed Mood / Sadness': ['depression', 'sadness', 'mood', 'mental health'],
  'Brain Fog': ['brain fog', 'focus', 'concentration', 'mental clarity'],
  'Heart Palpitations': ['heart', 'palpitations', 'anxiety'],
  'Breast Tenderness': ['breast', 'tenderness', 'chest'],
  'Hot Flashes': ['hot flash', 'sweating', 'temperature'],
  'Heavy / Prolonged Bleeding': ['heavy bleeding', 'period', 'menstrual', 'blood'],
  'Painful Ovulation': ['ovulation', 'ovary', 'pain'],
  'Acne / Pimples': ['acne', 'pimples', 'skin', 'breakout'],
  'Hair Thinning / Loss': ['hair', 'thinning', 'hair loss'],
};

/** Generic words unlikely to discriminate content — dropped from word-split. */
const STOPWORDS = new Set(['and', 'or', 'the', 'a', 'an', 'of', 'in', 'on', 'with']);

/** Max results in the `recommended` tier (keeps the carousel tight). */
export const MAX_RECOMMENDED = 12;

/** Resolve a (possibly legacy) symptom name to its canonical master name. */
export function resolveSymptomName(name: string): string {
  return ALIAS_MAP[name] ?? name;
}

/** Curated keywords for a canonical name, else fallback word-split (lowercased). */
export function getKeywordsForSymptom(name: string): string[] {
  const canonical = resolveSymptomName(name);
  const curated = SYMPTOM_KEYWORDS[canonical];
  if (curated && curated.length > 0) return curated;
  return canonical
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * Simple hit count across title + description + tags + category
 * (plan sanity check #4 — v1 has NO weighting).
 */
export function scoreContent(content: NurseContent, keywords: string[]): number {
  const haystack = [
    content.title,
    content.description ?? '',
    (content.tags ?? []).join(' '),
    content.category ?? '',
  ]
    .join(' ')
    .toLowerCase();

  let score = 0;
  for (const keyword of keywords) {
    if (haystack.includes(keyword.toLowerCase())) score += 1;
  }
  return score;
}

function byPublishedDesc(a: NurseContent, b: NurseContent): number {
  const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
  const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
  return tb - ta;
}

export interface RecommendResult {
  /** Score > 0, best matches first. */
  recommended: NurseContent[];
  /** Everything with score 0, newest first. */
  general: NurseContent[];
  /** Canonical symptom names that produced matches (score > 0 on something). */
  matchedSymptoms: string[];
  /** True when the user has logged symptoms in the window (plan §6). */
  hasData: boolean;
}

/**
 * Score all content against the logged symptom names. Content order is
 * preserved within each tier (sorted by published_at desc). Empty symptoms →
 * everything lands in `general`, `hasData: false`.
 */
export function recommendContents(
  contents: NurseContent[],
  symptomNames: string[],
): RecommendResult {
  const uniqueSymptoms = [...new Set(symptomNames.map((n) => n.trim()).filter((n) => n.length > 0))];

  if (uniqueSymptoms.length === 0) {
    return {
      recommended: [],
      general: [...contents].sort(byPublishedDesc),
      matchedSymptoms: [],
      hasData: false,
    };
  }

  const keywordSets = uniqueSymptoms.map((name) => ({
    name: resolveSymptomName(name),
    keywords: getKeywordsForSymptom(name),
  }));

  const recommended: NurseContent[] = [];
  const general: NurseContent[] = [];
  const matched = new Set<string>();

  for (const content of contents) {
    let best = 0;
    let bestSymptom: string | null = null;
    for (const { name, keywords } of keywordSets) {
      const s = scoreContent(content, keywords);
      if (s > best) {
        best = s;
        bestSymptom = name;
      }
    }
    if (best > 0 && bestSymptom) {
      recommended.push(content);
      matched.add(bestSymptom);
    } else {
      general.push(content);
    }
  }

  recommended.sort(byPublishedDesc);
  general.sort(byPublishedDesc);

  return {
    recommended: recommended.slice(0, MAX_RECOMMENDED),
    general,
    matchedSymptoms: [...matched],
    hasData: true,
  };
}
