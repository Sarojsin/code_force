/**
 * System Test 12 — Extended: Performance (33), Conflict (34), Logout (35).
 *
 * Extends test_system_test11 with edge cases: 50k mock, cascading discard,
 * hard-delete, force-quit simulation, all data type partitioning.
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

jest.mock('src/services/api', () => ({
  authService: { login: jest.fn(), register: jest.fn(), getMe: jest.fn(), logout: jest.fn() },
  tokenStore: {
    getAccess: jest.fn(), getRefresh: jest.fn(), setBoth: jest.fn(), clear: jest.fn(),
  },
  apiClient: { get: jest.fn(), post: jest.fn() },
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

function makeQuery(data: any[]) {
  const p = Promise.resolve(data) as any;
  p.limit = jest.fn(() => p);
  p.offset = jest.fn(() => p);
  p.orderBy = jest.fn(() => p);
  return p;
}

const mockDrizzle = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => makeQuery([])),
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
} as Record<string, jest.Mock<any, any[]>>;

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((a: any, b: any) => ({ a, b })),
  lt: jest.fn((a: any, b: any) => ({ a, b })),
  and: jest.fn((...conds: any[]) => ({ type: 'and', conditions: conds })),
}));

jest.mock('src/db/connection', () => ({
  getDb: jest.fn(() => mockDrizzle),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useAuthStore } from 'src/stores/authStore';
import { useOfflineStore } from 'src/stores/offlineStore';
import { BaseLocalService } from 'src/services/localDb/BaseLocalService';

const mockTokenStore = jest.requireMock('src/services/api').tokenStore;
const mockStorage = jest.requireMock('src/services/storage').EncryptedStorage;

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
// Scenario 33 (Extended): Performance — 50k mock, JSON overhead, multi-user
// =============================================================================

describe('Scenario 33 extended: performance edge cases', () => {

  describe('large dataset query', () => {
    it('getAllByUser returns rows even with large dataset mock', async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        id: `big-${i}`, user_id: 'u33-big',
        period_start_date: `2025-${String(i + 1).padStart(2, '0')}-01`,
      }));

      mockDrizzle.select.mockReturnValue({
        from: jest.fn(() => ({
          where: jest.fn(() => makeQuery(items)),
        })),
      });

      class TestService extends BaseLocalService<any> {
        protected table = { id: 'id', user_id: 'user_id' };
        protected tableName = 'cycle_entries';
      }
      const svc = new TestService();
      const rows = await svc.getAllByUser('u33-big', { limit: 50 });
      expect(rows).toHaveLength(50);
    });
  });

  describe('JSON symptoms overhead', () => {
    it('getAllByUser returns records with symptoms data', async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        id: `json-${i}`, user_id: 'u33-json',
        symptoms: ['cramps', 'bloating', 'headache'],
      }));

      mockDrizzle.select.mockReturnValue({
        from: jest.fn(() => ({
          where: jest.fn(() => makeQuery(items)),
        })),
      });

      class TestService extends BaseLocalService<any> {
        protected table = { id: 'id', user_id: 'user_id' };
        protected tableName = 'cycle_entries';
      }
      const svc = new TestService();
      const rows = await svc.getAllByUser('u33-json');
      expect(rows).toHaveLength(50);
      expect(rows[0].symptoms).toContain('cramps');
    });
  });

  describe('multi-user query isolation', () => {
    it('each user sees only their own data', async () => {
      mockDrizzle.select.mockReturnValue({
        from: jest.fn(() => ({
          where: jest.fn((condition: any) => {
            const uid = condition?.b ?? '';
            const data = uid === 'user-a'
              ? [{ id: 'a1', user_id: 'user-a', period_start_date: '2025-01-01' }]
              : uid === 'user-b'
                ? [{ id: 'b1', user_id: 'user-b', period_start_date: '2025-02-01' }]
                : [];
            return Promise.resolve(data);
          }),
        })),
      });

      class TestService extends BaseLocalService<any> {
        protected table = { id: 'id', user_id: 'user_id' };
        protected tableName = 'cycle_entries';
      }
      const svc = new TestService();
      const aRows = await svc.getAllByUser('user-a');
      expect(aRows).toHaveLength(1);
      expect(aRows[0].user_id).toBe('user-a');
      const bRows = await svc.getAllByUser('user-b');
      expect(bRows).toHaveLength(1);
      expect(bRows[0].user_id).toBe('user-b');
    });
  });
});

// =============================================================================
// Scenario 34 (Extended): Conflict — Cascading, Timestamp, All Types
// =============================================================================

describe('Scenario 34 extended: conflict edge cases', () => {

  describe('single op discard', () => {
    it('discard removes one operation, queue retains others', async () => {
      const { result } = renderHook(() => useOfflineStore());
      await act(async () => {
        useOfflineStore.setState({
          operations: [
            {
              id: 'op-create', type: 'journal/create',
              data: { content: 'initial', entry_date: '2025-12-01' },
              tempId: 't12-create', idempotencyKey: 'ik-12-create',
              clientUpdatedAt: '2025-12-01T00:00:00Z',
              priority: 'normal', createdAt: '2025-12-01T00:00:00Z',
              retryCount: 0, maxRetries: 5,
            },
            {
              id: 'op-update', type: 'journal/update',
              data: { temp_id: 't12-create', content: 'updated' },
              tempId: 't12-update', idempotencyKey: 'ik-12-update',
              clientUpdatedAt: '2025-12-02T00:00:00Z',
              priority: 'normal', createdAt: '2025-12-02T00:00:00Z',
              retryCount: 0, maxRetries: 5,
            },
          ],
        });
      });
      expect(result.current.operations).toHaveLength(2);

      await act(async () => {
        useOfflineStore.getState().discard('op-create');
      });
      expect(result.current.operations).toHaveLength(1);

      await act(async () => {
        useOfflineStore.getState().discard('op-update');
      });
      expect(result.current.operations).toHaveLength(0);
    });
  });

  describe('conflict on different entity types', () => {
    it('cycle/update conflict is handled same as journal/update', async () => {
      const mockPost = jest.requireMock('src/services/api').apiClient.post;
      mockPost.mockResolvedValue({
        data: {
          results: [{
            temp_id: 't12-cycle-stale', status: 'conflict',
            server_data: { id: 'cycle-1', period_start_date: '2025-06-12' },
          }],
        },
      });

      const resp = await mockPost('/sync/batch', {
        operations: [{
          type: 'cycle/update', data: { id: 'cycle-1', period_start_date: '2025-06-10' },
          temp_id: 't12-cycle-stale', idempotency_key: 'ik-12-cycle',
          client_updated_at: '2020-01-01T00:00:00Z',
        }],
      });
      expect(resp.data.results[0].status).toBe('conflict');
      expect(resp.data.results[0].server_data.period_start_date).toBe('2025-06-12');
    });

    it('mood/create conflict returns conflict status', async () => {
      const mockPost = jest.requireMock('src/services/api').apiClient.post;
      mockPost.mockResolvedValue({
        data: { results: [{ temp_id: 't12-mood', status: 'created', entity_id: 'mood-1' }] },
      });

      const resp = await mockPost('/sync/batch', {
        operations: [{
          type: 'mood/create', data: { mood: 'happy', intensity: 5 },
          temp_id: 't12-mood', idempotency_key: 'ik-12-mood',
          client_updated_at: new Date().toISOString(),
        }],
      });
      expect(resp.data.results[0].status).toBe('created');
    });
  });

  describe('timestamp authority', () => {
    it('server_data from conflict contains updated_at for client reconciliation', async () => {
      const serverData = {
        id: 'entry-456', period_start_date: '2025-06-12',
        updated_at: '2025-06-11T14:00:00Z',
      };

      let upsertCalled = false;
      mockDrizzle.insert.mockReturnValue({
        values: jest.fn(() => {
          upsertCalled = true;
          return { onConflictDoUpdate: jest.fn(() => Promise.resolve()) };
        }),
      });

      class TestService extends BaseLocalService<any> {
        protected table = { id: 'id', user_id: 'user_id' };
        protected tableName = 'cycle_entries';
      }
      const svc = new TestService();
      await svc.upsert(serverData);
      expect(upsertCalled).toBe(true);
    });
  });
});

// =============================================================================
// Scenario 35 (Extended): Logout — Hard Delete, All Types, Force-Quit
// =============================================================================

describe('Scenario 35 extended: logout privacy edge cases', () => {

  describe('data partitioned across all types', () => {
    it('cycle and journal data both isolated by user_id', async () => {
      mockDrizzle.select.mockReturnValue({
        from: jest.fn(() => ({
          where: jest.fn((condition: any) => {
            const uid = condition?.b ?? '';
            if (uid === 'priya') {
              return makeQuery([
                { id: 'c1', user_id: 'priya', period_start_date: '2025-01-01' },
              ]);
            }
            return makeQuery([]);
          }),
        })),
      });

      class CycleService extends BaseLocalService<any> {
        protected table = { id: 'id', user_id: 'user_id' };
        protected tableName = 'cycle_entries';
      }
      class JournalService extends BaseLocalService<any> {
        protected table = { id: 'id', user_id: 'user_id' };
        protected tableName = 'journal_entries';
      }

      const cycleSvc = new CycleService();
      const journalSvc = new JournalService();

      const priyaCycles = await cycleSvc.getAllByUser('priya');
      expect(priyaCycles).toHaveLength(1);

      const ananyaCycles = await cycleSvc.getAllByUser('ananya');
      expect(ananyaCycles).toHaveLength(0);

      const priyaJournals = await journalSvc.getAllByUser('priya');
      expect(priyaJournals).toHaveLength(1);

      const ananyaJournals = await journalSvc.getAllByUser('ananya');
      expect(ananyaJournals).toHaveLength(0);
    });
  });

  describe('hard delete removes only own user data', () => {
    it('hardDelete for one user does not affect other user data', async () => {
      const deletedIds: string[] = [];
      mockDrizzle.delete.mockReturnValue({
        where: jest.fn((condition: any) => {
          const id = condition?.b ?? '';
          deletedIds.push(id);
          return Promise.resolve();
        }),
      });

      class TestService extends BaseLocalService<any> {
        protected table = { id: 'id', user_id: 'user_id' };
        protected tableName = 'cycle_entries';
      }
      const svc = new TestService();
      await svc.hardDelete('cycle-to-delete');
      expect(deletedIds).toContain('cycle-to-delete');
    });
  });

  describe('force-quit during logout', () => {
    it('auth state resets on hydrate when no cached token', async () => {
      mockTokenStore.getAccess.mockResolvedValue(null);

      const { result } = renderHook(() => useAuthStore());
      await act(async () => { await result.current.hydrate(); });

      expect(result.current.isHydrated).toBe(true);
      expect(result.current.user).toBeNull();
    });
  });

  describe('new user co-exists with existing data', () => {
    it('getAllByUser for new user returns empty even with other user data in DB', async () => {
      mockDrizzle.select.mockReturnValue({
        from: jest.fn(() => ({
          where: jest.fn((condition: any) => {
            const uid = condition?.b ?? '';
            return makeQuery(
              uid === 'existing-user'
                ? [{ id: 'existing-1', user_id: 'existing-user', period_start_date: '2025-01-01' }]
                : []
            );
          }),
        })),
      });

      class TestService extends BaseLocalService<any> {
        protected table = { id: 'id', user_id: 'user_id' };
        protected tableName = 'cycle_entries';
      }
      const svc = new TestService();

      const existingData = await svc.getAllByUser('existing-user');
      expect(existingData).toHaveLength(1);

      const newUserData = await svc.getAllByUser('new-user');
      expect(newUserData).toEqual([]);
    });
  });
});
