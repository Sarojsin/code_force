import { api, unwrap } from './client';

import type { LoginResponse, User } from 'src/types/api';

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    return unwrap<LoginResponse>(
      api.post('/auth/login', { email, password, device_info: { platform: 'web-admin' } }),
    );
  },

  async me(): Promise<User> {
    return unwrap<User>(api.get('/users/me'));
  },

  async logout(refreshToken?: string | null): Promise<void> {
    try {
      await api.post('/auth/logout', { refresh_token: refreshToken ?? undefined });
    } catch {
      // Logout is best-effort — clear local tokens regardless.
    }
  },
};
