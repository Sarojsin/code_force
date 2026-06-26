import { api, ApiSuccess } from './client';

export interface ChatToken {
  token: string;
  user_id: string;
  expires_at: string;
}

export interface ChatLink {
  link_id: string;
  token: string;
  expires_at: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  participant_count: number;
  last_message?: string | null;
  last_message_at?: string | null;
  unread_count: number;
}

function unwrap<T>(payload: ApiSuccess<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiSuccess<T>).data;
  }
  return payload as T;
}

export const chatService = {
  async getToken(): Promise<ChatToken> {
    const resp = await api.get<ApiSuccess<ChatToken> | ChatToken>('/chat/token');
    return unwrap(resp.data);
  },

  async generateLink(): Promise<ChatLink> {
    const resp = await api.post<ApiSuccess<ChatLink> | ChatLink>('/chat/link/generate');
    return unwrap(resp.data);
  },

  async useLink(token: string): Promise<ChatRoom> {
    const resp = await api.post<ApiSuccess<ChatRoom> | ChatRoom>(`/chat/link/${token}/use`);
    return unwrap(resp.data);
  },

  async getRooms(): Promise<ChatRoom[]> {
    const resp = await api.get<ApiSuccess<ChatRoom[]> | ChatRoom[]>('/chat/rooms');
    return unwrap(resp.data);
  },
};
