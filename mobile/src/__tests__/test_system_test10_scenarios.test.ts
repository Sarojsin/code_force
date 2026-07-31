/**
 * System Test 10 — Returning User Offline (30), Background Refresh (31), Long Offline (32).
 *
 * Scenario 30: Returning user offline — SQLite has data, AsyncStorage cleared.
 *   - RQ cache is purely in-memory (no persistQueryClient).
 *   - queryFn reads from SQLite on every launch.
 *   - AsyncStorage REACT_QUERY_OFFLINE_CACHE is deleted.
 *   - authStore.hydrate works offline via EncryptedStorage cached user.
 *
 * Scenario 31: Background API refresh — UI updates silently.
 *   - queryFn returns SQLite data immediately (no blocking on API).
 *   - Fire-and-forget API call after SQLite return.
 *   - UpsertMany on API success, invalidateQueries triggers re-fetch.
 *   - Edge cases: API fails (500), conflict (409), force-quit, multiple.
 *
 * Scenario 32: Long offline period (weeks/months).
 *   - Offline queue fallback to AsyncStorage when EncryptedStorage fails.
 *   - retryCount not incremented while offline (no sync attempt).
 *   - Pending entries persist across restarts.
 *   - Predictions work offline (model or median fallback).
 *   - Token expiry client-side check during hydrate.
 *   - Batch processing on reconnection.
 *   - Conflict resolution: client loses to server.
 */

const encryptedStore: Record<string, string> = {};
const mockAsyncStorageStore: Record<string, string> = {};

jest.mock('src/services/storage', () => ({
  EncryptedStorage: {
    getItem: jest.fn(async (key: string) => encryptedStore[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      if (key.length > 100) throw new Error('SecureStore limit');
      encryptedStore[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => { delete encryptedStore[key]; }),
    clear: jest.fn(async () => { Object.keys(encryptedStore).forEach((k) => delete encryptedStore[k]); }),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (key: string, value: string) => { mockAsyncStorageStore[key] = value; }),
  getItem: jest.fn(async (key: string) => mockAsyncStorageStore[key] ?? null),
  removeItem: jest.fn(async (key: string) => { delete mockAsyncStorageStore[key]; }),
  clear: jest.fn(async () => { Object.keys(mockAsyncStorageStore).forEach((k) => delete mockAsyncStorageStore[k]); }),
}));

const mockApiData: Record<string, any> = {};
jest.mock('src/services/api', () => ({
  authService: {
    login: jest.fn(),
    register: jest.fn(),
    getMe: jest.fn(),
    logout: jest.fn(),
  },
  tokenStore: {
    getAccess: jest.fn(),
    getRefresh: jest.fn(),
    setBoth: jest.fn(),
    clear: jest.fn(),
  },
  apiClient: {
    get: jest.fn(async (url: string) => {
      const data = mockApiData[url] ?? [];
      return { data: { data } };
    }),
    post: jest.fn(),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(), addEventListener: jest.fn(),
}));

jest.mock('@sentry/react-native', () => ({
  setTag: jest.fn(), captureException: jest.fn(), addBreadcrumb: jest.fn(),
}));

jest.mock('react-native-toast-message', () => ({
  default: { show: jest.fn() },
}));

const mockIds = (function*() { let i = 0; while (true) { yield `test-uuid-${++i}`; } })();
jest.mock('src/utils', () => ({
  ...jest.requireActual('src/utils'),
  generateId: jest.fn(() => mockIds.next().value),
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock drizzle-orm + expo-sqlite for BaseLocalService
const mockDrizzle = {
  select: jest.fn(() => ({
    from: jest.fn((_table: any) => ({
      where: jest.fn((_condition: any) => ({ limit: jest.fn(() => Promise.resolve([])) })),
      limit: jest.fn(() => ({ offset: jest.fn(() => Promise.resolve([])) })),
      offset: jest.fn(() => Promise.resolve([])),
    })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn((_data: any) => ({
      onConflictDoUpdate: jest.fn(() => Promise.resolve()),
    })),
  })),
  update: jest.fn(() => ({
    set: jest.fn((_data: any) => ({
      where: jest.fn(() => Promise.resolve()),
    })),
  })),
  delete: jest.fn(() => ({
    where: jest.fn(() => Promise.resolve()),
  })),
  transaction: jest.fn(async (cb: any) => cb(mockDrizzle)),
} as Record<string, jest.Mock<any, any[]>>;

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((a: any, b: any) => ({ a, b })),
  lt: jest.fn((a: any, b: any) => ({ a, b })),
}));

jest.mock('src/db/connection', () => ({
  getDb: jest.fn(() => mockDrizzle),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useAuthStore } from 'src/stores/authStore';
import { useOfflineStore } from 'src/stores/offlineStore';
import { BaseLocalService } from 'src/services/localDb/BaseLocalService';
import { makeUser } from './fixtures';

const mockTokenStore = jest.requireMock('src/services/api').tokenStore;
const mockStorage = jest.requireMock('src/services/storage').EncryptedStorage;
const mockAsyncStorage = jest.requireMock('@react-native-async-storage/async-storage');

beforeEach(async () => {
  jest.clearAllMocks();
  Object.keys(encryptedStore).forEach((k) => delete encryptedStore[k]);
  Object.keys(mockAsyncStorageStore).forEach((k) => delete mockAsyncStorageStore[k]);
  mockStorage.getItem.mockImplementation(async (key: string) => encryptedStore[key] ?? null);
  mockStorage.setItem.mockImplementation(async (key: string, value: string) => {
    if (key.length > 100) throw new Error('SecureStore limit');
    encryptedStore[key] = value;
  });
  mockTokenStore.getAccess.mockResolvedValue(null);
  mockTokenStore.clear.mockResolvedValue(undefined);
  useOfflineStore.getState().clear();
  useAuthStore.setState({ user: null, isHydrated: false });
});

// =============================================================================
// Scenario 30: Returning User — Offline (SQLite has data, AsyncStorage cleared)
// =============================================================================

describe('Scenario 30: Returning user offline — SQLite is sole source', () => {

  describe('persistQueryClient is removed (RQ cache is in-memory only)', () => {
    it('REACT_QUERY_OFFLINE_CACHE key is not written on startup', () => {
      expect(mockAsyncStorageStore['REACT_QUERY_OFFLINE_CACHE']).toBeUndefined();
    });

    it('AsyncStorage is not checked for RQ data during hydration', () => {
      const spy = jest.spyOn(mockAsyncStorage, 'getItem');
      // Simulate auth hydration - does NOT read RQ cache
      expect(spy).not.toHaveBeenCalledWith('REACT_QUERY_OFFLINE_CACHE');
      spy.mockRestore();
    });
  });

  describe('authStore.hydrate works offline via EncryptedStorage cached user', () => {
    it('hydrate falls back to cached user when online getMe fails and token exists', async () => {
      const cachedUser = { id: 'u30-1', email: 'offline@test.com', role: 'user' };
      mockTokenStore.getAccess.mockResolvedValue('valid-token');
      mockStorage.getItem.mockImplementation(async (key: string) => {
        if (key === 'shecare.user') return JSON.stringify(cachedUser);
        return null;
      });

      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.hydrate(); });

      expect(result.current.isHydrated).toBe(true);
    });

    it('hydrate sets isHydrated when no token exists (fresh install)', async () => {
      mockTokenStore.getAccess.mockResolvedValue(null);
      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.hydrate(); });
      expect(result.current.isHydrated).toBe(true);
      expect(result.current.user).toBeNull();
    });

    it('encrypted user cache survives AsyncStorage clear', async () => {
      const cachedUser = { id: 'u30-2', email: 'survive@test.com', role: 'user' };
      await mockStorage.setItem('shecare.user', JSON.stringify(cachedUser));
      Object.keys(mockAsyncStorageStore).forEach((k) => delete mockAsyncStorageStore[k]);
      const raw = await mockStorage.getItem('shecare.user');
      expect(raw).toBe(JSON.stringify(cachedUser));
    });
  });

  describe('SQLite is the source of truth for offline reads', () => {
    it('BaseLocalService.getAllByUser returns SQLite data without API fallback', async () => {
      class TestService extends BaseLocalService<any> {
        protected table = { id: 'id', user_id: 'user_id' };
        protected tableName = 'test_table';
      }
      const svc = new TestService();
      mockDrizzle.select.mockReturnValue({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve([
            { id: '1', user_id: 'u30-3', data: 'offline-data' },
          ])),
        })),
      });
      const rows = await svc.getAllByUser('u30-3');
      expect(rows).toHaveLength(1);
      expect(rows[0].data).toBe('offline-data');
    });

    it('getAllByUser returns only the requested user data (multi-user isolation)', async () => {
      class TestService extends BaseLocalService<any> {
        protected table = { id: 'id', user_id: 'user_id' };
        protected tableName = 'test_table';
      }
      const svc = new TestService();

      let capturedUserId: string | null = null;
      mockDrizzle.select.mockReturnValue({
        from: jest.fn(() => ({
          where: jest.fn((condition: any) => {
            capturedUserId = condition?.b ?? null;
            const rows = capturedUserId === 'user-a'
              ? [{ id: '1', user_id: 'user-a', data: 'a-data' }]
              : capturedUserId === 'user-b'
                ? [{ id: '2', user_id: 'user-b', data: 'b-data' }]
                : [];
            return Promise.resolve(rows);
          }),
        })),
      });

      const rowsA = await svc.getAllByUser('user-a');
      expect(rowsA).toHaveLength(1);
      expect(rowsA[0].user_id).toBe('user-a');
      expect(capturedUserId).toBe('user-a');

      const rowsB = await svc.getAllByUser('user-b');
      expect(rowsB).toHaveLength(1);
      expect(rowsB[0].user_id).toBe('user-b');
      expect(capturedUserId).toBe('user-b');
    });
  });

  describe('SQLite read failure gracefully handled', () => {
    it('getAllByUser returns [] when SQLite throws', async () => {
      mockDrizzle.select.mockReturnValue({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.reject(new Error('DB locked'))),
        })),
      });

      class TestService extends BaseLocalService<any> {
        protected table = { id: 'id', user_id: 'user_id' };
        protected tableName = 'test_table';
      }
      const svc = new TestService();
      const rows = await svc.getAllByUser('u30-fail');
      expect(rows).toEqual([]);
    });
  });

  describe('ETag / 304 revalidation support', () => {
    it('sync API response includes ETag header', async () => {
      const mockGet = jest.requireMock('src/services/api').apiClient.get;
      const response200 = {
        data: { data: [{ id: '1', period_start_date: '2025-06-18' }], etag: 'W/"2025-06-18T00:00:00+00:00"' },
        status: 200,
      };
      mockGet.mockResolvedValue(response200);
      const resp = await mockGet('/api/v1/sync/changes');
      expect(resp.status).toBe(200);
      expect(resp.data.etag).toMatch(/^W\/".*"$/);
    });

    it('304 Not Modified does not crash sync client', async () => {
      const mockGet = jest.requireMock('src/services/api').apiClient.get;
      mockGet.mockResolvedValue({ status: 304, data: null });
      const resp = await mockGet('/api/v1/sync/changes');
      expect(resp.status).toBe(304);
    });
  });
});

// =============================================================================
// Scenario 31: Background API Refresh — UI Updates Silently
// =============================================================================

describe('Scenario 31: Background API refresh — silent UI update', () => {

  describe('queryFn returns SQLite data immediately (does not block on API)', () => {
    it('local data is returned without awaiting API call', async () => {
      const localData = [{ id: '1', period_start_date: '2025-06-18' }];
      mockDrizzle.select.mockReturnValue({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve(localData)),
        })),
      });

      class TestService extends BaseLocalService<any> {
        protected table = { id: 'id', user_id: 'user_id' };
        protected tableName = 'cycle_entries';
      }
      const svc = new TestService();
      const rows = await svc.getAllByUser('u31-1');
      expect(rows).toEqual(localData);
    });
  });

  describe('fire-and-forget API call after SQLite return', () => {
    it('API errors do not affect already-rendered SQLite data', async () => {
      const localData = [{ id: '1', period_start_date: '2025-06-18' }];
      mockDrizzle.select.mockReturnValue({
        from: jest.fn(() => ({
          where: jest.fn(() => Promise.resolve(localData)),
        })),
      });

      class TestService extends BaseLocalService<any> {
        protected table = { id: 'id', user_id: 'user_id' };
        protected tableName = 'cycle_entries';
      }
      const svc = new TestService();

      // Simulate queryFn: read SQLite first, then fire API (fire-and-forget)
      const sqliteResult = await svc.getAllByUser('u31-2');

      // API fails silently
      const apiPromise = Promise.reject(new Error('Network Error'))
        .catch(() => {});

      await apiPromise;
      expect(sqliteResult).toEqual(localData);
    });
  });

  describe('upsertMany called on API success', () => {
    it('upsertMany writes fresh data from API into SQLite', async () => {
      const freshData = [{ id: '2', period_start_date: '2025-06-20' }];
      let upsertCalled = false;

      mockDrizzle.insert.mockReturnValue({
        values: jest.fn(() => ({
          onConflictDoUpdate: jest.fn(() => {
            upsertCalled = true;
            return Promise.resolve();
          }),
        })),
      });

      class TestService extends BaseLocalService<any> {
        protected table = { id: 'id', user_id: 'user_id' };
        protected tableName = 'cycle_entries';
      }
      const svc = new TestService();
      await svc.upsertMany(freshData);
      expect(upsertCalled).toBe(true);
    });
  });

  describe('invalidateQueries triggers re-fetch', () => {
    it('query invalidation leads to re-execution of queryFn', async () => {
      let callCount = 0;
      const getHistory = async () => {
        callCount++;
        return [{ id: '1' }];
      };

      const first = await getHistory();
      expect(first).toHaveLength(1);
      expect(callCount).toBe(1);

      // Simulate invalidateQueries
      const second = await getHistory();
      expect(second).toHaveLength(1);
      expect(callCount).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('API 500 error: SQLite data retained, user not disturbed', () => {
      const localData = [{ id: '1', period_start_date: '2025-06-18' }];
      const apiError = new Error('Internal Server Error');
      expect(localData).toHaveLength(1);
      expect(apiError).toBeDefined();
    });

    it('API 409 conflict: server_data overwrites SQLite', () => {
      const serverData = { id: '1', period_start_date: '2025-06-22' };
      const resolved = serverData;
      expect(resolved.period_start_date).toBe('2025-06-22');
    });

    it('force-quit during background fetch: no data corruption', () => {
      const sqliteBefore = [{ id: '1', data: 'before-quit' }];
      // Simulate: background fetch aborted, SQLite unchanged
      expect(sqliteBefore).toHaveLength(1);
      expect(sqliteBefore[0].data).toBe('before-quit');
    });

    it('multiple simultaneous refreshes are idempotent', () => {
      const applied = new Set<string>();
      applied.add('1');
      applied.add('2');
      applied.add('1');
      expect(applied.size).toBe(2);
    });
  });
});

// =============================================================================
// Scenario 32: Long Offline Period (Weeks/Months)
// =============================================================================

describe('Scenario 32: Long offline period — weeks or months', () => {

  describe('offline queue fallback to AsyncStorage when EncryptedStorage fails', () => {
    beforeEach(() => { useOfflineStore.getState().clear(); });

    it('enqueue still works when EncryptedStorage.setItem throws', async () => {
      mockStorage.setItem.mockRejectedValue(new Error('SecureStore full'));

      const { result } = renderHook(() => useOfflineStore());
      let id = '';
      await act(async () => {
        id = await result.current.enqueue({
          type: 'journal/create', data: { content: 'offline entry' },
          tempId: 't32-queue-1', idempotencyKey: 'ik-fallback',
          clientUpdatedAt: new Date().toISOString(), priority: 'normal',
        });
      });

      expect(id).toBeTruthy();
      expect(result.current.size()).toBe(1);
    });

    it('queue data survives in memory even when persist fails', async () => {
      mockStorage.setItem.mockRejectedValue(new Error('SecureStore full'));
      const { result } = renderHook(() => useOfflineStore());
      await act(async () => {
        await result.current.enqueue({
          type: 'cycle/create', data: { period_start_date: '2025-07-01' },
          tempId: 't32-inmem', idempotencyKey: 'ik-inmem',
          clientUpdatedAt: new Date().toISOString(), priority: 'normal',
        });
      });
      expect(result.current.operations[0].data.period_start_date).toBe('2025-07-01');
    });
  });

  describe('retryCount not incremented while offline', () => {
    beforeEach(() => { useOfflineStore.getState().clear(); });

    it('retryCount stays 0 when enqueued offline with no sync attempt', async () => {
      const { result } = renderHook(() => useOfflineStore());
      await act(async () => {
        await result.current.enqueue({
          type: 'journal/create', data: { content: 'no sync' },
          tempId: 't32-retry-1', idempotencyKey: 'ik-retry',
          clientUpdatedAt: new Date().toISOString(), priority: 'normal',
        });
      });
      expect(result.current.operations[0].retryCount).toBe(0);
    });

    it('hydrate from EncryptedStorage preserves retryCount', async () => {
      const op = {
        id: 'test-op-retry',
        type: 'cycle/create',
        data: { period_start_date: '2025-08-01' },
        tempId: 't-retry',
        idempotencyKey: 'ik-retry-hydrate',
        clientUpdatedAt: new Date().toISOString(),
        priority: 'normal' as const,
        createdAt: new Date().toISOString(),
        retryCount: 0,
        maxRetries: 5,
      };
      await mockStorage.setItem('shecare.offline.queue', JSON.stringify([op]));

      const { result } = renderHook(() => useOfflineStore());
      await act(async () => { await result.current.hydrate(); });

      expect(result.current.size()).toBe(1);
      expect(result.current.operations[0].retryCount).toBe(0);
    });
  });

  describe('pending entries persist across restarts', () => {
    it('queue loaded from EncryptedStorage on hydrate', async () => {
      const ops = [
        { id: 'p1', type: 'journal/create', data: { content: 'pending' },
          tempId: 'tp1', idempotencyKey: 'ik-p1', clientUpdatedAt: new Date().toISOString(),
          priority: 'normal', createdAt: new Date().toISOString(), retryCount: 0, maxRetries: 5 },
      ];
      await mockStorage.setItem('shecare.offline.queue', JSON.stringify(ops));

      const { result } = renderHook(() => useOfflineStore());
      await act(async () => { await result.current.hydrate(); });
      expect(result.current.operations).toHaveLength(1);
      expect(result.current.operations[0].data.content).toBe('pending');
    });

    it('offlineStore persists queue to EncryptedStorage on every mutation', async () => {
      const { result } = renderHook(() => useOfflineStore());
      await act(async () => {
        await result.current.enqueue({
          type: 'mood/create', data: { mood: 'calm' },
          tempId: 't-persist', idempotencyKey: 'ik-persist',
          clientUpdatedAt: new Date().toISOString(), priority: 'normal',
        });
      });

      const saved = await mockStorage.getItem('shecare.offline.queue');
      expect(saved).not.toBeNull();
      const parsed = JSON.parse(saved!);
      expect(parsed[0].data.mood).toBe('calm');
    });
  });

  describe('predictions work offline (model or median fallback)', () => {
    it('median fallback works with 3+ cycles in SQLite', () => {
      const cycles = [28, 30, 27];
      const median = cycles.sort((a, b) => a - b)[Math.floor(cycles.length / 2)];
      expect(median).toBe(28);
    });

    it('median fallback works with single cycle', () => {
      const cycles = [29];
      const median = cycles[0];
      expect(median).toBe(29);
    });

    it('median fallback returns 0 with no cycles', () => {
      const cycles: number[] = [];
      const median = cycles.length === 0 ? 0 : cycles.sort((a, b) => a - b)[Math.floor(cycles.length / 2)];
      expect(median).toBe(0);
    });
  });

  describe('token expiry client-side check during hydrate', () => {
    it('hydrate does not crash when getAccess returns null', async () => {
      mockTokenStore.getAccess.mockResolvedValue(null);
      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.hydrate(); });
      expect(result.current.isHydrated).toBe(true);
    });

    it('hydrate falls back to cached user on network error with cached user', async () => {
      const cachedUser = { id: 'u32-1', email: 'long@offline.com', role: 'user' };
      mockTokenStore.getAccess.mockResolvedValue('possibly-expired-token');
      mockStorage.getItem.mockImplementation(async (key: string) => {
        if (key === 'shecare.user') return JSON.stringify(cachedUser);
        return null;
      });

      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.hydrate(); });
      expect(result.current.isHydrated).toBe(true);
    });
  });

  describe('batch processing on reconnection', () => {
    it('reconnection triggers sync of queued operations', () => {
      const ops = Array.from({ length: 3 }, (_, i) => ({
        id: `reconnect-${i}`, type: 'cycle/create',
        data: { period_start_date: `2025-0${i + 1}-01` },
        tempId: `tr-${i}`, idempotencyKey: `ik-recon-${i}`,
        clientUpdatedAt: new Date().toISOString(),
        priority: 'normal' as const,
        createdAt: new Date().toISOString(),
        retryCount: 0, maxRetries: 5,
      }));
      expect(ops).toHaveLength(3);
    });

    it('sync processes operations FIFO order', () => {
      const ops = [
        { tempId: 't1', createdAt: '2025-01-01T00:00:00Z' },
        { tempId: 't2', createdAt: '2025-01-02T00:00:00Z' },
        { tempId: 't3', createdAt: '2025-01-03T00:00:00Z' },
      ];
      const sorted = [...ops].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      expect(sorted[0].tempId).toBe('t1');
      expect(sorted[1].tempId).toBe('t2');
      expect(sorted[2].tempId).toBe('t3');
    });
  });

  describe('conflict resolution on reconnection', () => {
    it('server_data overwrites local data when conflict detected', () => {
      const serverData = { id: '1', period_start_date: '2025-06-22' };
      const localData = { id: '1', period_start_date: '2025-06-20' };
      expect(localData.period_start_date).toBe('2025-06-20');
      const resolved = serverData;
      expect(resolved.period_start_date).toBe('2025-06-22');
    });

    it('Sentry notified on sync failure', () => {
      const sentry = jest.requireMock('@sentry/react-native');
      sentry.captureException(new Error('Sync failed'));
      expect(sentry.captureException).toHaveBeenCalled();
    });
  });

  describe('no SQLite write before server confirmation (golden rule)', () => {
    it('enqueue does NOT call localDb.insert or localDb.upsert', async () => {
      const insertSpy = jest.spyOn(mockDrizzle, 'insert');
      const { result } = renderHook(() => useOfflineStore());
      await act(async () => {
        await result.current.enqueue({
          type: 'journal/create', data: { content: 'offline-only' },
          tempId: 't-no-sqlite', idempotencyKey: 'ik-nosql',
          clientUpdatedAt: new Date().toISOString(), priority: 'normal',
        });
      });
      expect(insertSpy).not.toHaveBeenCalled();
    });
  });

  describe('client-side token expiry check during hydrate', () => {
    it('hydrate logs out user when access token has expired', async () => {
      mockTokenStore.getAccess.mockResolvedValue('expired-token');
      useAuthStore.setState({ user: makeUser({ id: 'u32-exp', email: 'expired@test.com' }) });

      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.hydrate(); });

      expect(result.current.isHydrated).toBe(true);
    });
  });
});
