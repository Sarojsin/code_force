import { api, ApiSuccess } from './client';

export interface VoiceDailyJournal {
  id: string;
  user_id: string;
  transcription: string;
  audio_duration_seconds?: number | null;
  mood?: string | null;
  created_at: string;
}

export interface VoiceAnalysis {
  id: string;
  entry_id: string;
  sentiment: string;
  sentiment_score: number;
  keywords: string[];
  summary: string;
  analyzed_at: string;
}

function unwrap<T>(payload: ApiSuccess<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiSuccess<T>).data;
  }
  return payload as T;
}

export const voiceService = {
  async submitDailyJournal(data: { audio_base64?: string; transcription?: string; duration_seconds?: number }): Promise<VoiceDailyJournal> {
    const resp = await api.post<ApiSuccess<VoiceDailyJournal> | VoiceDailyJournal>('/voice/daily', data);
    return unwrap(resp.data);
  },

  async getAnalysis(entryId: string): Promise<VoiceAnalysis> {
    const resp = await api.get<ApiSuccess<VoiceAnalysis> | VoiceAnalysis>(`/voice/analysis/${entryId}`);
    return unwrap(resp.data);
  },
};
