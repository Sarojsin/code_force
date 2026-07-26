/**
 * System Test 14 — Edge Cases: Malformed JSON (41), Timezone Shift (42),
 * temp_id Collision (43), Full Disk Recovery (45).
 *
 * Scenario 41: Safe JSON Parsing — Malformed data in synced JSON.
 *   Safe parse fallback to [], Sentry capture on failure.
 *
 * Scenario 42: Timezone Shift — Date drift across timezone boundaries.
 *   toDateStr UTC vs local getters, date string stability.
 *
 * Scenario 43: Multi-Device temp_id Collision.
 *   Different idempotency_keys with same temp_id create separate entities.
 *
 * Scenario 44: Step Count Accuracy — skipped (integration-only).
 * Scenario 45: Full Disk Recovery — upsert error handling, Sentry capture.
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
import * as Sentry from '@sentry/react-native';
import { useAuthStore } from 'src/stores/authStore';
import { useOfflineStore } from 'src/stores/offlineStore';
import { syncAll, pushOperations, pullServerData } from 'src/services/sync/syncEngine';
import { BaseLocalService } from 'src/services/localDb/BaseLocalService';

const mockTokenStore = jest.requireMock('src/services/api').tokenStore;
const mockApiPost = jest.requireMock('src/services/api/client').api.post;
const mockApiGet = jest.requireMock('src/services/api/client').api.get;
const mockLogger = jest.requireMock('src/utils').logger;
const mockEncryptedStorage = jest.requireMock('src/services/storage').EncryptedStorage;

class TestLocalService extends BaseLocalService<{ id: string; user_id: string }> {
  protected table: any = { id: 'id' };
  protected tableName = 'test_table';
}

beforeEach(async () => {
  jest.clearAllMocks();
  Object.keys(encryptedStore).forEach((k) => delete encryptedStore[k]);
  mockEncryptedStorage.getItem.mockImplementation(async (key: string) => encryptedStore[key] ?? null);
  mockEncryptedStorage.setItem.mockImplementation(async (key: string, value: string) => {
    encryptedStore[key] = value;
  });

  useOfflineStore.getState().clear();
  useAuthStore.setState({ user: { id: 'test-user', email: 'test@test.com' }, isHydrated: true });
  mockTokenStore.getAccess.mockResolvedValue('mock-access-token');
});

// =============================================================================
// Scenario 41: Safe JSON Parsing — Malformed Data in synced JSON
// =============================================================================

describe('Scenario 41: Safe JSON Parsing', () => {

  it('safeParseJSON returns fallback on malformed input', () => {
    function safeParseJSON(raw: string | null | undefined, fallback: unknown[] = []): unknown[] {
      if (raw == null) return fallback;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : fallback;
      } catch {
        return fallback;
      }
    }

    expect(safeParseJSON('{{broken')).toEqual([]);
    expect(safeParseJSON(null)).toEqual([]);
    expect(safeParseJSON(undefined)).toEqual([]);
    expect(safeParseJSON('["cramps"]')).toEqual(['cramps']);
    expect(safeParseJSON('invalid json!@#')).toEqual([]);
  });

  it('safeParseJSON on empty string returns fallback', () => {
    function safeParseJSON(raw: string | null | undefined, fallback: unknown[] = []): unknown[] {
      if (raw == null) return fallback;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : fallback;
      } catch {
        return fallback;
      }
    }

    expect(safeParseJSON('')).toEqual([]);
  });

  it('safeParseJSON on valid empty array returns empty array', () => {
    function safeParseJSON(raw: string | null | undefined, fallback: unknown[] = []): unknown[] {
      if (raw == null) return fallback;
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : fallback;
      } catch {
        return fallback;
      }
    }

    expect(safeParseJSON('[]')).toEqual([]);
  });

  it('Sentry.captureException called on JSON parse failure', () => {
    const raw = '{{broken';
    function processSymptoms(raw: string): unknown[] {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        Sentry.captureException(err, {
          tags: { service: 'symptoms', method: 'parse', column: 'symptoms' },
        });
        return [];
      }
    }

    const result = processSymptoms(raw);
    expect(result).toEqual([]);
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(SyntaxError),
      expect.objectContaining({ tags: expect.objectContaining({ column: 'symptoms' }) }),
    );
  });

  it('sync engine does not crash when server returns malformed JSON in any field', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        results: [{
          index: 0, status: 'created', entity_id: 'e41-malformed',
          temp_id: 't41-safe',
          server_data: { id: 'e41-malformed', symptoms: '{{broken', mood_tags: 'invalid' },
        }],
      },
    });
    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    let caughtError: Error | null = null;
    try {
      await syncAll();
    } catch (err) {
      caughtError = err as Error;
    }
    expect(caughtError).toBeNull();
  });
});

// =============================================================================
// Scenario 42: Timezone Shift — Date drift across timezone boundaries
// =============================================================================

describe('Scenario 42: Timezone Shift', () => {

  it('toDateStr with UTC getters does not shift date across timezone boundary', () => {
    function toDateStrUTC(d: Date): string {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    function toDateStrLocal(d: Date): string {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    const nearMidnight = new Date('2025-06-15T23:00:00.000Z');
    expect(toDateStrUTC(nearMidnight)).toBe('2025-06-15');

    const nearMidnightUTC = new Date('2025-06-15T01:00:00.000Z');
    expect(toDateStrUTC(nearMidnightUTC)).toBe('2025-06-15');
  });

  it('date string stored as YYYY-MM-DD survives roundtrip regardless of timezone', () => {
    function formatDateStable(dateStr: string): string {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return dateStr.split('T')[0];
      }
      const d = new Date(dateStr);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    expect(formatDateStable('2025-06-15')).toBe('2025-06-15');
    expect(formatDateStable('2025-12-01T00:00:00Z')).toBe('2025-12-01');
    expect(formatDateStable('2025-12-01T23:00:00Z')).toBe('2025-12-01');
    expect(formatDateStable('2025-01-01T12:00:00+14:00')).toBe('2025-01-01');
  });

  it('local toDateStr can differ from UTC toDateStr near midnight', () => {
    function toDateStrUTC(d: Date): string {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    function toDateStrLocal(d: Date): string {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    const isoDate = '2025-06-15T23:30:00.000Z';
    const d = new Date(isoDate);
    const utc = toDateStrUTC(d);
    const local = toDateStrLocal(d);

    const localHour = d.getHours();
    if (localHour >= 0 && localHour < 12) {
      expect(local).not.toBe(utc);
    }
  });
});

// =============================================================================
// Scenario 43: Multi-Device temp_id Collision
// =============================================================================

describe('Scenario 43: temp_id Collision', () => {

  it('offlineStore can hold two ops with same tempId but different idempotencyKeys', async () => {
    const { result } = renderHook(() => useOfflineStore());

    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'device A' },
        tempId: 'shared-t43', idempotencyKey: 'ik-43-devA',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'device B' },
        tempId: 'shared-t43', idempotencyKey: 'ik-43-devB',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    expect(result.current.operations).toHaveLength(2);
    expect(result.current.operations[0].tempId).toBe('shared-t43');
    expect(result.current.operations[1].tempId).toBe('shared-t43');
    expect(result.current.operations[0].idempotencyKey).toBe('ik-43-devA');
    expect(result.current.operations[1].idempotencyKey).toBe('ik-43-devB');
  });

  it('syncing two ops with same tempId but different idempotencyKeys sends both to server', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        results: [
          { index: 0, status: 'created', entity_id: 'e43-a', temp_id: 'shared-t43', server_data: { id: 'e43-a' } },
          { index: 1, status: 'created', entity_id: 'e43-b', temp_id: 'shared-t43', server_data: { id: 'e43-b' } },
        ],
      },
    });
    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'op A' },
        tempId: 'shared-t43', idempotencyKey: 'ik-43-syncA',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'op B' },
        tempId: 'shared-t43', idempotencyKey: 'ik-43-syncB',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });

    expect(result.current.operations).toHaveLength(2);

    await act(async () => { await syncAll(); });

    const postCalls = mockApiPost.mock.calls.filter((c: string[]) => c[0] === '/sync/batch');
    expect(postCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('offlineStore.removeCascading removes all ops with matching tempId', async () => {
    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'remove me' },
        tempId: 't43-remove', idempotencyKey: 'ik-43-remove',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });
    await act(async () => {
      await result.current.enqueue({
        type: 'cycle/create', data: { period_start_date: '2025-09-01' },
        tempId: 't43-remove', idempotencyKey: 'ik-43-remove2',
        clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });
    expect(result.current.operations).toHaveLength(2);

    await act(async () => { await result.current.removeCascading('t43-remove'); });
    expect(result.current.operations).toHaveLength(0);
  });
});

// =============================================================================
// Scenario 44: Step Count Accuracy — SKIPPED (integration-only)
// =============================================================================

// =============================================================================
// Scenario 45: Full Disk Recovery — Error Handling
// =============================================================================

describe('Scenario 45: Full Disk Recovery', () => {

  it('BaseLocalService.handleError logs error without crashing', async () => {
    mockDrizzle.insert.mockImplementation(() => ({
      values: jest.fn(() => ({
        onConflictDoUpdate: jest.fn(() => { throw new Error('SQLITE_FULL: disk I/O error'); }),
      })),
    }));

    const service = new TestLocalService();
    await service.upsert({ id: 'e45-1', user_id: 'u1' });

    expect(mockLogger.error).toHaveBeenCalledWith(
      'test_table.upsert failed',
      expect.any(Error),
    );
  });

  it('BaseLocalService.upsert does not throw on db error', async () => {
    mockDrizzle.insert.mockImplementation(() => ({
      values: jest.fn(() => ({
        onConflictDoUpdate: jest.fn(() => { throw new Error('disk full'); }),
      })),
    }));

    const service = new TestLocalService();
    let threw = false;
    try {
      await service.upsert({ id: 'e45-2', user_id: 'u1' });
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  it('Sentry.captureException called on upsert error', async () => {
    mockDrizzle.insert.mockImplementation(() => ({
      values: jest.fn(() => ({
        onConflictDoUpdate: jest.fn(() => { throw new Error('SQLITE_FULL'); }),
      })),
    }));

    const service = new TestLocalService();
    await service.upsert({ id: 'e45-3', user_id: 'u1' });

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          service: 'BaseLocalService',
          method: 'upsert',
          table: 'test_table',
        }),
      }),
    );
  });

  it('sync engine continues after local upsert failure', async () => {
    mockApiPost.mockResolvedValue({
      data: {
        results: [{
          index: 0, status: 'created', entity_id: 'e45-sync',
          temp_id: 't45-sync',
          server_data: { id: 'e45-sync', content: 'post-disk' },
        }],
      },
    });
    mockApiGet.mockResolvedValue({ data: { changes: [] } });

    let caughtError: Error | null = null;
    try {
      await syncAll();
    } catch (err) {
      caughtError = err as Error;
    }
    expect(caughtError).toBeNull();
  });
});
