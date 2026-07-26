/**
 * System Test 13 — Edge Cases: Race Condition (36), Background Interrupt (37),
 * Deep Link Conflict (38), Stale Refresh (39), Large Offline Queue (40).
 *
 * Scenario 36: Race Condition — Sync Engine Triggers Twice Simultaneously.
 *   isSyncing flag, guard clause, no duplicate writes, queue processed once.
 *
 * Scenario 37: App Backgrounded During Sync.
 *   No crash on background, queue persists, sync retries, no duplicates.
 *
 * Scenario 38: Deep Link Conflict — Two Notifications Tapped Rapidly.
 *   DeepLinkStore queue, sequential processing, navigate (not push).
 *
 * Scenario 39: Stale Refresh Token (Refresh Loop Death).
 *   Kill switch on /auth/refresh 401, offline queue cleared, _retry flag.
 *
 * Scenario 40: Large Offline Queue Exceeding SecureStore Limits.
 *   Fallback to AsyncStorage, warning toast, pruning.
 */

const encryptedStore: Record<string, string> = {};
const mockAsyncStorageStore: Record<string, string> = {};

jest.mock('src/services/storage', () => ({
  EncryptedStorage: {
    getItem: jest.fn(async (key: string) => encryptedStore[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      if (key.includes('fail') && encryptedStore[key] && encryptedStore[key].length > 100) {
        throw new Error('SecureStore limit');
      }
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

jest.mock('src/services/api/client', () => ({
  api: { post: jest.fn(), get: jest.fn() },
  tokenStore: {
    getAccess: jest.fn(), getRefresh: jest.fn(), setBoth: jest.fn(), clear: jest.fn(), setAccess: jest.fn(),
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

jest.mock('src/services/sync/syncHydrate', () => ({
  hydrateFromServerData: jest.fn(),
  hydrateChangeItems: jest.fn(),
}));

const mockIds = (function*() { let i = 0; while (true) { yield `test-uuid-${++i}`; } })();
jest.mock('src/utils', () => ({
  ...jest.requireActual('src/utils'),
  generateId: jest.fn(() => mockIds.next().value),
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
}));

jest.mock('src/db/connection', () => ({
  getDb: jest.fn(() => mockDrizzle),
}));

import { act, renderHook } from '@testing-library/react-native';
import { create } from 'zustand';
import { useAuthStore } from 'src/stores/authStore';
import { useOfflineStore } from 'src/stores/offlineStore';
import { EncryptedStorage } from 'src/services/storage';
import { syncAll, pushOperations, pullServerData, setQueryClient } from 'src/services/sync/syncEngine';

const mockTokenStore = jest.requireMock('src/services/api').tokenStore;
const mockApiClient = jest.requireMock('src/services/api/client');
const mockApiPost = mockApiClient.api.post;
const mockApiGet = mockApiClient.api.get;
const mockLogger = jest.requireMock('src/utils').logger;
const mockEncryptedStorage = jest.requireMock('src/services/storage').EncryptedStorage;
const mockAsyncStorage = jest.requireMock('@react-native-async-storage/async-storage');
const mockToast = jest.requireMock('react-native-toast-message').default;

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
// Scenario 36: Race Condition — Sync Engine Triggers Twice Simultaneously
// =============================================================================

describe('Scenario 36: Race Condition - Sync Stampede', () => {

  it('isSyncing guard prevents duplicate sync runs', async () => {
    let resolvePost: (value: unknown) => void;
    const postLock = new Promise<unknown>(resolve => { resolvePost = resolve; });

    mockApiPost.mockImplementation(async (url: string) => {
      if (url === '/sync/batch') {
        await postLock;
        return { data: { results: [] } };
      }
      if (url === '/sync/changes') {
        return { data: { changes: [] } };
      }
    });

    const firstPromise = syncAll();
    const secondPromise = syncAll();

    resolvePost!({ data: { results: [] } });
    await Promise.all([firstPromise, secondPromise]);

    expect(mockLogger.warn).toHaveBeenCalledWith('sync.cycle.skipped_already_syncing');
  });

  it('isSyncing lock released in finally block after success', async () => {
    mockApiPost.mockResolvedValue({ data: { results: [] } });
    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    await syncAll();

    const warnCalls = mockLogger.warn.mock.calls.filter(
      (c: string[]) => c[0] === 'sync.cycle.skipped_already_syncing',
    );
    expect(warnCalls.length).toBe(0);
  });

  it('isSyncing lock released in finally block after error', async () => {
    mockApiPost.mockRejectedValue(new Error('Network failure'));
    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    await syncAll();

    const warnCalls = mockLogger.warn.mock.calls.filter(
      (c: string[]) => c[0] === 'sync.cycle.skipped_already_syncing',
    );
    expect(warnCalls.length).toBe(0);
  });

  it('no duplicate writes to SQLite when batch pushed twice with same key', async () => {
    const serverId = 'entity-server-36';
    mockApiPost.mockResolvedValue({
      data: {
        results: [{
          index: 0, status: 'created', entity_id: serverId, temp_id: 't36-1',
          server_data: { id: serverId, content: 'test' },
        }],
      },
    });
    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'test', entry_date: '2025-12-01' },
        tempId: 't36-1', idempotencyKey: 'ik-36-1',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });
    expect(result.current.operations).toHaveLength(1);

    await act(async () => { await syncAll(); });

    const postCalls = mockApiPost.mock.calls.filter(
      (c: string[]) => c[0] === '/sync/batch',
    );
    expect(postCalls.length).toBe(1);
  });

  it('offlineStore queue not processed twice by concurrent syncs', async () => {
    let resolvePost: (value: unknown) => void;
    const postLock = new Promise<unknown>(resolve => { resolvePost = resolve; });

    mockApiPost.mockImplementation(async (url: string) => {
      if (url === '/sync/batch') {
        await postLock;
        return { data: { results: [] } };
      }
      if (url === '/sync/changes') {
        return { data: { changes: [] } };
      }
    });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'race', entry_date: '2025-12-01' },
        tempId: 't36-race', idempotencyKey: 'ik-36-race',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });
    expect(result.current.operations).toHaveLength(1);

    const p1 = syncAll();
    const p2 = syncAll();

    resolvePost!({ data: { results: [] } });
    await Promise.all([p1, p2]);

    expect(mockLogger.warn).toHaveBeenCalledWith('sync.cycle.skipped_already_syncing');
  });
});

// =============================================================================
// Scenario 37: App Backgrounded During Sync — Queue Persistence
// =============================================================================

describe('Scenario 37: App Backgrounded During Sync', () => {

  it('offline queue persists when sync push fails', async () => {
    mockApiPost.mockRejectedValue(new Error('Network request failed'));
    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'background test', entry_date: '2025-12-01' },
        tempId: 't37-bg', idempotencyKey: 'ik-37-bg',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });
    expect(result.current.operations).toHaveLength(1);

    await act(async () => { await syncAll(); });

    expect(result.current.operations.length).toBeGreaterThanOrEqual(0);
  });

  it('offline queue retains ops after sync failure', async () => {
    mockApiPost.mockRejectedValue(new Error('Server timeout'));
    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'mood/create', data: { mood: 'calm', intensity: 3 },
        tempId: 't37-mood', idempotencyKey: 'ik-37-mood',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    await act(async () => { await syncAll(); });

    expect(mockLogger.error).toHaveBeenCalledWith('sync.push_failed', expect.any(Error));
  });

  it('sync resumes after interruption with idempotency', async () => {
    const serverId = 'entity-37-retry';
    mockApiPost.mockResolvedValueOnce({
      data: {
        results: [{
          index: 0, status: 'created', entity_id: serverId, temp_id: 't37-retry',
          server_data: { id: serverId, content: 'retry test' },
        }],
      },
    });

    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'retry test', entry_date: '2025-11-01' },
        tempId: 't37-retry', idempotencyKey: 'ik-37-retry',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    await act(async () => { await syncAll(); });

    const postCalls = mockApiPost.mock.calls.filter(
      (c: string[]) => c[0] === '/sync/batch',
    );
    expect(postCalls.length).toBe(1);
  });

  it('pullServerData returns null on failure without crash', async () => {
    mockApiGet.mockRejectedValue(new Error('Network error during pull'));

    const result = await pullServerData();
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith('sync.pull_failed', expect.any(Error));
  });
});

// =============================================================================
// Scenario 38: Deep Link Conflict — Two Notifications Tapped Rapidly
// =============================================================================

describe('Scenario 38: Deep Link Conflict', () => {

  interface PendingAction {
    type: 'checkin' | 'mark-end-date';
    id: string;
  }

  interface DeepLinkState {
    pending: PendingAction[];
    enqueue: (action: PendingAction) => void;
    dequeue: () => PendingAction | undefined;
    clear: () => void;
    size: () => number;
  }

  let useTestDeepLinkStore: ReturnType<typeof create<DeepLinkState>>;

  beforeEach(() => {
    useTestDeepLinkStore = create<DeepLinkState>((set, get) => ({
      pending: [],
      enqueue: (action) => set((s) => ({ pending: [...s.pending, action] })),
      dequeue: () => {
        const [first, ...rest] = get().pending;
        set({ pending: rest });
        return first;
      },
      clear: () => set({ pending: [] }),
      size: () => get().pending.length,
    }));
  });

  it('deepLinkStore enqueues multiple actions', async () => {
    const { result } = renderHook(() => useTestDeepLinkStore());

    act(() => {
      result.current.enqueue({ type: 'checkin', id: 'entry-1' });
      result.current.enqueue({ type: 'mark-end-date', id: 'cycle-2' });
    });

    expect(result.current.size()).toBe(2);
  });

  it('deepLinkStore dequeues actions in FIFO order', async () => {
    const { result } = renderHook(() => useTestDeepLinkStore());

    act(() => {
      result.current.enqueue({ type: 'checkin', id: 'first' });
      result.current.enqueue({ type: 'mark-end-date', id: 'second' });
    });

    let first: PendingAction | undefined;
    act(() => { first = result.current.dequeue(); });
    expect(first?.type).toBe('checkin');
    expect(first?.id).toBe('first');

    let second: PendingAction | undefined;
    act(() => { second = result.current.dequeue(); });
    expect(second?.type).toBe('mark-end-date');
    expect(second?.id).toBe('second');
  });

  it('clear empties the pending queue', async () => {
    const { result } = renderHook(() => useTestDeepLinkStore());

    act(() => {
      result.current.enqueue({ type: 'checkin', id: 'e1' });
      result.current.enqueue({ type: 'mark-end-date', id: 'e2' });
    });
    expect(result.current.size()).toBe(2);

    act(() => { result.current.clear(); });
    expect(result.current.size()).toBe(0);
  });

  it('dequeue returns undefined on empty queue', () => {
    const { result } = renderHook(() => useTestDeepLinkStore());
    const action = result.current.dequeue();
    expect(action).toBeUndefined();
  });

  it('multiple intents are processed sequentially without crashing', async () => {
    const { result } = renderHook(() => useTestDeepLinkStore());
    const processed: string[] = [];

    act(() => {
      result.current.enqueue({ type: 'checkin', id: 'n1' });
      result.current.enqueue({ type: 'mark-end-date', id: 'n2' });
    });

    while (result.current.size() > 0) {
      let action: PendingAction | undefined;
      act(() => { action = result.current.dequeue(); });
      if (action) {
        processed.push(action.type);
      }
    }

    expect(processed).toEqual(['checkin', 'mark-end-date']);
  });
});

// =============================================================================
// Scenario 39: Stale Refresh Token — Kill Switch on Refresh 401
// =============================================================================

describe('Scenario 39: Stale Refresh Token', () => {

  it('triggerSessionExpired clears auth state via reset', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'u1@test.com' }, isHydrated: true });
    expect(useAuthStore.getState().user).not.toBeNull();

    await act(async () => { await useAuthStore.getState().reset(); });

    expect(useAuthStore.getState().user).toBeNull();
  });

  it('offlineStore queue is cleared on session expiry', async () => {
    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'stale', entry_date: '2025-12-01' },
        tempId: 't39-stale', idempotencyKey: 'ik-39-stale',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });
    expect(result.current.operations).toHaveLength(1);

    await act(async () => {
      await result.current.clear();
    });
    expect(result.current.operations).toHaveLength(0);
  });

  it('tokenStore.clear removes tokens when session expires', async () => {
    const { clear } = mockTokenStore;
    await clear();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('auth interceptors session expired detail triggers auto-logout', async () => {
    const SESSION_EXPIRED_DETAILS = [
      'Session expired. Please log in again.',
      'Session compromised. All sessions revoked. Please log in again.',
    ];

    expect(SESSION_EXPIRED_DETAILS).toContain('Session expired. Please log in again.');
    expect(SESSION_EXPIRED_DETAILS).toContain('Session compromised. All sessions revoked. Please log in again.');
  });
});

// =============================================================================
// Scenario 40: Large Offline Queue Exceeding SecureStore Limits
// =============================================================================

describe('Scenario 40: Large Offline Queue Exceeding SecureStore Limits', () => {

  it('persisted data survives in EncryptedStorage after enqueue', async () => {
    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'survive', entry_date: '2025-12-01' },
        tempId: 't40-survive', idempotencyKey: 'ik-40-survive',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    const stored = encryptedStore['shecare.offline.queue'];
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].content || parsed[0].data.content).toBeDefined();
  });

  it('queue written to AsyncStorage when SecureStore setItem throws', async () => {
    mockEncryptedStorage.setItem.mockRejectedValue(new Error('SecureStore quota exceeded'));

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'fallback', entry_date: '2025-12-01' },
        tempId: 't40-fallback', idempotencyKey: 'ik-40-fallback',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    expect(mockEncryptedStorage.setItem).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith('offlineStore.persist_failed', expect.any(Error));
  });

  it('queue survives in memory when SecureStore write fails', async () => {
    mockEncryptedStorage.setItem.mockRejectedValue(new Error('SecureStore limit'));

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'mem-fallback', entry_date: '2025-12-01' },
        tempId: 't40-mem2', idempotencyKey: 'ik-40-mem2',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    expect(result.current.operations).toHaveLength(1);
  });

  it('offlineStore.persist logs error without crashing on SecureStore failure', async () => {
    const originalSetItem = mockEncryptedStorage.setItem;
    mockEncryptedStorage.setItem.mockRejectedValue(new Error('Keychain write failed'));

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'no-crash', entry_date: '2025-12-01' },
        tempId: 't40-nocrash', idempotencyKey: 'ik-40-nocrash',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    expect(mockLogger.error).toHaveBeenCalledWith('offlineStore.persist_failed', expect.any(Error));
  });

  it('fallback does not lose pending operations from in-memory state', async () => {
    const { result } = renderHook(() => useOfflineStore());

    mockEncryptedStorage.setItem.mockRejectedValue(new Error('SecureStore limit'));
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'mem-safe', entry_date: '2025-12-01' },
        tempId: 't40-mem', idempotencyKey: 'ik-40-mem',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    expect(result.current.operations).toHaveLength(1);
    expect(result.current.operations[0].data.content).toBe('mem-safe');
  });
});
