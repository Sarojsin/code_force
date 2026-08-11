import { create } from 'zustand';

import { authApi } from 'src/api/auth';
import { tokenStore } from 'src/api/client';

import type { User } from 'src/types/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  error: string | null;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  accessToken: null,
  status: 'idle',
  error: null,

  async init() {
    if (!tokenStore.getAccess()) {
      set({ status: 'unauthenticated' });
      return;
    }
    set({ status: 'loading' });
    try {
      const user = await authApi.me();
      set({ user, accessToken: tokenStore.getAccess(), status: 'authenticated' });
    } catch {
      // Interceptor redirects to /login on 401; ensure the state is consistent.
      tokenStore.clear();
      set({ user: null, accessToken: null, status: 'unauthenticated' });
    }
  },

  async login(email, password) {
    set({ status: 'loading', error: null });
    try {
      const resp = await authApi.login(email.trim(), password);
      tokenStore.setBoth(resp.tokens.access_token, resp.tokens.refresh_token);
      if (resp.requires_mfa) {
        throw new Error('This account requires MFA — not supported in the web admin yet.');
      }
      set({ user: resp.user, accessToken: resp.tokens.access_token, status: 'authenticated' });
      return resp.user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed';
      set({ status: 'unauthenticated', error: msg });
      throw err;
    }
  },

  async logout() {
    const refresh = tokenStore.getRefresh();
    await authApi.logout(refresh);
    tokenStore.clear();
    set({ user: null, accessToken: null, status: 'unauthenticated' });
  },
}));
