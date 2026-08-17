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
  cycle_type?: string;
  is_correction?: boolean;
  corrected_prediction_id?: string | null;
  created_at: string;
}

export interface CalendarResponse {
  days: Record<string, string>;
  predictions?: PredictionDetail | null;
  next_period_in_days?: number | null;
  needs_checkin?: boolean;
  predicted_cycle_length?: number | null;
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
  predicted_cycle_length?: number | null;
}

export interface PredictionListResponse {
  prediction: PredictionDetail | null;
  days_until: number | null;
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
  avg_period_length_days?: number | null;
  cycle_length_std_dev_days?: number | null;
  avg_ovulation_day?: number | null;
  avg_sleep_hours?: number | null;
  avg_pain_level?: number | null;
  avg_energy_level?: number | null;
}

export interface PredictionHistoryItem {
  id: string;
  month: string;
  predicted_date: string;
  actual_date: string | null;
  delta_days: number | null;
  on_time: boolean;
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

// ---------------------------------------------------------------------------
// Day observations (cycle_days) — DayDetailSheet
// Mirrors backend DayUpsert / DayResponse / SymptomResponse / MedicationResponse.
// ---------------------------------------------------------------------------

/** Payload entry for one symptom selection (name from the master table). */
export interface DaySymptomIn {
  symptom: string;
  severity: number;
}

/** Payload entry for one medication selection (name from the master table). */
export interface DayMedicationIn {
  name: string;
  dose?: string | null;
  taken_at?: string | null;
}

/** Resolved symptom on a day row (from GET /cycle/days). */
export interface DaySymptomLog {
  id: string;
  name: string;
  category: string;
  icon?: string | null;
  severity: number;
}

/** Resolved medication on a day row (from GET /cycle/days). */
export interface DayMedicationLog {
  id: string;
  name: string;
  category: string;
  dose?: string | null;
  taken_at?: string | null;
}

export interface DailyDay {
  id: string;
  user_id: string;
  log_date: string;
  mood?: string | null;
  mood_intensity?: number | null;
  pain_level?: number | null;
  energy_level?: number | null;
  sleep_minutes?: number | null;
  water_glasses?: number | null;
  flow_level?: string | null;
  notes?: string | null;
  symptoms: DaySymptomLog[];
  medications: DayMedicationLog[];
  recommendations_completed?: string[];
  created_at: string;
  updated_at: string;
  client_updated_at?: string | null;
}

/** Upsert payload for PUT /cycle/days/{log_date} (all fields optional). */
export interface DayUpsertPayload {
  mood?: string | null;
  mood_intensity?: number | null;
  pain_level?: number | null;
  energy_level?: number | null;
  sleep_minutes?: number | null;
  water_glasses?: number | null;
  flow_level?: string | null;
  notes?: string | null;
  symptoms?: DaySymptomIn[];
  medications?: DayMedicationIn[];
  recommendations_completed?: string[];
}

export interface SymptomMaster {
  id: string;
  name: string;
  category: string;
  icon?: string | null;
  icon_kind?: 'custom' | 'lucide' | null;
  display_order: number;
}

export interface MedicationMaster {
  id: string;
  name: string;
  category: string;
  display_order: number;
}

// ---------------------------------------------------------------------------
// Cycle reports (Cycle_Report-as-a-Service) — mirrors backend ReportData /
// CycleReportResponse / ReportEmptyResponse.
// ---------------------------------------------------------------------------

export interface CycleReportData {
  summary: string;
  regularity_score: number;
  top_symptoms: string[];
  correlation_found: string;
  doctor_note: string;
  avg_cycle_length_days?: number | null;
  avg_period_length_days?: number | null;
  avg_sleep_hours?: number | null;
  avg_pain_level?: number | null;
  common_moods?: Array<{ mood: string; count: number }>;
}

export interface CycleReport {
  id: string;
  cycle_entry_id: string;
  status: 'pending' | 'ready';
  report_data: CycleReportData | null;
  generated_at: string | null;
}

/** Empty-state payload: `report === null` means "no report yet" (never 404). */
export interface ReportEmptyResponse {
  report: null;
  message: string;
}

export type LatestReportResponse = CycleReport | ReportEmptyResponse;

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

  async getPredictionHistory(limit = 12): Promise<PredictionHistoryItem[]> {
    const res = await api.get('/cycle/predictions/history', { params: { limit } });
    return unwrap(res.data).items;
  },

  async getCalendar(monthsBack = 3, monthsForward = 3, today?: string): Promise<CalendarResponse> {
    const res = await api.get('/cycle/calendar', {
      params: { months_back: monthsBack, months_forward: monthsForward, today },
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

  async logCorrection(
    data: {
      period_start_date: string;
      period_end_date?: string;
      symptoms?: string[];
      corrected_prediction_id?: string | null;
      cycle_type?: string;
    },
    idempotencyKey?: string,
    clientUpdatedAt?: string,
  ): Promise<any> {
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    if (clientUpdatedAt) headers['X-Client-Updated-At'] = clientUpdatedAt;
    const res = await api.post('/cycle/corrections', data, { headers });
    return unwrap(res.data);
  },

  async logSnooze(predictedCycleId: string, dayOffset: number): Promise<any> {
    const res = await api.post('/cycle/snooze', {
      predicted_cycle_id: predictedCycleId,
      day_offset: dayOffset,
    });
    return unwrap(res.data);
  },

  async getDays(start: string, end: string): Promise<DailyDay[]> {
    const res = await api.get('/cycle/days', { params: { start, end } });
    return unwrap(res.data);
  },

  async upsertDay(logDate: string, data: DayUpsertPayload): Promise<DailyDay> {
    const res = await api.put(`/cycle/days/${logDate}`, data);
    return unwrap(res.data);
  },

  async getSymptoms(): Promise<SymptomMaster[]> {
    const res = await api.get('/cycle/symptoms');
    return unwrap(res.data);
  },

  async getMedications(): Promise<MedicationMaster[]> {
    const res = await api.get('/cycle/medications');
    return unwrap(res.data);
  },

  /** POST /cycle/reports — enqueue generation for a closed cycle (202). */
  async requestReport(cycleEntryId: string): Promise<CycleReport> {
    const res = await api.post('/cycle/reports', { cycle_entry_id: cycleEntryId });
    return unwrap(res.data);
  },

  /**
   * POST /cycle/reports?sync=true — DB-first on-demand generation.
   * Returns the stored report immediately when one exists (no LLM call);
   * otherwise generates inline (Groq / rule-based) and returns status: "ready".
   */
  async requestReportSync(cycleEntryId: string): Promise<CycleReport> {
    const res = await api.post('/cycle/reports', { cycle_entry_id: cycleEntryId }, { params: { sync: true } });
    return unwrap(res.data);
  },

  /**
   * GET /cycle/reports/{cycle_entry_id} — per-cycle read (DB-only, no LLM).
   * Returns null when no report is stored (ReportEmptyResponse.report === null).
   */
  async getReportForEntry(cycleEntryId: string): Promise<CycleReport | null> {
    const res = await api.get(`/cycle/reports/${cycleEntryId}`);
    const payload = unwrap(res.data) as LatestReportResponse;
    if (payload === null || payload === undefined) return null;
    return 'report' in payload ? payload.report : (payload as CycleReport);
  },

  /**
   * GET /cycle/reports/latest.
   * Returns null when no report is ready yet (ReportEmptyResponse.report === null).
   */
  async getLatestReport(): Promise<CycleReport | null> {
    const res = await api.get('/cycle/reports/latest');
    const payload = unwrap(res.data) as LatestReportResponse;
    if (payload === null || payload === undefined) return null;
    return 'report' in payload ? payload.report : (payload as CycleReport);
  },
};
