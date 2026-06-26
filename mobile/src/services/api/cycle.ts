import { api, ApiSuccess } from './client';

export interface CycleEntry {
  id: string;
  user_id: string;
  period_start_date: string;
  period_end_date?: string | null;
  flow_intensity?: string | null;
  symptoms?: string[];
  mood_tags?: string[];
  energy_level?: number | null;
  notes?: string | null;
  created_at: string;
}

export interface CalendarResponse {
  days: Record<string, string>;
  predictions?: PredictionDetail | null;
  next_period_in_days?: number | null;
}

export interface PredictionDetail {
  id: string;
  predicted_next_period_start: string;
  predicted_period_end?: string | null;
  predicted_fertile_window_start?: string | null;
  predicted_fertile_window_end?: string | null;
  model_type: string;
  confidence_score?: number | null;
  confidence_label?: string | null;
  training_data_points: number;
  prediction_window_days?: number | null;
}

export interface PredictionListResponse {
  predictions: PredictionDetail[];
  model_used: string;
  data_quality: string;
}

export interface CycleAnalytics {
  average_cycle_length_days?: number | null;
  shortest_cycle_days?: number | null;
  longest_cycle_days?: number | null;
  common_symptoms: Array<{ symptom: string; count: number }>;
  common_moods: Array<{ mood: string; count: number }>;
  total_entries: number;
}

export interface ModelStatusResponse {
  current_version: number;
  download_url: string;
}

export interface GlobalModel {
  version: number;
  trained_on: string;
  rmse: number;
  mae?: number;
  feature_names: string[];
  coefficients: Record<string, number>;
  scaler: Record<string, any>;
}

function unwrap<T>(payload: ApiSuccess<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiSuccess<T>).data;
  }
  return payload as T;
}

export const cycleService = {
  async getEntries(params?: { limit?: number; offset?: number; months_back?: number }): Promise<CycleEntry[]> {
    const res = await api.get('/cycle/entries', { params });
    return unwrap(res.data);
  },

  async createEntry(data: Partial<CycleEntry>): Promise<CycleEntry> {
    const res = await api.post('/cycle/entries', data);
    return unwrap(res.data);
  },

  async updateEntry(id: string, data: Partial<CycleEntry>): Promise<CycleEntry> {
    const res = await api.put(`/cycle/entries/${id}`, data);
    return unwrap(res.data);
  },

  async getPredictions(): Promise<PredictionListResponse> {
    const res = await api.get('/cycle/predictions');
    return unwrap(res.data);
  },

  async getCalendar(monthsBack = 3, monthsForward = 3): Promise<CalendarResponse> {
    const res = await api.get('/cycle/calendar', {
      params: { months_back: monthsBack, months_forward: monthsForward },
    });
    return unwrap(res.data);
  },

  async getAnalytics(): Promise<CycleAnalytics> {
    const res = await api.get('/cycle/analytics');
    return unwrap(res.data);
  },

  async getModelStatus(): Promise<ModelStatusResponse> {
    const res = await api.get('/cycle/models/status');
    return unwrap(res.data);
  },

  async downloadModel(version: number): Promise<GlobalModel> {
    const res = await api.get(`/cycle/models/download/global_model_v${version}.json`);
    return res.data;
  },

  async logCorrection(data: {
    period_start_date: string;
    period_end_date?: string;
    symptoms?: string[];
    corrected_prediction_id?: string | null;
  }): Promise<any> {
    const res = await api.post('/cycle/corrections', data);
    return unwrap(res.data);
  },

  async logSnooze(predictedCycleId: string, dayOffset: number): Promise<any> {
    const res = await api.post('/cycle/snooze', {
      predicted_cycle_id: predictedCycleId,
      day_offset: dayOffset,
    });
    return unwrap(res.data);
  },
};
