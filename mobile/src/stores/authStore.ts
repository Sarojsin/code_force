import { create } from 'zustand';

import { authService, tokenStore } from 'src/services/api';
import { EncryptedStorage } from 'src/services/storage';
import type { RegisterRequest, User } from 'src/types/auth';

const USER_CACHE_KEY = 'shecare.user';

function isNetworkError(err: any): boolean {
  return err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error') || err?.request === undefined;
}

async function getCachedUser(): Promise<User | null> {
  try {
    const raw = await EncryptedStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

async function setCachedUser(user: User | null): Promise<void> {
  if (!user) {
    await EncryptedStorage.removeItem(USER_CACHE_KEY);
    return;
  }
  await EncryptedStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
}

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
    const access = await tokenStore.getAccess();
    if (!access) {
      set({ isHydrated: true, user: null });
      return;
    }

    try {
      const user = await authService.getMe();
      await setCachedUser(user);
      set({ user, isHydrated: true });
    } catch (err) {
      const status = (err as any)?.response?.status;
      const cached = await getCachedUser();
      // Cached user exists → must have completed onboarding (it gates the main app).
      // Backfill the new field so RootNavigator doesn't fall through to retry.
      if (cached && cached.onboarding_completed === undefined) {
        cached.onboarding_completed = true;
      }
      if (isNetworkError(err) || (status && status >= 500) || status === 429) {
        if (cached) {
          set({ user: cached, isHydrated: true });
          return;
        }
      }
      if (status === 401 || status === 403 || !cached) {
        await tokenStore.clear();
        await setCachedUser(null);
        set({ user: null, isHydrated: true });
      } else {
        set({ user: cached, isHydrated: true });
      }
    }
  },
  reset: async () => {
    await tokenStore.clear();
    await setCachedUser(null);
    set({ user: null });
  },
  login: async (email, password) => {
    const resp = await authService.login(email, password);
    await setCachedUser(resp.user);
    set({ user: resp.user });
  },
  register: async (data) => {
    const resp = await authService.register(data);
    await setCachedUser(resp.user);
    set({ user: resp.user });
  },
}));
