import { api, ApiSuccess } from './client';

export interface PregnancyProfile {
  id: string;
  user_id: string;
  due_date?: string | null;
  weeks_pregnant: number;
  trimester: number;
  baby_name?: string | null;
  blood_type?: string | null;
  allergies?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface PregnancyDailyLog {
  id: string;
  user_id: string;
  date: string;
  symptoms?: Record<string, unknown> | null;
  mood?: string | null;
  weight_kg?: number | null;
  blood_pressure_systolic?: number | null;
  blood_pressure_diastolic?: number | null;
  notes?: string | null;
}

export interface PregnancyMilestone {
  id: string;
  week: number;
  title: string;
  description: string;
  category: string;
  is_completed: boolean;
  completed_at?: string | null;
}

export interface PregnancyRecommendation {
  id: string;
  week: number;
  category: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

function unwrap<T>(payload: ApiSuccess<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiSuccess<T>).data;
  }
  return payload as T;
}

export const pregnancyService = {
  async getProfile(): Promise<PregnancyProfile> {
    const resp = await api.get<ApiSuccess<PregnancyProfile> | PregnancyProfile>('/pregnancy/profile');
    return unwrap(resp.data);
  },

  async updateProfile(data: Partial<PregnancyProfile>): Promise<PregnancyProfile> {
    const resp = await api.put<ApiSuccess<PregnancyProfile> | PregnancyProfile>('/pregnancy/profile', data);
    return unwrap(resp.data);
  },

  async getDailyLogs(): Promise<PregnancyDailyLog[]> {
    const resp = await api.get<ApiSuccess<PregnancyDailyLog[]> | PregnancyDailyLog[]>('/pregnancy/daily-logs');
    return unwrap(resp.data);
  },

  async createDailyLog(data: Partial<PregnancyDailyLog>): Promise<PregnancyDailyLog> {
    const resp = await api.post<ApiSuccess<PregnancyDailyLog> | PregnancyDailyLog>('/pregnancy/daily-log', data);
    return unwrap(resp.data);
  },

  async getMilestones(): Promise<PregnancyMilestone[]> {
    const resp = await api.get<ApiSuccess<PregnancyMilestone[]> | PregnancyMilestone[]>('/pregnancy/milestone');
    return unwrap(resp.data);
  },

  async getRecommendations(): Promise<PregnancyRecommendation[]> {
    const resp = await api.get<ApiSuccess<PregnancyRecommendation[]> | PregnancyRecommendation[]>('/pregnancy/recommendations');
    return unwrap(resp.data);
  },
};
