export type SentimentLabel = 'positive' | 'negative' | 'neutral';

export interface CrisisFlags {
  self_harm_mention: boolean;
  abuse_mention: boolean;
  emergency_keyword: boolean;
}

export interface WellnessAnalysis {
  mood_score: number;
  sentiment: SentimentLabel;
  symptom_mentions: string[];
  crisis_flags: CrisisFlags;
  inference_time_ms: number;
}

export interface WellnessSyncPayload {
  journal_id: string;
  created_at: string;
  analysis_id: string;
  analysis: WellnessAnalysis;
  model_version: string;
}

export const SYMPTOM_LABELS = [
  'cramps', 'bloating', 'headache', 'fatigue', 'nausea',
  'backache', 'breast_tenderness', 'acne', 'mood_swings',
  'insomnia', 'cravings', 'dizziness', 'hot_flashes',
  'spotting', 'constipation', 'diarrhea', 'anxiety',
  'irritability', 'low_libido', 'pelvic_pain',
] as const;

export interface ModelVersionResponse {
  version: string;
  size_mb: number;
  checksum_sha256: string;
}

export const SYMPTOM_OPTIONS: { key: string; label: string }[] = [
  { key: 'cramps', label: 'Cramps' },
  { key: 'bloating', label: 'Bloating' },
  { key: 'headache', label: 'Headache' },
  { key: 'fatigue', label: 'Fatigue' },
  { key: 'nausea', label: 'Nausea' },
  { key: 'backache', label: 'Backache' },
  { key: 'breast_tenderness', label: 'Breast Tenderness' },
  { key: 'acne', label: 'Acne' },
  { key: 'mood_swings', label: 'Mood Swings' },
  { key: 'insomnia', label: 'Insomnia' },
  { key: 'cravings', label: 'Cravings' },
  { key: 'dizziness', label: 'Dizziness' },
  { key: 'hot_flashes', label: 'Hot Flashes' },
  { key: 'spotting', label: 'Spotting' },
  { key: 'constipation', label: 'Constipation' },
  { key: 'diarrhea', label: 'Diarrhea' },
  { key: 'anxiety', label: 'Anxiety' },
  { key: 'irritability', label: 'Irritability' },
  { key: 'low_libido', label: 'Low Libido' },
  { key: 'pelvic_pain', label: 'Pelvic Pain' },
] as const;
