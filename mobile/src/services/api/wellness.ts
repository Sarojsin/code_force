import { api } from './client';
import { ModelVersionResponse } from 'src/services/ml/wellnessTypes';

export interface JournalEntry {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  mood: string | null;
  sentiment_score: number | null;
  sentiment_label: string | null;
  entry_date: string;
  created_at: string;
  updated_at: string;
}

export interface MoodLog {
  id: string;
  user_id: string;
  mood: string;
  intensity: number;
  notes: string | null;
  logged_at: string;
}

export interface BreathingExercise {
  id: string;
  name: string;
  title: string;
  description: string | null;
  technique: string | null;
  duration_seconds: number;
  instructions: Record<string, unknown>;
  audio_url: string | null;
}

export interface BreathSessionComplete {
  id: string;
  user_id: string;
  exercise_id: string;
  completed_at: string;
}

export interface WellnessInsights {
  total_journal_entries: number;
  total_mood_logs: number;
  average_mood_intensity: number | null;
  most_common_mood: string | null;
  recommendation: string | null;
}

export interface JournalAnalysis {
  id: string;
  journal_id: string;
  mood_score: number;
  sentiment: string;
  symptom_mentions: string[];
  crisis_flags: Record<string, boolean>;
  model_version: string;
  inference_time_ms: number;
  created_at: string;
}

export interface SyncAnalysisPayload {
  journal_id: string;
  mood_score: number;
  sentiment: string;
  symptom_mentions: string[];
  crisis_flags: Record<string, boolean>;
  model_version: string;
  inference_time_ms: number;
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

export const wellnessService = {
  async getJournalEntries(limit = 50, offset = 0): Promise<JournalEntry[]> {
    const resp = await api.get('/wellness/journal', { params: { limit, offset } });
    return unwrap(resp.data);
  },

  async getJournalEntry(entryId: string): Promise<JournalEntry> {
    const resp = await api.get(`/wellness/journal/${entryId}`);
    return unwrap(resp.data);
  },

  async createJournalEntry(data: { title?: string | null; content: string; entry_date?: string | null; mood?: string | null }): Promise<JournalEntry> {
    const resp = await api.post('/wellness/journal', data);
    return unwrap(resp.data);
  },

  async deleteJournalEntry(entryId: string): Promise<void> {
    await api.delete(`/wellness/journal/${entryId}`);
  },

  async getMoodLogs(days_back = 30): Promise<MoodLog[]> {
    const resp = await api.get('/wellness/mood/history', { params: { days_back } });
    return unwrap(resp.data);
  },

  async createMoodLog(data: { mood: string; intensity: number; notes?: string | null }): Promise<MoodLog> {
    const resp = await api.post('/wellness/mood', data);
    return unwrap(resp.data);
  },

  async getBreathingExercises(): Promise<BreathingExercise[]> {
    const resp = await api.get('/wellness/breathing-exercises');
    return unwrap(resp.data);
  },

  async completeBreathingSession(exerciseId: string): Promise<BreathSessionComplete> {
    const resp = await api.post(`/wellness/breathing-sessions/${exerciseId}/complete`);
    return unwrap(resp.data);
  },

  async getInsights(): Promise<WellnessInsights> {
    const resp = await api.get('/wellness/insights');
    return unwrap(resp.data);
  },

  async syncJournalAnalysis(data: SyncAnalysisPayload): Promise<JournalAnalysis> {
    const resp = await api.post('/wellness/journal/analysis', data);
    return unwrap(resp.data);
  },

  async getJournalAnalysis(journalId: string): Promise<JournalAnalysis | null> {
    const resp = await api.get(`/wellness/journal/${journalId}/analysis`);
    return unwrap(resp.data);
  },

  async getModelVersion(): Promise<ModelVersionResponse> {
    const resp = await api.get('/api/v1/models/wellness-classifier/version');
    return unwrap(resp.data);
  },

  async downloadModel(version: string): Promise<ArrayBuffer> {
    const resp = await api.get(`/api/v1/models/wellness-classifier/${version}.onnx`, {
      responseType: 'arraybuffer',
    });
    return resp.data as ArrayBuffer;
  },
};
