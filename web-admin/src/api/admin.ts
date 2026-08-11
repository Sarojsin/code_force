import { api, unwrap } from './client';

import type { AdminUser, Analytics, BroadcastResult, ContentItem } from 'src/types/api';

export interface ListUsersParams {
  role?: string;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}

export const adminApi = {
  async listUsers(params: ListUsersParams = {}): Promise<AdminUser[]> {
    return unwrap<AdminUser[]>(api.get('/admin/users', { params }));
  },

  async updateRole(userId: string, role: string): Promise<AdminUser> {
    return unwrap<AdminUser>(api.put(`/admin/users/${userId}/role`, { role }));
  },

  async getAnalytics(): Promise<Analytics> {
    return unwrap<Analytics>(api.get('/admin/analytics/dashboard'));
  },

  async broadcast(payload: { title: string; body: string; data?: Record<string, string> }): Promise<BroadcastResult> {
    return unwrap<BroadcastResult>(api.post('/admin/system/broadcast', payload));
  },

  async listPendingContents(): Promise<ContentItem[]> {
    return unwrap<ContentItem[]>(api.get('/admin/contents/pending'));
  },

  async reviewContent(id: string, action: 'approve' | 'reject' | 'publish' | 'unpublish'): Promise<void> {
    await unwrap<{ message: string }>(api.put(`/admin/contents/${id}/${action}`));
  },
};
