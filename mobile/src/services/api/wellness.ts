import { api, ApiSuccess } from './client';
import { ModelVersionResponse } from 'src/services/ml/wellnessTypes';

export interface JournalEntry {
  id: string;
  user_id: string;
  title: string;
  content: string;
  mood?: string | null;
  tags?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface MoodLog {
  id: string;
  user_id: string;
  mood: string;
  intensity: number;
  notes?: string | null;
  logged_at: string;
}

export interface BreathingExercise {
  id: string;
  title: string;
  description: string;
  duration_seconds: number;
  technique: string;
}

export interface BreathSessionComplete {
  message: string;
  streak_count: number;
}

export interface WellnessInsight {
  id: string;
  title: string;
  description: string;
  category: string;
  generated_at: string;
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

interface PaginationParams {
  page?: number;
  per_page?: number;
}

function unwrap<T>(payload: ApiSuccess<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiSuccess<T>).data;
  }
  return payload as T;
}

export const wellnessService = {
  async getJournalEntries(params?: PaginationParams): Promise<JournalEntry[]> {
    const resp = await api.get<ApiSuccess<JournalEntry[]> | JournalEntry[]>('/wellness/journal', { params });
    return unwrap(resp.data);
  },

  async createJournalEntry(data: Partial<JournalEntry>): Promise<JournalEntry> {
    const resp = await api.post<ApiSuccess<JournalEntry> | JournalEntry>('/wellness/journal', data);
    return unwrap(resp.data);
  },

  async getMoodLogs(params?: PaginationParams): Promise<MoodLog[]> {
    const resp = await api.get<ApiSuccess<MoodLog[]> | MoodLog[]>('/wellness/mood/history', { params });
    return unwrap(resp.data);
  },

  async createMoodLog(data: Partial<MoodLog>): Promise<MoodLog> {
    const resp = await api.post<ApiSuccess<MoodLog> | MoodLog>('/wellness/mood', data);
    return unwrap(resp.data);
  },

  async getBreathingExercises(): Promise<BreathingExercise[]> {
    const resp = await api.get<ApiSuccess<BreathingExercise[]> | BreathingExercise[]>('/wellness/breathing-exercises');
    return unwrap(resp.data);
  },

  async completeBreathingSession(exerciseId: string): Promise<BreathSessionComplete> {
    const resp = await api.post<ApiSuccess<BreathSessionComplete> | BreathSessionComplete>(
      `/wellness/breathing-sessions/${exerciseId}/complete`,
    );
    return unwrap(resp.data);
  },

  async getInsights(): Promise<WellnessInsight[]> {
    const resp = await api.get<ApiSuccess<WellnessInsight[]> | WellnessInsight[]>('/wellness/insights');
    return unwrap(resp.data);
  },

  async syncJournalAnalysis(data: SyncAnalysisPayload): Promise<JournalAnalysis> {
    const resp = await api.post<ApiSuccess<JournalAnalysis> | JournalAnalysis>(
      '/wellness/journal/analysis',
      data,
    );
    return unwrap(resp.data);
  },

  async getJournalAnalysis(journalId: string): Promise<JournalAnalysis | null> {
    const resp = await api.get<ApiSuccess<JournalAnalysis | null> | JournalAnalysis>(
      `/wellness/journal/${journalId}/analysis`,
    );
    return unwrap(resp.data);
  },

  async getModelVersion(): Promise<ModelVersionResponse> {
    const resp = await api.get<ApiSuccess<ModelVersionResponse> | ModelVersionResponse>(
      '/api/v1/models/wellness-classifier/version',
    );
    return unwrap(resp.data);
  },

  async downloadModel(version: string): Promise<ArrayBuffer> {
    const resp = await api.get(`/api/v1/models/wellness-classifier/${version}.onnx`, {
      responseType: 'arraybuffer',
    });
    return resp.data as ArrayBuffer;
  },
};
