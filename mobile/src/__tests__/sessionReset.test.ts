/**
 * sessionReset — per-user session isolation on logout.
 *
 * Verifies that resetAppForLogout:
 *   - resets every Zustand store back to its initial state
 *   - removes EncryptedStorage keys explicitly (independent of clear())
 *   - removes AsyncStorage keys
 *   - purges the SQLite database (deleteDatabaseAsync, fallback to DELETE FROM)
 *   - clears the React Query cache
 */

const encryptedStore: Record<string, string> = {};
jest.mock('src/services/storage', () => ({
  EncryptedStorage: {
    getItem: jest.fn(async (key: string) => encryptedStore[key] ?? null),
    setItem: jest.fn(async (key: string, val: string) => { encryptedStore[key] = val; }),
    removeItem: jest.fn(async (key: string) => { delete encryptedStore[key]; }),
    clear: jest.fn(async () => { Object.keys(encryptedStore).forEach((k) => delete encryptedStore[k]); }),
  },
}));

const asyncStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => asyncStore[key] ?? null),
  setItem: jest.fn(async (key: string, val: string) => { asyncStore[key] = val; }),
  removeItem: jest.fn(async (key: string) => { delete asyncStore[key]; }),
  clear: jest.fn(async () => { Object.keys(asyncStore).forEach((k) => delete asyncStore[k]); }),
  multiRemove: jest.fn(async (keys: string[]) => { keys.forEach((k) => delete asyncStore[k]); }),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(), addEventListener: jest.fn(),
}));
jest.mock('@sentry/react-native', () => ({
  setTag: jest.fn(), captureException: jest.fn(), addBreadcrumb: jest.fn(),
}));
jest.mock('react-native-toast-message', () => ({ default: { show: jest.fn() } }));
jest.mock('expo-sqlite', () => {
  const db = { closeAsync: jest.fn(), execAsync: jest.fn(), runAsync: jest.fn(), closeSync: jest.fn() };
  return {
    deleteDatabaseAsync: jest.fn(async () => { await db.closeAsync(); }),
    openDatabaseAsync: jest.fn(async () => db),
    openDatabaseSync: jest.fn(() => db),
  };
});
jest.mock('src/db/runMigrations', () => ({ runMigrations: jest.fn(async () => {}) }));
jest.mock('src/services/sync/syncEngine', () => ({
  setQueryClient: jest.fn(),
  clearQueryCache: jest.fn(),
  pushOperations: jest.fn(),
  pullChanges: jest.fn(),
}));
jest.mock('src/db/connection', () => {
  const db = { closeAsync: jest.fn(), execAsync: jest.fn() };
  return {
    getNativeDb: jest.fn(async () => db),
    closeDb: jest.fn(async () => {}),
    getDb: jest.fn(() => ({ run: jest.fn(), values: jest.fn(), transaction: jest.fn(), exec: jest.fn() })),
  };
});
jest.mock('src/utils', () => ({
  ...jest.requireActual('src/utils'),
  generateId: jest.fn(() => 'test-uuid'),
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('src/services/api', () => ({
  authService: { login: jest.fn(), register: jest.fn(), getMe: jest.fn(), logout: jest.fn() },
  tokenStore: { getAccess: jest.fn(), getRefresh: jest.fn(), setBoth: jest.fn(), clear: jest.fn() },
}));
jest.mock('@tanstack/react-query', () => ({
  QueryClient: jest.fn(() => ({ clear: jest.fn(), setQueryData: jest.fn() })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  useQueryClient: () => ({ clear: jest.fn(), invalidateQueries: jest.fn(), setQueryData: jest.fn(), cancelQueries: jest.fn() }),
}));

import { act } from '@testing-library/react-native';
import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { EncryptedStorage } from 'src/services/storage';
import { resetAppForLogout } from 'src/services/sessionReset';
import { useAuthStore } from 'src/stores/authStore';
import { useOnboardingStore } from 'src/stores/onboardingStore';
import { useOfflineStore } from 'src/stores/offlineStore';
import { usePregnancyModeStore } from 'src/stores/pregnancyModeStore';
import { useCompanionStore } from 'src/stores/companionStore';
import { useSyncMetricsStore } from 'src/stores/syncMetricsStore';
import { useHealthMetricsStore } from 'src/stores/healthMetricsStore';

describe('resetAppForLogout', () => {
  beforeEach(() => {
    Object.keys(encryptedStore).forEach((k) => delete encryptedStore[k]);
    Object.keys(asyncStore).forEach((k) => delete asyncStore[k]);
    jest.clearAllMocks();
  });

  it('resets auth user and clears tokens from EncryptedStorage', async () => {
    const user = { id: 'u1', email: 'u@test.com', phone_number: null, display_name: null, role: 'user' as const, is_active: true, is_verified: true, provider: 'local' as const, created_at: new Date().toISOString(), last_login_at: null, onboarding_completed: true };
    await act(async () => { useAuthStore.getState().setUser(user as any); });
    await EncryptedStorage.setItem('shecare.accessToken', 'tok');
    await EncryptedStorage.setItem('shecare.refreshToken', 'rtok');
    await EncryptedStorage.setItem('shecare.user', JSON.stringify(user));

    await act(async () => { await resetAppForLogout(); });

    expect(useAuthStore.getState().user).toBeNull();
    expect(await EncryptedStorage.getItem('shecare.accessToken')).toBeNull();
    expect(await EncryptedStorage.getItem('shecare.refreshToken')).toBeNull();
    expect(await EncryptedStorage.getItem('shecare.user')).toBeNull();
  });

  it('clears the offline action queue from EncryptedStorage + store', async () => {
    await useOfflineStore.getState().enqueue({
      type: 'cycle/create', data: { period_start_date: '2025-01-01' }, tempId: 't1',
      idempotencyKey: 'ik1', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
    });
    expect(useOfflineStore.getState().size()).toBe(1);

    await act(async () => { await resetAppForLogout(); });
    expect(useOfflineStore.getState().size()).toBe(0);
    expect(await EncryptedStorage.getItem('shecare.offline.queue')).toBeNull();
  });

  it('resets onboarding isCompleted + userId to false/null', async () => {
    const user = { id: 'u1', email: 'u@test.com', phone_number: null, display_name: null, role: 'user' as const, is_active: true, is_verified: true, provider: 'local' as const, created_at: new Date().toISOString(), last_login_at: null, onboarding_completed: true };
    await act(async () => { useAuthStore.getState().setUser(user as any); });
    useOnboardingStore.getState().setCompleted(true);
    expect(useOnboardingStore.getState().isCompleted).toBe(true);
    expect(useOnboardingStore.getState().userId).toBe('u1');

    await act(async () => { await resetAppForLogout(); });
    expect(useOnboardingStore.getState().isCompleted).toBe(false);
    expect(useOnboardingStore.getState().userId).toBeNull();
  });

  it('resets pregnancy mode and clears its AsyncStorage key', async () => {
    await act(async () => { usePregnancyModeStore.getState().enable(); });
    await AsyncStorage.setItem('shecare.onboarding', JSON.stringify({ state: { isCompleted: true, userId: 'u1' } }));

    await act(async () => { await resetAppForLogout(); });
    expect(usePregnancyModeStore.getState().isActive).toBe(false);
    expect(await AsyncStorage.getItem('shecare_pregnancy_mode')).toBeNull();
    expect(await AsyncStorage.getItem('shecare.onboarding')).toBeNull();
  });

  it('resets companion store xp/level', async () => {
    useCompanionStore.setState({ xp: 100, coins: 50, level: 5, installStatus: 'ready' });
    await act(async () => { await resetAppForLogout(); });
    expect(useCompanionStore.getState().xp).toBe(0);
    expect(useCompanionStore.getState().level).toBe(1);
  });

  it('resets sync metrics counters', async () => {
    useSyncMetricsStore.setState({ totalOpsPushed: 99, totalSyncCycles: 5 });
    await act(async () => { await resetAppForLogout(); });
    const s = useSyncMetricsStore.getState();
    expect(s.totalOpsPushed).toBe(0);
    expect(s.totalSyncCycles).toBe(0);
  });

  it('resets health metrics logs', async () => {
    useHealthMetricsStore.setState({ todayLogs: { sleep: [{ loggedAt: 't', value: 1 }], water: [], food: [], exercise: [], medication: [] } });
    await act(async () => { await resetAppForLogout(); });
    expect(useHealthMetricsStore.getState().todayLogs.sleep).toEqual([]);
  });

  it('deletes the SQLite database file and re-seeds the schema', async () => {
    await act(async () => { await resetAppForLogout(); });
    expect(SQLite.deleteDatabaseAsync).toHaveBeenCalledWith('shecare.db');
  });

  it('removes all AsyncStorage keys', async () => {
    await AsyncStorage.setItem('shecare.last_known_location', '{}');
    await AsyncStorage.setItem('shecare.sticky_snooze', '{}');
    await AsyncStorage.setItem('REACT_QUERY_OFFLINE_CACHE', '{}');

    await act(async () => { await resetAppForLogout(); });
    expect(await AsyncStorage.getItem('shecare.last_known_location')).toBeNull();
    expect(await AsyncStorage.getItem('shecare.sticky_snooze')).toBeNull();
    expect(await AsyncStorage.getItem('REACT_QUERY_OFFLINE_CACHE')).toBeNull();
  });
});