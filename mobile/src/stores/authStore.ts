import { create } from 'zustand';

import { authService, tokenStore } from 'src/services/api';
import type { RegisterRequest, User } from 'src/types/auth';

interface AuthState {
  user: User | null;
  isHydrated: boolean;
  setUser: (user: User | null) => void;
  hydrate: () => Promise<void>;
  reset: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isHydrated: false,
  setUser: (user) => set({ user }),
  hydrate: async () => {
    // 1. Check if token exists
    const access = await tokenStore.getAccess();
    if (!access) {
      set({ isHydrated: true, user: null });
      return;
    }

    // 2. Server-authoritative: validate token against /auth/me
    //    NEVER decode/trust the JWT payload on the client side.
    try {
      const user = await authService.getMe();
      set({ user, isHydrated: true });
    } catch {
      // Token invalid or expired — clear everything
      await tokenStore.clear();
      set({ user: null, isHydrated: true });
    }
  },
  reset: async () => {
    await tokenStore.clear();
    set({ user: null });
  },
  login: async (email, password) => {
    const resp = await authService.login(email, password);
    set({ user: resp.user });
  },
  register: async (data) => {
    const resp = await authService.register(data);
    set({ user: resp.user });
  },
}));
