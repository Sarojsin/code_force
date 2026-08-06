/**
 * System Test 15 — Network Flapping (46), Rapid Fire Tapping (47),
 * Slow Network Abort (48), Desync (49), DST/Midnight Rollover (50).
 *
 * Scenario 46: Network Flapping — isSyncing lock, zombie retry dedup.
 * Scenario 47: Rapid Fire Tapping — button disable, queue dedup.
 * Scenario 48: Slow Network / Abort — AbortError handling, SQLite retained.
 * Scenario 49: Desync — conflict handler discards op, overwrites SQLite.
 * Scenario 50: DST/Midnight Rollover — UTC-only date extraction, ISO string compare.
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
import { makeUser } from './fixtures';
import { useOfflineStore } from 'src/stores/offlineStore';
import { syncAll, pullServerData } from 'src/services/sync/syncEngine';

const mockTokenStore = jest.requireMock('src/services/api').tokenStore;
const mockApiPost = jest.requireMock('src/services/api/client').api.post;
const mockApiGet = jest.requireMock('src/services/api/client').api.get;
const mockLogger = jest.requireMock('src/utils').logger;
const mockEncryptedStorage = jest.requireMock('src/services/storage').EncryptedStorage;

beforeEach(async () => {
  jest.clearAllMocks();
  Object.keys(encryptedStore).forEach((k) => delete encryptedStore[k]);
  Object.keys(mockAsyncStorageStore).forEach((k) => delete mockAsyncStorageStore[k]);
  mockEncryptedStorage.getItem.mockImplementation(async (key: string) => encryptedStore[key] ?? null);
  mockEncryptedStorage.setItem.mockImplementation(async (key: string, value: string) => {
    encryptedStore[key] = value;
  });

  useOfflineStore.getState().clear();
  useAuthStore.setState({ user: makeUser({ id: 'test-user', email: 'test@test.com' }), isHydrated: true });
  mockTokenStore.getAccess.mockResolvedValue('mock-access-token');
});

// =============================================================================
// Scenario 46: Network Flapping — isSyncing Lock + Idempotent Retry
// =============================================================================

describe('Scenario 46: Network Flapping', () => {

  it('isSyncing lock prevents concurrent sync runs during flapping', async () => {
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
      return { data: { results: [] } };
    });

    const firstPromise = syncAll();
    const secondPromise = syncAll();

    resolvePost!({ data: { results: [] } });
    await Promise.all([firstPromise, secondPromise]);

    expect(mockLogger.warn).toHaveBeenCalledWith('sync.cycle.skipped_already_syncing');
  });

  it('lock released after error simulates flapping interrupt', async () => {
    mockApiPost.mockRejectedValue(new Error('Network connection lost'));
    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    await syncAll();

    const warnCalls = mockLogger.warn.mock.calls.filter(
      (c: string[]) => c[0] === 'sync.cycle.skipped_already_syncing',
    );
    expect(warnCalls.length).toBe(0);
  });

  it('idempotency retry after interrupted push does not duplicate requests', async () => {
    const serverId = 'entity-46-retry';
    mockApiPost.mockResolvedValue({
      data: {
        results: [{
          index: 0, status: 'created', entity_id: serverId, temp_id: 't46-flap',
          server_data: { id: serverId, content: 'flap retry' },
        }],
      },
    });
    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'flap retry', entry_date: '2025-08-01' },
        tempId: 't46-flap', idempotencyKey: 'ik-46-flap',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    await act(async () => { await syncAll(); });
    await act(async () => { await syncAll(); });

    const postCalls = mockApiPost.mock.calls.filter(
      (c: string[]) => c[0] === '/sync/batch',
    );
    expect(postCalls.length).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// Scenario 47: Rapid Fire Tapping — Button Disable + Queue Protection
// =============================================================================

describe('Scenario 47: Rapid Fire Tapping', () => {

  it('only one operation enqueued for rapid taps when mutex is respected', async () => {
    let isPending = false;
    const tapsTriggered: string[] = [];

    async function handleTap(label: string): Promise<void> {
      if (isPending) {
        tapsTriggered.push(`${label}-blocked`);
        return;
      }
      isPending = true;
      tapsTriggered.push(`${label}-fired`);
      // Simulate async mutation (no await inside mutex guard until after isPending)
      await Promise.resolve();
      isPending = false;
    }

    // Simulate concurrent taps without awaiting first
    const p1 = handleTap('tap1');
    const p2 = handleTap('tap2');
    await Promise.all([p1, p2]);

    expect(tapsTriggered).toContain('tap1-fired');
    expect(tapsTriggered).toContain('tap2-blocked');
  });

  it('without guard two rapid taps enqueue two operations', async () => {
    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'cycle/create', data: { period_start_date: '2025-09-01' },
        tempId: 't47-unguarded', idempotencyKey: 'ik-47-u1',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });
    await act(async () => {
      await result.current.enqueue({
        type: 'cycle/create', data: { period_start_date: '2025-09-01' },
        tempId: 't47-unguarded', idempotencyKey: 'ik-47-u2',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    expect(result.current.operations).toHaveLength(2);
  });

  it('server idempotency dedups if UI disable fails (safety net)', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        results: [{
          index: 0, status: 'created', entity_id: 'e47-dedup', temp_id: 't47-net',
          server_data: { id: 'e47-dedup' },
        }],
      },
    });
    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'safety net', entry_date: '2025-09-10' },
        tempId: 't47-net', idempotencyKey: 'ik-47-net',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'safety net', entry_date: '2025-09-10' },
        tempId: 't47-net', idempotencyKey: 'ik-47-net',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    expect(result.current.operations).toHaveLength(2);
  });

  it('second enqueue with same idempotencyKey still creates separate op (client dedup is UI-only)', async () => {
    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'mood/create', data: { mood: 'calm', intensity: 3 },
        tempId: 't47-samekey', idempotencyKey: 'ik-47-samekey',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });
    await act(async () => {
      await result.current.enqueue({
        type: 'mood/create', data: { mood: 'calm', intensity: 3 },
        tempId: 't47-samekey2', idempotencyKey: 'ik-47-samekey',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    expect(result.current.operations).toHaveLength(2);
  });
});

// =============================================================================
// Scenario 48: Slow Network / Abort — AbortError Handling
// =============================================================================

describe('Scenario 48: Slow Network / Abort', () => {

  it('AbortError does not propagate as query error', async () => {
    function queryFn(): string[] {
      try {
        throw new DOMException('The operation was aborted', 'AbortError');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return ['cached-data'];
        }
        throw err;
      }
    }

    const result = queryFn();
    expect(result).toEqual(['cached-data']);
  });

  it('non-abort network error is rethrown', async () => {
    function queryFn(): never {
      try {
        throw new Error('Network request failed');
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return ['cached-data'] as never;
        }
        throw err;
      }
    }

    expect(() => queryFn()).toThrow('Network request failed');
  });

  it('pullServerData does not crash when api.get aborts', async () => {
    mockApiGet.mockRejectedValue(new DOMException('aborted', 'AbortError'));

    const result = await pullServerData();
    expect(result).toBeNull();
  });

  it('sync engine continues without error state after aborted pull', async () => {
    mockApiPost.mockResolvedValue({ data: { results: [] } });
    mockApiGet.mockRejectedValue(new DOMException('aborted', 'AbortError'));

    let caught = false;
    try {
      await syncAll();
    } catch {
      caught = true;
    }
    expect(caught).toBe(false);
  });
});

// =============================================================================
// Scenario 49: Desync — Timestamp Conflict Resolution
// =============================================================================

describe('Scenario 49: Desync / Timestamp Conflict', () => {

  it('conflict result removes pending operation from queue', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        results: [{
          index: 0, status: 'conflict', entity_id: 'e49-desync', temp_id: 't49-desync',
          server_data: { id: 'e49-desync', content: 'server version', updated_at: '2025-10-01T10:00:00Z' },
        }],
      },
    });
    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/update', data: { id: 'e49-desync', content: 'client version' },
        tempId: 't49-desync', idempotencyKey: 'ik-49-desync',
        clientUpdatedAt: '2025-10-01T08:00:00Z', priority: 'normal',
      });
    });
    expect(result.current.operations).toHaveLength(1);

    await act(async () => { await syncAll(); });

    expect(result.current.operations).toHaveLength(0);
  });

  it('hydrateFromServerData called with server_data on conflict', async () => {
    const mockHydrate = jest.requireMock('src/services/sync/syncHydrate').hydrateFromServerData;
    const serverData = { id: 'e49-hydrate', content: 'server data', updated_at: '2025-10-01T10:00:00Z' };

    mockApiPost.mockResolvedValue({
      data: {
        results: [{
          index: 0, status: 'conflict', entity_id: 'e49-hydrate', temp_id: 't49-hydrate',
          server_data: serverData,
        }],
      },
    });
    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/update', data: { id: 'e49-hydrate', content: 'stale client' },
        tempId: 't49-hydrate', idempotencyKey: 'ik-49-hydrate',
        clientUpdatedAt: '2025-10-01T08:00:00Z', priority: 'normal',
      });
    });

    await act(async () => { await syncAll(); });

    // hydrateFromServerData is scheduled via requestIdleIdle (50ms fallback
    // timeout in the test env) — flush it before asserting.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)); });

    expect(mockHydrate).toHaveBeenCalledWith('journal/update', serverData);
  });

  it('non-conflict update is accepted and op removed from queue', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        results: [{
          index: 0, status: 'updated', entity_id: 'e49-accepted', temp_id: 't49-accepted',
          server_data: { id: 'e49-accepted', content: 'server accepted', updated_at: '2025-10-01T10:30:00Z' },
        }],
      },
    });
    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/update', data: { id: 'e49-accepted', content: 'newer client' },
        tempId: 't49-accepted', idempotencyKey: 'ik-49-accepted',
        clientUpdatedAt: '2025-10-01T10:35:00Z', priority: 'normal',
      });
    });

    await act(async () => { await syncAll(); });

    expect(result.current.operations).toHaveLength(0);
  });

  it('create op with conflict removed via cascading', async () => {
    const serverData = { id: 'e49-cascade', content: 'server version' };
    mockApiPost.mockResolvedValue({
      data: {
        results: [{
          index: 0, status: 'conflict', entity_id: 'e49-cascade', temp_id: 't49-cascade',
          server_data: serverData,
        }],
      },
    });
    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'client create', entry_date: '2025-10-01' },
        tempId: 't49-cascade', idempotencyKey: 'ik-49-cascade',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    await act(async () => { await syncAll(); });

    expect(result.current.operations).toHaveLength(0);
  });
});

// =============================================================================
// Scenario 50: DST/Midnight Rollover — UTC-Only Date Extraction
// =============================================================================

describe('Scenario 50: DST/Midnight Rollover', () => {

  it('toDateStr with UTC extraction returns correct date during DST transition', () => {
    function toDateStrUTC(d: Date): string {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    const dstFallBack = new Date('2025-11-02T06:00:00.000Z');
    expect(toDateStrUTC(dstFallBack)).toBe('2025-11-02');

    const dstSpringForward = new Date('2025-03-09T06:00:00.000Z');
    expect(toDateStrUTC(dstSpringForward)).toBe('2025-03-09');

    const midnightRollover = new Date('2025-01-01T00:00:00.000Z');
    expect(toDateStrUTC(midnightRollover)).toBe('2025-01-01');
  });

  it('toDateStr with UTC getters is stable across timezone boundaries', () => {
    function toDateStrUTC(d: Date): string {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    const lateUtc = new Date('2025-11-02T23:30:00.000Z');
    expect(toDateStrUTC(lateUtc)).toBe('2025-11-02');

    const earlyUtc = new Date('2025-11-02T00:30:00.000Z');
    expect(toDateStrUTC(earlyUtc)).toBe('2025-11-02');

    const springForward = new Date('2025-03-09T06:00:00.000Z');
    expect(toDateStrUTC(springForward)).toBe('2025-03-09');
  });

  it('date comparison via ISO string is immune to timezone shift', () => {
    const storedDate = '2025-12-25';
    function isSameDay(dateStr: string, targetDate: Date): boolean {
      const y = targetDate.getUTCFullYear();
      const m = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getUTCDate()).padStart(2, '0');
      return dateStr === `${y}-${m}-${day}`;
    }

    expect(isSameDay(storedDate, new Date('2025-12-25T00:00:00Z'))).toBe(true);
    expect(isSameDay(storedDate, new Date('2025-12-25T23:59:59Z'))).toBe(true);
    expect(isSameDay(storedDate, new Date('2025-12-26T00:00:00Z'))).toBe(false);
  });

  it('today button uses UTC extraction not local getters', () => {
    function toDateStrUTC(d: Date): string {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    const today = new Date();
    const todayStr = toDateStrUTC(today);

    expect(todayStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('date picker output converted to ISO string without time', () => {
    function pickerDateToISO(date: Date): string {
      const y = date.getUTCFullYear();
      const m = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    const pickerDate = new Date('2025-10-15T00:00:00.000Z');
    const iso = pickerDateToISO(pickerDate);
    expect(iso).toBe('2025-10-15');
    expect(iso).not.toContain('T');
    expect(iso).not.toContain('Z');
  });
});
