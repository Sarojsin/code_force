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

import { useOfflineStore } from '../offlineStore';
import type { PendingOperation } from 'src/services/sync';

function makeOp(
  overrides: Partial<PendingOperation> = {},
): PendingOperation {
  return {
    id: 'test-id',
    tempId: 'temp-1',
    entity: 'journal',
    action: 'create',
    payload: { content: 'hello' },
    createdAt: new Date().toISOString(),
    retryCount: 0,
    maxRetries: 5,
    ...overrides,
  };
}

beforeEach(async () => {
  const { result } = renderHook(() => useOfflineStore());
  await act(async () => {
    result.current.clear();
  });
});

it('starts empty and unhydrated', () => {
  const { result } = renderHook(() => useOfflineStore());
  expect(result.current.operations).toEqual([]);
  expect(result.current.isHydrated).toBe(false);
});

it('enqueue adds an operation and returns an id', async () => {
  const { result } = renderHook(() => useOfflineStore());

  let id = '';
  await act(async () => {
    id = await result.current.enqueue({
      tempId: 'temp-1',
      entity: 'journal',
      action: 'create',
      payload: { content: 'hello' },
    });
  });

  expect(id).toBeDefined();
  expect(id.length).toBeGreaterThan(0);
  expect(result.current.size()).toBe(1);
  expect(result.current.operations[0].entity).toBe('journal');
  expect(result.current.operations[0].retryCount).toBe(0);
  expect(result.current.operations[0].maxRetries).toBe(5);
});

it('remove deletes by id', async () => {
  const { result } = renderHook(() => useOfflineStore());

  let id = '';
  await act(async () => {
    id = await result.current.enqueue({
      tempId: 'temp-1',
      entity: 'mood',
      action: 'create',
      payload: { mood: 'happy' },
    });
    await result.current.remove(id);
  });

  expect(result.current.size()).toBe(0);
});

it('removeMany deletes multiple operations', async () => {
  const { result } = renderHook(() => useOfflineStore());

  let id1 = '';
  let id2 = '';
  await act(async () => {
    id1 = await result.current.enqueue({ tempId: 'a', entity: 'journal', action: 'create', payload: {} });
    id2 = await result.current.enqueue({ tempId: 'b', entity: 'mood', action: 'create', payload: {} });
    await result.current.removeMany([id1, id2]);
  });

  expect(result.current.size()).toBe(0);
});

it('removeCascading removes all operations with matching tempId', async () => {
  const { result } = renderHook(() => useOfflineStore());

  await act(async () => {
    await result.current.enqueue({ tempId: 't1', entity: 'journal', action: 'create', payload: {} });
    await result.current.enqueue({ tempId: 't1', entity: 'journal', action: 'delete', payload: {} });
    await result.current.enqueue({ tempId: 't2', entity: 'mood', action: 'create', payload: {} });
    await result.current.removeCascading('t1');
  });

  expect(result.current.size()).toBe(1);
  expect(result.current.operations[0].tempId).toBe('t2');
});

it('incrementRetry bumps retryCount', async () => {
  const { result } = renderHook(() => useOfflineStore());

  let id = '';
  await act(async () => {
    id = await result.current.enqueue({ tempId: 't1', entity: 'journal', action: 'create', payload: {} });
    await result.current.incrementRetry(id);
  });

  expect(result.current.operations[0].retryCount).toBe(1);
});

it('getPendingOperations only returns ops with retryCount < maxRetries', async () => {
  const { result } = renderHook(() => useOfflineStore());

  await act(async () => {
    await result.current.enqueue({ tempId: 'ok', entity: 'journal', action: 'create', payload: {} });
    await result.current.enqueue({ tempId: 'exhausted', entity: 'mood', action: 'create', payload: {} });
  });

  // manually set exhausted op's retryCount to maxRetries
  await act(async () => {
    const ops = result.current.operations;
    const exhausted = ops.find((o) => o.tempId === 'exhausted');
    if (exhausted) {
      await result.current.incrementRetry(exhausted.id);
      await result.current.incrementRetry(exhausted.id);
      await result.current.incrementRetry(exhausted.id);
      await result.current.incrementRetry(exhausted.id);
      await result.current.incrementRetry(exhausted.id);
    }
  });

  const pending = result.current.getPendingOperations();
  expect(pending.length).toBe(1);
  expect(pending[0].tempId).toBe('ok');
});

it('discard removes operation by id', async () => {
  const { result } = renderHook(() => useOfflineStore());

  let id = '';
  await act(async () => {
    id = await result.current.enqueue({ tempId: 't1', entity: 'journal', action: 'create', payload: {} });
    await result.current.discard(id);
  });

  expect(result.current.size()).toBe(0);
});

it('discardMany removes multiple by ids', async () => {
  const { result } = renderHook(() => useOfflineStore());

  let id1 = '';
  let id2 = '';
  await act(async () => {
    id1 = await result.current.enqueue({ tempId: 'a', entity: 'journal', action: 'create', payload: {} });
    id2 = await result.current.enqueue({ tempId: 'b', entity: 'mood', action: 'create', payload: {} });
    await result.current.discardMany([id1, id2]);
  });

  expect(result.current.size()).toBe(0);
});

it('clear removes all operations', async () => {
  const { result } = renderHook(() => useOfflineStore());

  await act(async () => {
    await result.current.enqueue({ tempId: 'a', entity: 'journal', action: 'create', payload: {} });
    await result.current.enqueue({ tempId: 'b', entity: 'journal', action: 'create', payload: {} });
    await result.current.clear();
  });

  expect(result.current.size()).toBe(0);
});

it('clearFailed removes only exhausted operations', async () => {
  const { result } = renderHook(() => useOfflineStore());

  await act(async () => {
    await result.current.enqueue({ tempId: 'ok', entity: 'journal', action: 'create', payload: {} });
    await result.current.enqueue({ tempId: 'exhausted', entity: 'mood', action: 'create', payload: {} });
  });

  await act(async () => {
    const exhausted = result.current.operations.find((o) => o.tempId === 'exhausted');
    if (exhausted) {
      for (let i = 0; i < 5; i++) {
        await result.current.incrementRetry(exhausted.id);
      }
    }
    await result.current.clearFailed(5);
  });

  expect(result.current.size()).toBe(1);
  expect(result.current.operations[0].tempId).toBe('ok');
});

it('hydrate restores persisted operations', async () => {
  // Simulate cold start: storage has data but store is fresh
  const { result: fresh } = renderHook(() => useOfflineStore());

  // Pre-populate storage directly (simulates data from previous session)
  const opData = JSON.stringify([
    {
      id: 'cold-start-id',
      tempId: 'persisted',
      entity: 'journal' as const,
      action: 'create' as const,
      payload: { content: 'persist' },
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 5,
    },
  ]);

  jest.isolateModules(async () => {
    // The mock's underlying storage - setItem was called during persist
  });

  await act(async () => {
    const { EncryptedStorage } = require('src/services/storage');
    await EncryptedStorage.setItem(
      'shecare.offline.queue',
      opData,
    );
  });

  expect(fresh.current.isHydrated).toBe(false);
  expect(fresh.current.size()).toBe(0);

  await act(async () => {
    await fresh.current.hydrate();
  });

  expect(fresh.current.isHydrated).toBe(true);
  expect(fresh.current.size()).toBe(1);
  expect(fresh.current.operations[0].tempId).toBe('persisted');
});
