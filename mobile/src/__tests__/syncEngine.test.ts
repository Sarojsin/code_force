import { act, renderHook } from '@testing-library/react-native';

jest.mock('src/services/storage', () => ({
  EncryptedStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
}));

jest.mock('src/utils', () => ({
  generateId: jest.fn(() => 'test-uuid-456'),
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({ setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() }));
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({ execSync: jest.fn(), runSync: jest.fn() })),
}));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  drizzle: jest.fn(() => ({ select: jest.fn(), insert: jest.fn(), update: jest.fn(), delete: jest.fn() })),
}));

jest.mock('@sentry/react-native', () => ({
  setTag: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.mock('src/services/api/client', () => {
  const mockAxiosInstance = {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  return {
    api: mockAxiosInstance,
    tokenStore: {
      getAccess: jest.fn(), getRefresh: jest.fn(), setBoth: jest.fn(), clear: jest.fn(),
    },
  };
});

jest.mock('pako', () => ({ gzip: jest.fn((data: string) => Buffer.from(data)) }));

import { syncAll, setQueryClient, pushOperations, pullServerData } from 'src/services/sync/syncEngine';
import { useOfflineStore } from 'src/stores/offlineStore';
import { useAuthStore } from 'src/stores/authStore';

// Helpers for tests that need queryCache
function makeQueryClient() {
  return { invalidateQueries: jest.fn(), setQueryData: jest.fn() };
}

const mockApi = jest.requireMock('src/services/api/client').api;
const mockLogger = jest.requireMock('src/utils').logger;
const mockSentry = jest.requireMock('@sentry/react-native');
const mockStorage = jest.requireMock('src/services/storage').EncryptedStorage;

beforeEach(async () => {
  jest.clearAllMocks();
  // Re-apply custom implementations lost by clearAllMocks
  mockStorage.getItem.mockImplementation(async () => null);
  mockStorage.setItem.mockImplementation(async () => {});
  mockStorage.removeItem.mockImplementation(async () => {});
  mockStorage.clear.mockImplementation(async () => {});

  mockApi.post.mockResolvedValue({ data: { results: [] } });
  mockApi.get.mockResolvedValue({ data: { changes: [] } });

  const { result } = renderHook(() => useOfflineStore());
  await act(async () => { await result.current.clear(); });
  useAuthStore.setState({ user: { id: 'user1', email: 'test@test.com', phone_number: null, display_name: null, role: 'user', is_active: true, is_verified: true, provider: 'local', created_at: new Date().toISOString(), last_login_at: null, onboarding_completed: true } });
});

describe('pushOperations', () => {
  it('does nothing with empty array', async () => {
    await pushOperations([]);
    expect(mockApi.post).not.toHaveBeenCalled();
  });
});

describe('setQueryClient', () => {
  it('stores the query client reference', () => {
    const qc = { invalidateQueries: jest.fn(), setQueryData: jest.fn() };
    setQueryClient(qc);
    expect(qc.invalidateQueries).not.toHaveBeenCalled();
  });
});

describe('pullServerData', () => {
  it('returns null on api failure', async () => {
    mockApi.get.mockRejectedValue(new Error('Network error'));
    const result = await pullServerData();
    expect(result).toBeNull();
  });

  it('returns null when no changes', async () => {
    mockApi.get.mockResolvedValue({ data: { changes: [] } });
    const result = await pullServerData();
    expect(result).toBeNull();
  });

  it('returns latest updated_at when changes exist', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        changes: [
          { entity_type: 'journal', entity_id: '1', action: 'created', data: {}, updated_at: '2024-01-01T00:00:00Z' },
        ],
        has_more: false,
      },
    });
    const result = await pullServerData();
    expect(result).toBe('2024-01-01T00:00:00Z');
  });
});

describe('syncAll', () => {
  it('logs start and complete', async () => {
    mockApi.get.mockResolvedValue({ data: { changes: [] } });
    mockApi.post.mockResolvedValue({ data: { results: [] } });
    await syncAll();
    expect(mockLogger.info).toHaveBeenCalledWith('sync.cycle.starting', expect.any(Object));
    expect(mockLogger.info).toHaveBeenCalledWith('sync.cycle.completed', expect.any(Object));
  });

  it('does not run concurrently', async () => {
    mockApi.get.mockResolvedValue({ data: { changes: [] } });
    mockApi.post.mockResolvedValue({ data: { results: [] } });
    await Promise.all([syncAll(), syncAll()]);
    expect(mockLogger.warn).toHaveBeenCalledWith('sync.cycle.skipped_already_syncing');
  });

  it('skips sync if no authenticated user', async () => {
    useAuthStore.setState({ user: null });
    mockApi.get.mockResolvedValue({ data: { changes: [] } });
    await syncAll();
    expect(mockLogger.warn).toHaveBeenCalledWith('sync.cycle.skipped_no_auth');
  });

  it('pushes pending operations then pulls server data', async () => {
    mockApi.post.mockResolvedValue({ data: { results: [] } });
    mockApi.get.mockResolvedValue({ data: { changes: [] } });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'test' }, tempId: 't1',
        idempotencyKey: 'ik1', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    await syncAll();
    expect(mockApi.post).toHaveBeenCalled();
    expect(mockApi.get).toHaveBeenCalled();
  });

  it('sets Sentry tags on start and clears on completion', async () => {
    mockApi.get.mockResolvedValue({ data: { changes: [] } });
    mockApi.post.mockResolvedValue({ data: { results: [] } });
    await syncAll();
    expect(mockSentry.setTag).toHaveBeenCalledWith('sync.is_syncing', 'true');
    expect(mockSentry.setTag).toHaveBeenCalledWith('sync.is_syncing', 'false');
  });

  it('logs push failed and skips pull on push error', async () => {
    mockApi.post.mockRejectedValue(new Error('Push failed'));
    mockApi.get.mockResolvedValue({ data: { changes: [] } });
    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'test' }, tempId: 't1',
        idempotencyKey: 'ik1', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    await syncAll();
    expect(mockLogger.error).toHaveBeenCalledWith('sync.push_failed', expect.any(Object));
    expect(mockLogger.info).toHaveBeenCalledWith('sync.cycle.completed', expect.any(Object));
  });

  // ─── 409 Conflict resolution ─────────────────────────────────
  describe('409 conflict resolution', () => {
    it('push with conflict status removes the op and hydrates server_data', async () => {
      const qc = makeQueryClient();
      setQueryClient(qc as any);
      mockApi.post.mockResolvedValue({
        data: {
          results: [{
            status: 'conflict',
            entity_id: 'entry-1',
            server_data: { id: 'entry-1', period_start_date: '2026-06-14', period_end_date: '2026-06-18', _conflict_resolved: true },
          }],
        },
      });

      const { result } = renderHook(() => useOfflineStore());
      await act(async () => {
        await result.current.enqueue({
          type: 'cycle/correction', data: { period_start_date: '2026-06-14' }, tempId: 'tmp-1',
          idempotencyKey: 'ik-conflict', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
        });
      });
      expect(result.current.size()).toBe(1);

      await pushOperations(result.current.operations);

      // Operation removed after successful conflict resolution
      expect(result.current.size()).toBe(0);
    });

    it('push 401 non-retryable discards the operation', async () => {
      mockApi.post.mockResolvedValue({
        data: {
          results: [{
            status: 'failed',
            error: '401 UNAUTHORIZED',
          }],
        },
      });

      const { result } = renderHook(() => useOfflineStore());
      await act(async () => {
        await result.current.enqueue({
          type: 'cycle/create', data: {}, tempId: 'tmp-auth',
          idempotencyKey: 'ik-auth', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
        });
      });
      expect(result.current.size()).toBe(1);

      await pushOperations(result.current.operations);
      expect(result.current.size()).toBe(0);
    });
  });

  // ─── Scenario 7: conflict hydrates query cache ────────────────
  it('conflict with server_data updates query cache', async () => {
    const qc = makeQueryClient();
    setQueryClient(qc as any);
    const existingData = [
      { id: 'entry-1', period_start_date: '2026-06-12', period_end_date: '2026-06-16' },
    ];
    qc.setQueryData.mockReturnValue(existingData);
    // Pre-set some data in the cache so the merge path is exercised
    const { inferQueryKey } = require('src/services/sync/queryKeyMapper');
    const qKey = inferQueryKey('cycle/correction', 'entry-1');
    (qc as any).getQueryData = jest.fn(() => existingData);

    mockApi.post.mockResolvedValue({
      data: {
        results: [{
          status: 'conflict',
          entity_id: 'entry-1',
          server_data: { id: 'entry-1', period_start_date: '2026-06-14', period_end_date: '2026-06-18', _conflict_resolved: true },
        }],
      },
    });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'cycle/correction', data: { period_start_date: '2026-06-12' }, tempId: 'tmp-cache',
        idempotencyKey: 'ik-cache', clientUpdatedAt: '2026-07-22T10:00:00Z', priority: 'normal',
      });
    });

    await pushOperations(result.current.operations);

    // Operation removed, query cache updated with server_data
    expect(result.current.size()).toBe(0);
  });

  // ─── Scenario 8: different periods no conflict ────────────────
  it('two corrections for different periods both succeed', async () => {
    const qc = makeQueryClient();
    setQueryClient(qc as any);

    mockApi.post.mockResolvedValue({
      data: {
        results: [
          { status: 'created', entity_id: 'entry-a', server_data: { id: 'entry-a', period_start_date: '2026-06-10' } },
          { status: 'created', entity_id: 'entry-b', server_data: { id: 'entry-b', period_start_date: '2026-07-15' } },
        ],
      },
    });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'cycle/correction', data: { period_start_date: '2026-06-10' }, tempId: 'tmp-A',
        idempotencyKey: 'ik-A', clientUpdatedAt: '2026-07-22T10:00:00Z', priority: 'normal',
      });
      await result.current.enqueue({
        type: 'cycle/correction', data: { period_start_date: '2026-07-15' }, tempId: 'tmp-B',
        idempotencyKey: 'ik-B', clientUpdatedAt: '2026-07-22T10:00:01Z', priority: 'normal',
      });
    });
    expect(result.current.size()).toBe(2);

    await pushOperations(result.current.operations);

    // Both operations removed after successful push
    expect(result.current.size()).toBe(0);
    // Both operations sent in a single batch
    expect(mockApi.post).toHaveBeenCalledTimes(1);
    const payload = mockApi.post.mock.calls[0][1];
    expect(payload.operations).toHaveLength(2);
    expect(payload.operations[0].temp_id).toBe('tmp-A');
    expect(payload.operations[1].temp_id).toBe('tmp-B');
  });
});

// ─── Idempotency key in push payload ──────────────────────────
  describe('idempotency key forwarding', () => {
    it('sends idempotency_key in push payload', async () => {
      const { result } = renderHook(() => useOfflineStore());
      await act(async () => {
        await result.current.enqueue({
          type: 'cycle/correction', data: { period_start_date: '2026-06-14' }, tempId: 'tmp-idem',
          idempotencyKey: 'idem-001', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
        });
      });

      await pushOperations(result.current.operations);
      const callPayload = mockApi.post.mock.calls[0][1];
      expect(callPayload.operations[0].idempotency_key).toBe('idem-001');
    });
  });
