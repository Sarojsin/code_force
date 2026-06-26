import { api, ApiSuccess } from './client';

export interface FamilyLink {
  id: string;
  user_id: string;
  linked_user_id?: string | null;
  status: string;
  permissions: string[];
  created_at: string;
}

export interface InviteToken {
  token: string;
  expires_at: string;
}

export interface InviteInfo {
  inviter_name: string;
  inviter_phone: string;
  expires_at: string;
}

export interface PermissionsUpdate {
  permissions: string[];
}

function unwrap<T>(payload: ApiSuccess<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiSuccess<T>).data;
  }
  return payload as T;
}

export const familyService = {
  async getLinks(): Promise<FamilyLink[]> {
    const resp = await api.get<ApiSuccess<FamilyLink[]> | FamilyLink[]>('/family/links');
    return unwrap(resp.data);
  },

  async generateInvite(): Promise<InviteToken> {
    const resp = await api.post<ApiSuccess<InviteToken> | InviteToken>('/family/link/generate');
    return unwrap(resp.data);
  },

  async getInviteInfo(token: string): Promise<InviteInfo> {
    const resp = await api.get<ApiSuccess<InviteInfo> | InviteInfo>(`/family/link/${token}/info`);
    return unwrap(resp.data);
  },

  async acceptInvite(token: string): Promise<FamilyLink> {
    const resp = await api.post<ApiSuccess<FamilyLink> | FamilyLink>(`/family/link/${token}/accept`);
    return unwrap(resp.data);
  },

  async updatePermissions(linkId: string, data: PermissionsUpdate): Promise<FamilyLink> {
    const resp = await api.put<ApiSuccess<FamilyLink> | FamilyLink>(`/family/links/${linkId}/permissions`, data);
    return unwrap(resp.data);
  },

  async removeLink(linkId: string): Promise<void> {
    await api.delete(`/family/links/${linkId}`);
  },
};
