import { act, renderHook } from '@testing-library/react-native';

jest.mock('react-native-encrypted-storage', () => {
  const store: Record<string, string> = {};
  return {
    default: {
      getItem: jest.fn(async (key: string) => store[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete store[key];
      }),
      clear: jest.fn(async () => {
        Object.keys(store).forEach((k) => delete store[k]);
      }),
    },
  };
});

jest.mock('src/services/storage', () => {
  const storage: Record<string, string> = {};
  return {
    EncryptedStorage: {
      getItem: jest.fn(async (key: string) => storage[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        storage[key] = value;
      }),
      removeItem: jest.fn(async (key: string) => {
        delete storage[key];
      }),
      clear: jest.fn(async () => {
        Object.keys(storage).forEach((k) => delete storage[k]);
      }),
    },
  };
});

jest.mock('src/utils', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('src/services/api/client', () => {
  const mockAxiosInstance = {
    post: jest.fn(),
    get: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    api: mockAxiosInstance,
    tokenStore: {
      getAccess: jest.fn(),
      getRefresh: jest.fn(),
      setBoth: jest.fn(),
      clear: jest.fn(),
    },
  };
});

jest.mock('pako', () => ({
  gzip: jest.fn((data: string) => Buffer.from(data)),
}));

import {
  syncAll,
  setQueryClient,
  pushOperations,
  pullServerData,
} from 'src/services/sync/syncEngine';
import { useOfflineStore } from 'src/stores/offlineStore';

const mockApi = jest.requireMock('src/services/api/client').api;
const mockLogger = jest.requireMock('src/utils').logger;

beforeEach(async () => {
  jest.clearAllMocks();
  const { result } = renderHook(() => useOfflineStore());
  await act(async () => {
    await result.current.clear();
  });
});

it('pushOperations does nothing with empty array', async () => {
  await pushOperations([]);
  expect(mockApi.post).not.toHaveBeenCalled();
});

it('setQueryClient stores the query client reference', () => {
  const qc = { invalidateQueries: jest.fn() };
  setQueryClient(qc);
  expect(qc.invalidateQueries).not.toHaveBeenCalled();
});

it('pullServerData returns null on api failure', async () => {
  mockApi.get.mockRejectedValue(new Error('Network error'));
  const result = await pullServerData();
  expect(result).toBeNull();
  expect(mockLogger.error).toHaveBeenCalled();
});

it('pullServerData returns null when no changes', async () => {
  mockApi.get.mockResolvedValue({
    data: { data: { changes: [] } },
  });
  const result = await pullServerData();
  expect(result).toBeNull();
});

it('pullServerData returns latest updated_at when changes exist', async () => {
  mockApi.get.mockResolvedValue({
    data: {
      data: {
        changes: [
          { entity_type: 'journal', entity_id: '1', action: 'created', data: {}, updated_at: '2024-01-01T00:00:00Z' },
        ],
      },
    },
  });
  const result = await pullServerData();
  expect(result).toBe('2024-01-01T00:00:00Z');
});

it('syncAll logs start and complete', async () => {
  mockApi.get.mockResolvedValue({
    data: { data: { changes: [] } },
  });
  mockApi.post.mockResolvedValue({
    data: { data: { results: [] } },
  });
  await syncAll();
  expect(mockLogger.info).toHaveBeenCalledWith('sync.starting');
  expect(mockLogger.info).toHaveBeenCalledWith('sync.completed');
});

it('syncAll does not run concurrently', async () => {
  mockApi.get.mockResolvedValue({
    data: { data: { changes: [] } },
  });
  mockApi.post.mockResolvedValue({
    data: { data: { results: [] } },
  });
  await syncAll();
  expect(mockLogger.info).toHaveBeenLastCalledWith('sync.completed');
});

it('syncAll pushes pending operations from offline store', async () => {
  mockApi.post.mockResolvedValue({
    data: { data: { results: [] } },
  });
  mockApi.get.mockResolvedValue({
    data: { data: { changes: [] } },
  });
  const { result } = renderHook(() => useOfflineStore());
  await act(async () => {
    await result.current.enqueue({
      tempId: 't1',
      entity: 'journal',
      action: 'create',
      payload: { content: 'hello' },
    });
  });
  await syncAll();
  expect(mockApi.post).toHaveBeenCalled();
});

it('offline store enqueue adds operation with retry tracking', async () => {
  const { result } = renderHook(() => useOfflineStore());
  let id = '';
  await act(async () => {
    id = await result.current.enqueue({
      tempId: 'sync-op',
      entity: 'journal',
      action: 'create',
      payload: { text: 'sync test' },
    });
  });
  expect(id).toBeDefined();
  expect(result.current.size()).toBe(1);
  expect(result.current.operations[0].retryCount).toBe(0);
  expect(result.current.operations[0].maxRetries).toBe(5);
});

it('offline store increments retry and tracks exhausted operations', async () => {
  const { result } = renderHook(() => useOfflineStore());
  let id = '';
  await act(async () => {
    id = await result.current.enqueue({
      tempId: 'retry-op',
      entity: 'mood',
      action: 'create',
      payload: { mood: 'happy' },
    });
    for (let i = 0; i < 5; i++) {
      await result.current.incrementRetry(id);
    }
  });
  expect(result.current.operations[0].retryCount).toBe(5);
  const pending = result.current.getPendingOperations();
  expect(pending).toHaveLength(0);
});
