import { api, ApiSuccess } from './client';

export interface AdminUser {
  id: string;
  phone_number: string;
  display_name?: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface RoleUpdate {
  role: string;
}

export interface NurseVerificationResponse {
  message: string;
  nurse_id: string;
  verified: boolean;
}

export interface DashboardAnalytics {
  total_users: number;
  active_users_today: number;
  total_alerts: number;
  new_users_this_week: number;
  sos_triggered_today: number;
}

export interface BroadcastRequest {
  title: string;
  message: string;
  target_roles?: string[] | null;
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

export const adminService = {
  async getUsers(params?: PaginationParams): Promise<AdminUser[]> {
    const resp = await api.get<ApiSuccess<AdminUser[]> | AdminUser[]>('/admin/users', { params });
    return unwrap(resp.data);
  },

  async updateUserRole(userId: string, data: RoleUpdate): Promise<AdminUser> {
    const resp = await api.put<ApiSuccess<AdminUser> | AdminUser>(`/admin/users/${userId}/role`, data);
    return unwrap(resp.data);
  },

  async verifyNurse(nurseId: string): Promise<NurseVerificationResponse> {
    const resp = await api.post<ApiSuccess<NurseVerificationResponse> | NurseVerificationResponse>(`/admin/nurses/${nurseId}/verify`);
    return unwrap(resp.data);
  },

  async getDashboardAnalytics(): Promise<DashboardAnalytics> {
    const resp = await api.get<ApiSuccess<DashboardAnalytics> | DashboardAnalytics>('/admin/analytics/dashboard');
    return unwrap(resp.data);
  },

  async sendBroadcast(data: BroadcastRequest): Promise<{ message: string }> {
    const resp = await api.post<ApiSuccess<{ message: string }> | { message: string }>('/admin/system/broadcast', data);
    return unwrap(resp.data);
  },
};
