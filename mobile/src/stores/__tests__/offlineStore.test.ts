import { act, renderHook } from '@testing-library/react-native';

jest.mock('react-native-encrypted-storage', () => {
  const store: Record<string, string> = {};
  return {
    default: {
      getItem: jest.fn(async (key: string) => store[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
      removeItem: jest.fn(async (key: string) => { delete store[key]; }),
      clear: jest.fn(async () => { Object.keys(store).forEach((k) => delete store[k]); }),
    },
  };
});

jest.mock('src/services/storage', () => {
  const storage: Record<string, string> = {};
  return {
    EncryptedStorage: {
      getItem: jest.fn(async (key: string) => storage[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => { storage[key] = value; }),
      removeItem: jest.fn(async (key: string) => { delete storage[key]; }),
      clear: jest.fn(async () => { Object.keys(storage).forEach((k) => delete storage[k]); }),
    },
  };
});

const mockIds = (function*() { let i = 0; while (true) { yield `test-uuid-${++i}`; } })();
jest.mock('src/utils', () => ({
  generateId: jest.fn(() => mockIds.next().value),
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { useOfflineStore } from '../offlineStore';

beforeEach(async () => {
  const { result } = renderHook(() => useOfflineStore());
  await act(async () => { await result.current.clear(); });
});

describe('enqueue', () => {
  it('adds operation with generated id, retryCount=0, maxRetries=5', async () => {
    const { result } = renderHook(() => useOfflineStore());
    let id = '';
    await act(async () => {
      id = await result.current.enqueue({
        type: 'journal/create',
        endpoint: '/api/v1/wellness/journal',
        data: { content: 'test' },
        tempId: 'temp_1',
        idempotencyKey: 'idem_1',
        clientUpdatedAt: new Date().toISOString(),
        priority: 'normal',
      });
    });
    expect(id).toBeDefined();
    expect(result.current.size()).toBe(1);
    const op = result.current.operations[0];
    expect(op.type).toBe('journal/create');
    expect(op.retryCount).toBe(0);
    expect(op.maxRetries).toBe(5);
    expect(op.createdAt).toBeDefined();
    expect(op.data.content).toBe('test');
  });

  it('stores operations in FIFO order', async () => {
    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'first' }, tempId: 't1',
        idempotencyKey: 'ik1', clientUpdatedAt: '2025-01-01T00:00:00Z', priority: 'normal',
      });
      await result.current.enqueue({
        type: 'mood/create', data: { mood: 'happy' }, tempId: 't2',
        idempotencyKey: 'ik2', clientUpdatedAt: '2025-01-01T00:01:00Z', priority: 'normal',
      });
    });
    expect(result.current.operations).toHaveLength(2);
    expect(result.current.operations[0].type).toBe('journal/create');
  });
});

describe('remove', () => {
  it('removes operation by id', async () => {
    const { result } = renderHook(() => useOfflineStore());
    let id = '';
    await act(async () => {
      id = await result.current.enqueue({
        type: 'journal/create', data: {}, tempId: 't1',
        idempotencyKey: 'ik1', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
      await result.current.remove(id);
    });
    expect(result.current.size()).toBe(0);
  });
});

describe('removeMany', () => {
  it('deletes multiple operations', async () => {
    const { result } = renderHook(() => useOfflineStore());
    let id1 = ''; let id2 = '';
    await act(async () => {
      id1 = await result.current.enqueue({ type: 'journal/create', data: {}, tempId: 'a', idempotencyKey: 'ik1', clientUpdatedAt: new Date().toISOString(), priority: 'normal' });
      id2 = await result.current.enqueue({ type: 'mood/create', data: {}, tempId: 'b', idempotencyKey: 'ik2', clientUpdatedAt: new Date().toISOString(), priority: 'normal' });
      await result.current.removeMany([id1, id2]);
    });
    expect(result.current.size()).toBe(0);
  });
});

describe('removeCascading', () => {
  it('removes all operations with matching tempId', async () => {
    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({ type: 'journal/create', data: {}, tempId: 't1', idempotencyKey: 'ik1', clientUpdatedAt: new Date().toISOString(), priority: 'normal' });
      await result.current.enqueue({ type: 'journal/delete', data: {}, tempId: 't1', idempotencyKey: 'ik2', clientUpdatedAt: new Date().toISOString(), priority: 'normal' });
      await result.current.enqueue({ type: 'mood/create', data: {}, tempId: 't2', idempotencyKey: 'ik3', clientUpdatedAt: new Date().toISOString(), priority: 'normal' });
      await result.current.removeCascading('t1');
    });
    expect(result.current.size()).toBe(1);
    expect(result.current.operations[0].tempId).toBe('t2');
  });
});

describe('incrementRetry', () => {
  it('bumps retryCount', async () => {
    const { result } = renderHook(() => useOfflineStore());
    let id = '';
    await act(async () => {
      id = await result.current.enqueue({ type: 'journal/create', data: {}, tempId: 't1', idempotencyKey: 'ik1', clientUpdatedAt: new Date().toISOString(), priority: 'normal' });
      await result.current.incrementRetry(id);
    });
    expect(result.current.operations[0].retryCount).toBe(1);
  });
});

describe('getPendingOperations', () => {
  it('excludes operations with retryCount >= maxRetries', async () => {
    const { result } = renderHook(() => useOfflineStore());
    let id2 = '';
    await act(async () => {
      await result.current.enqueue({ type: 'journal/create', data: {}, tempId: 'ok', idempotencyKey: 'ik1', clientUpdatedAt: new Date().toISOString(), priority: 'normal' });
      id2 = await result.current.enqueue({ type: 'mood/create', data: {}, tempId: 'exhausted', idempotencyKey: 'ik2', clientUpdatedAt: new Date().toISOString(), priority: 'normal' });
    });
    await act(async () => {
      for (let i = 0; i < 5; i++) { await result.current.incrementRetry(id2); }
    });
    expect(result.current.operations.length).toBe(2);
    const pending = result.current.getPendingOperations();
    expect(pending.length).toBe(1);
    expect(pending[0].tempId).toBe('ok');
  });
});

describe('discard', () => {
  it('removes operation by id', async () => {
    const { result } = renderHook(() => useOfflineStore());
    let id = '';
    await act(async () => {
      id = await result.current.enqueue({ type: 'journal/create', data: {}, tempId: 't1', idempotencyKey: 'ik1', clientUpdatedAt: new Date().toISOString(), priority: 'normal' });
      await result.current.discard(id);
    });
    expect(result.current.size()).toBe(0);
  });
});

describe('hydrate', () => {
  it('restores operations from EncryptedStorage', async () => {
    const queueKey = 'shecare.offline.queue';
    const opData = JSON.stringify([{
      id: 'cold-start-id', tempId: 'persisted', type: 'journal/create', data: { content: 'persist' },
      endpoint: '/api/v1/wellness/journal', idempotencyKey: 'ik1', clientUpdatedAt: new Date().toISOString(),
      priority: 'normal', createdAt: new Date().toISOString(), retryCount: 0, maxRetries: 5,
    }]);

    // Reload modules to get a fresh store instance
    jest.resetModules();

    // Set up storage mock for the fresh module
    const rawStorage: Record<string, string> = {};
    const mockStorageModule = { EncryptedStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(), clear: jest.fn() } };
    mockStorageModule.EncryptedStorage.getItem.mockImplementation(async (key: string) => rawStorage[key] ?? null);
    mockStorageModule.EncryptedStorage.setItem.mockImplementation(async (key: string, value: string) => { rawStorage[key] = value; });

    jest.doMock('src/services/storage', () => mockStorageModule);

    const { useOfflineStore: freshStore } = require('../offlineStore');

    // Store data in the fresh storage mock
    await mockStorageModule.EncryptedStorage.setItem(queueKey, opData);

    expect(freshStore.getState().isHydrated).toBe(false);
    expect(freshStore.getState().size()).toBe(0);

    await act(async () => { await freshStore.getState().hydrate(); });

    expect(freshStore.getState().isHydrated).toBe(true);
    expect(freshStore.getState().size()).toBe(1);
    expect(freshStore.getState().operations[0].type).toBe('journal/create');
    expect(freshStore.getState().operations[0].tempId).toBe('persisted');
  });
});
