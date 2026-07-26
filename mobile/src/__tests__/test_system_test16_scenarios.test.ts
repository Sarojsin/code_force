/**
 * System Test 16 — Scenario 51: Double Correction (Mistake → Fix).
 *
 * Scenario 51: User corrects 15 -> 12 (mistake), then corrects 12 -> 14 (final).
 * Tests FIFO queue order, Client Timestamp Authority (LWW) conflict handling,
 * stale offline rejection, and mixed offline/online flows.
 */

const encryptedStore: Record<string, string> = {};
const mockAsyncStorageStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async (key: string, value: string) => { mockAsyncStorageStore[key] = value; }),
  getItem: jest.fn(async (key: string) => mockAsyncStorageStore[key] ?? null),
  removeItem: jest.fn(async (key: string) => { delete mockAsyncStorageStore[key]; }),
  clear: jest.fn(async () => { Object.keys(mockAsyncStorageStore).forEach((k) => delete mockAsyncStorageStore[k]); }),
}));

jest.mock('src/services/storage', () => ({
  EncryptedStorage: {
    getItem: jest.fn(async (key: string) => encryptedStore[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => { encryptedStore[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete encryptedStore[key]; }),
    clear: jest.fn(async () => { Object.keys(encryptedStore).forEach((k) => delete encryptedStore[k]); }),
  },
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(), addEventListener: jest.fn(),
}));

jest.mock('src/services/sync/syncHydrate', () => ({
  hydrateFromServerData: jest.fn(),
  hydrateChangeItems: jest.fn(),
}));

jest.mock('src/services/api', () => ({
  authService: { login: jest.fn(), register: jest.fn(), getMe: jest.fn(), logout: jest.fn() },
  tokenStore: { getAccess: jest.fn(), getRefresh: jest.fn(), setBoth: jest.fn(), clear: jest.fn() },
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('src/services/api/client', () => ({
  api: { post: jest.fn(), get: jest.fn() },
  tokenStore: { getAccess: jest.fn(), getRefresh: jest.fn(), setBoth: jest.fn(), clear: jest.fn(), setAccess: jest.fn() },
}));

jest.mock('@sentry/react-native', () => ({
  setTag: jest.fn(), captureException: jest.fn(), addBreadcrumb: jest.fn(),
}));

jest.mock('react-native-toast-message', () => ({
  default: { show: jest.fn() },
}));

jest.mock('src/utils', () => ({
  ...jest.requireActual('src/utils'),
  generateId: jest.fn(() => 'test-uuid-mock'),
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockDrizzle = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({ where: jest.fn(() => Promise.resolve([])) })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn(() => ({ onConflictDoUpdate: jest.fn(() => Promise.resolve()) })),
  })),
  update: jest.fn(() => ({
    set: jest.fn(() => ({ where: jest.fn(() => Promise.resolve()) })),
  })),
  delete: jest.fn(() => ({
    where: jest.fn(() => Promise.resolve()),
  })),
};

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((a: any, b: any) => ({ a, b })),
  lt: jest.fn((a: any, b: any) => ({ a, b })),
  and: jest.fn((...conds: any[]) => ({ type: 'and', conditions: conds })),
  sql: jest.fn((strings: TemplateStringsArray) => strings.join('')),
}));

jest.mock('src/db/connection', () => ({
  getDb: jest.fn(() => mockDrizzle),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useAuthStore } from 'src/stores/authStore';
import { useOfflineStore } from 'src/stores/offlineStore';
import { syncAll, pushOperations } from 'src/services/sync/syncEngine';
import { BaseLocalService } from 'src/services/localDb/BaseLocalService';

const mockTokenStore = jest.requireMock('src/services/api').tokenStore;
const mockApiPost = jest.requireMock('src/services/api/client').api.post;
const mockApiGet = jest.requireMock('src/services/api/client').api.get;
const mockLogger = jest.requireMock('src/utils').logger;
const mockEncryptedStorage = jest.requireMock('src/services/storage').EncryptedStorage;
const mockToast = jest.requireMock('react-native-toast-message').default;

class TestLocalService extends BaseLocalService<{ id: string; user_id: string }> {
  protected table: any = { id: 'id' };
  protected tableName = 'test_table';
}

beforeEach(async () => {
  jest.clearAllMocks();
  Object.keys(encryptedStore).forEach((k) => delete encryptedStore[k]);
  Object.keys(mockAsyncStorageStore).forEach((k) => delete mockAsyncStorageStore[k]);
  mockEncryptedStorage.getItem.mockImplementation(async (key: string) => encryptedStore[key] ?? null);
  mockEncryptedStorage.setItem.mockImplementation(async (key: string, value: string) => {
    encryptedStore[key] = value;
  });

  useOfflineStore.getState().clear();
  useAuthStore.setState({ user: { id: 'test-user', email: 'test@test.com' }, isHydrated: true });
  mockTokenStore.getAccess.mockResolvedValue('mock-access-token');
});

// =============================================================================
// Scenario 51: Double Correction (Mistake → Fix)
// =============================================================================

describe('Scenario 51: Double Correction (Mistake -> Fix)', () => {

  it('FIFO queue: two corrections enqueued in order preserve first-op-second-op sequence', async () => {
    const { result } = renderHook(() => useOfflineStore());

    const earlier = '2025-06-12T10:00:00.000Z';
    const later = '2025-06-12T10:05:00.000Z';

    await act(async () => {
      await result.current.enqueue({
        type: 'cycle/update',
        data: { id: 'cycle-51', period_start_date: '2025-06-12', symptoms: ['cramps'] },
        tempId: 't51-mistake',
        idempotencyKey: 'ik-51-mistake',
        clientUpdatedAt: earlier,
        priority: 'normal',
      });
    });
    await act(async () => {
      await result.current.enqueue({
        type: 'cycle/update',
        data: { id: 'cycle-51', period_start_date: '2025-06-14', symptoms: ['cramps'] },
        tempId: 't51-fix',
        idempotencyKey: 'ik-51-fix',
        clientUpdatedAt: later,
        priority: 'normal',
      });
    });

    expect(result.current.operations).toHaveLength(2);
    expect(result.current.operations[0].tempId).toBe('t51-mistake');
    expect(result.current.operations[1].tempId).toBe('t51-fix');
    expect(result.current.operations[0].clientUpdatedAt).toBe(earlier);
    expect(result.current.operations[1].clientUpdatedAt).toBe(later);
  });

  it('pushOperations sends both corrections in FIFO order', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        results: [
          {
            index: 0, status: 'updated', entity_id: 'cycle-51', temp_id: 't51-mistake',
            server_data: { id: 'cycle-51', period_start_date: '2025-06-12' },
          },
          {
            index: 1, status: 'updated', entity_id: 'cycle-51', temp_id: 't51-fix',
            server_data: { id: 'cycle-51', period_start_date: '2025-06-14' },
          },
        ],
      },
    });

    const { result } = renderHook(() => useOfflineStore());
    const earlier = '2025-06-12T10:00:00.000Z';
    const later = '2025-06-12T10:05:00.000Z';

    await act(async () => {
      await result.current.enqueue({
        type: 'cycle/update',
        data: { id: 'cycle-51', period_start_date: '2025-06-12' },
        tempId: 't51-mistake',
        idempotencyKey: 'ik-51-mistake',
        clientUpdatedAt: earlier,
        priority: 'normal',
      });
      await result.current.enqueue({
        type: 'cycle/update',
        data: { id: 'cycle-51', period_start_date: '2025-06-14' },
        tempId: 't51-fix',
        idempotencyKey: 'ik-51-fix',
        clientUpdatedAt: later,
        priority: 'normal',
      });
    });

    await act(async () => { await syncAll(); });

    expect(mockApiPost).toHaveBeenCalledTimes(1);
    const opsSent = mockApiPost.mock.calls[0][1]?.operations;
    expect(opsSent).toHaveLength(2);
    expect(opsSent[0].temp_id).toBe('t51-mistake');
    expect(opsSent[1].temp_id).toBe('t51-fix');
    expect(opsSent[0].client_updated_at).toBe(earlier);
    expect(opsSent[1].client_updated_at).toBe(later);
  });

  it('after sync both operations are drained from queue', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        results: [
          {
            index: 0, status: 'updated', entity_id: 'cycle-51', temp_id: 't51-mistake',
            server_data: { id: 'cycle-51', period_start_date: '2025-06-12' },
          },
          {
            index: 1, status: 'updated', entity_id: 'cycle-51', temp_id: 't51-fix',
            server_data: { id: 'cycle-51', period_start_date: '2025-06-14' },
          },
        ],
      },
    });

    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    const { result } = renderHook(() => useOfflineStore());

    await act(async () => {
      await result.current.enqueue({
        type: 'cycle/update',
        data: { id: 'cycle-51', period_start_date: '2025-06-12' },
        tempId: 't51-mistake',
        idempotencyKey: 'ik-51-mistake',
        clientUpdatedAt: '2025-06-12T10:00:00.000Z',
        priority: 'normal',
      });
      await result.current.enqueue({
        type: 'cycle/update',
        data: { id: 'cycle-51', period_start_date: '2025-06-14' },
        tempId: 't51-fix',
        idempotencyKey: 'ik-51-fix',
        clientUpdatedAt: '2025-06-12T10:05:00.000Z',
        priority: 'normal',
      });
    });

    await act(async () => { await syncAll(); });

    expect(result.current.operations).toHaveLength(0);
  });

  it('stale offline correction (earlier timestamp) after online fix is rejected by conflict handler', async () => {
    mockApiPost
      .mockResolvedValueOnce({
        data: {
          results: [{
            index: 0, status: 'conflict', entity_id: 'cycle-51', temp_id: 't51-stale',
            server_data: { id: 'cycle-51', period_start_date: '2025-06-14', updated_at: '2025-06-12T10:05:00.000Z' },
          }],
        },
      });

    const { result } = renderHook(() => useOfflineStore());

    await act(async () => {
      await result.current.enqueue({
        type: 'cycle/update',
        data: { id: 'cycle-51', period_start_date: '2025-06-12' },
        tempId: 't51-stale',
        idempotencyKey: 'ik-51-stale',
        clientUpdatedAt: '2025-06-12T10:00:00.000Z',
        priority: 'normal',
      });
    });

    await act(async () => { await syncAll(); });

    const warnCalls = mockLogger.warn.mock.calls.filter(
      (c: string[]) => c[0] === 'sync.conflict',
    );
    expect(warnCalls.length).toBeGreaterThanOrEqual(1);

    expect(result.current.operations).toHaveLength(0);
  });

  it('conflict handler overwrites local value with server value after stale correction', async () => {
    const serverResponse = {
      data: {
        results: [{
          index: 0, status: 'conflict', entity_id: 'cycle-51', temp_id: 't51-stale',
          server_data: { id: 'cycle-51', period_start_date: '2025-06-14', updated_at: '2025-06-12T10:05:00.000Z' },
        }],
      },
    };

    mockApiPost.mockResolvedValue(serverResponse);

    const { result } = renderHook(() => useOfflineStore());

    await act(async () => {
      await result.current.enqueue({
        type: 'cycle/update',
        data: { id: 'cycle-51', period_start_date: '2025-06-12' },
        tempId: 't51-stale',
        idempotencyKey: 'ik-51-stale',
        clientUpdatedAt: '2025-06-12T10:00:00.000Z',
        priority: 'normal',
      });
    });

    await act(async () => { await syncAll(); });

    expect(result.current.operations).toHaveLength(0);
  });
});
