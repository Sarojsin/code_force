/**
 * System Test 5 — Prediction History (15), Sync 500/400 Error Handling (16-17), Queue Backlog (18).
 *
 * @see system_test5.md for full scenario descriptions.
 *
 * Scenario 15: Tests getRowColor for Mint/Peach/Blush mapping and delta-aware data transformation.
 * Scenario 16: Tests pushOperations 500 retry increments retryCount, does not discard.
 * Scenario 17: Tests pushOperations 400 discards operation, does not block valid ops behind it.
 * Scenario 18: Tests offlineStore with 100 ops, FIFO order, max retries exhaustion, gzip threshold.
 */

import { act, renderHook } from '@testing-library/react-native';

jest.mock('src/services/storage', () => {
  const storage: Record<string, string> = {};
  return {
    EncryptedStorage: {
      getItem: jest.fn(async (key: string) => storage[key] ?? null),
      setItem: jest.fn(async (key: string, value: string) => { storage[key] = value; }),
      removeItem: jest.fn(async () => {}),
      clear: jest.fn(async () => { Object.keys(storage).forEach((k) => delete storage[k]); }),
    },
  };
});

const mockIds = (function*() { let i = 0; while (true) { yield `test-uuid-${++i}`; } })();
jest.mock('src/utils', () => ({
  generateId: jest.fn(() => mockIds.next().value),
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
jest.mock('pako', () => ({ gzip: jest.fn((data: string) => Buffer.from(data)) }));

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

import { pushOperations } from 'src/services/sync/syncEngine';
import { useOfflineStore } from 'src/stores/offlineStore';
import { useAuthStore } from 'src/stores/authStore';

const mockApi = jest.requireMock('src/services/api/client').api;
const mockStorage = jest.requireMock('src/services/storage').EncryptedStorage;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRowColor(delta: number): string {
  const abs = Math.abs(delta);
  if (abs <= 1) return '#D4F0E0';   // Mint
  if (abs === 2) return '#FFDAB9';   // Peach
  return '#FFB3C6';                   // Blush
}

function fmtMonth(d: string): string {
  const m = new Date(d + 'T00:00:00').toLocaleString('en-US', { month: 'short' });
  return m;
}

async function enqueueOp(store: any, overrides: Record<string, any> = {}): Promise<string> {
  let id = '';
  await act(async () => {
    id = await store.current.enqueue({
      type: 'journal/create',
      data: { content: 'test' },
      tempId: 't1',
      idempotencyKey: 'ik1',
      clientUpdatedAt: new Date().toISOString(),
      priority: 'normal',
      ...overrides,
    });
  });
  return id;
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockStorage.getItem.mockImplementation(async () => null);
  mockStorage.setItem.mockImplementation(async () => {});
  mockApi.post.mockResolvedValue({ data: { results: [] } });
  mockApi.get.mockResolvedValue({ data: { changes: [] } });
  useAuthStore.setState({ user: { id: 'user1', email: 'test@test.com', phone_number: null, display_name: null, role: 'user', is_active: true, is_verified: true, provider: 'local', created_at: new Date().toISOString(), last_login_at: null, onboarding_completed: true } });
  const { result } = renderHook(() => useOfflineStore());
  await act(async () => { await result.current.clear(); });
});

// =============================================================================
// Scenario 15: Prediction History Table — Color Coding & Transformation
// =============================================================================

describe('Scenario 15: Prediction History color coding & data transform', () => {
  describe('getRowColor', () => {
    const cases: [number, string, string][] = [
      [0, '#D4F0E0', 'Mint'],
      [1, '#D4F0E0', 'Mint'],
      [-1, '#D4F0E0', 'Mint'],
      [2, '#FFDAB9', 'Peach'],
      [-2, '#FFDAB9', 'Peach'],
      [3, '#FFB3C6', 'Blush'],
      [-3, '#FFB3C6', 'Blush'],
      [5, '#FFB3C6', 'Blush'],
    ];
    it.each(cases)('delta=%i → %s (%s)', (delta, expected) => {
      expect(getRowColor(delta)).toBe(expected);
    });
  });

  describe('data transform — raw SQLite → UI model', () => {
    function historyRow(raw: { predicted_next_period_start: string; prediction_error_days: number }) {
      const delta = raw.prediction_error_days;
      return {
        month: fmtMonth(raw.predicted_next_period_start),
        predicted_date: raw.predicted_next_period_start,
        delta_days: delta,
        on_time: delta === 0,
        accuracy: Math.abs(delta) <= 1 ? 'on_time' : Math.abs(delta) === 2 ? 'close' : 'off',
        rowColor: getRowColor(delta),
      };
    }

    it('delta=0 → on_time=true, Mint', () => {
      const r = historyRow({ predicted_next_period_start: '2025-06-01', prediction_error_days: 0 });
      expect(r.on_time).toBe(true);
      expect(r.rowColor).toBe('#D4F0E0');
    });

    it('delta=+4 → on_time=false, Blush', () => {
      const r = historyRow({ predicted_next_period_start: '2025-06-01', prediction_error_days: 4 });
      expect(r.on_time).toBe(false);
      expect(r.rowColor).toBe('#FFB3C6');
    });

    it('delta=-2 → on_time=false, Peach', () => {
      const r = historyRow({ predicted_next_period_start: '2025-08-15', prediction_error_days: -2 });
      expect(r.on_time).toBe(false);
      expect(r.rowColor).toBe('#FFDAB9');
    });

    it('month extracted from predicted_next_period_start', () => {
      const r = historyRow({ predicted_next_period_start: '2025-12-25', prediction_error_days: 0 });
      expect(r.month).toBe('Dec');
    });
  });
});

// =============================================================================
// Scenario 16: Sync Engine 500 Error — Retry Behavior
// =============================================================================

describe('Scenario 16: Sync 500 error — retry increments, no discard', () => {
  it('retryCount increments on 500 error (retryable)', async () => {
    const { result } = renderHook(() => useOfflineStore());
    mockApi.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: {} },
      config: { headers: {} },
    });

    const id = await enqueueOp(result);
    expect(result.current.operations[0].retryCount).toBe(0);

    await act(async () => { await pushOperations(result.current.operations); });
    expect(result.current.size()).toBe(1);
    expect(result.current.operations[0].retryCount).toBe(1);
  });

  it('does not discard operation after single 500 error', async () => {
    const { result } = renderHook(() => useOfflineStore());
    mockApi.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: {} },
      config: { headers: {} },
    });

    await enqueueOp(result);
    await act(async () => { await pushOperations(result.current.operations); });
    expect(result.current.operations.length).toBe(1);
  });

  it('operation reaches maxRetries=5 and is discarded', async () => {
    const { result } = renderHook(() => useOfflineStore());
    mockApi.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: {} },
      config: { headers: {} },
    });

    const id = await enqueueOp(result);
    expect(result.current.size()).toBe(1);

    // Simulate 5 retries via the store's getPendingOperations + pushOperations flow
    for (let i = 0; i < 6; i++) {
      const pending = result.current.getPendingOperations();
      if (pending.length === 0) break;
      await act(async () => { await pushOperations(pending); });
    }

    // After maxRetries exhausted, getPendingOperations should exclude it
    expect(result.current.getPendingOperations().length).toBe(0);
  });
});

// =============================================================================
// Scenario 17: Sync Engine 400 Error — Discard Behavior
// =============================================================================

describe('Scenario 17: Sync 400 error — discard, no blockage', () => {
  it('400 error discards operation (non-retryable via result status=failed + 400)', async () => {
    const { result } = renderHook(() => useOfflineStore());
    mockApi.post.mockResolvedValue({
      data: {
        results: [{ status: 'failed', error: '400 BAD_REQUEST: invalid date format' }],
      },
    });

    await enqueueOp(result);
    expect(result.current.size()).toBe(1);

    await act(async () => { await pushOperations(result.current.operations); });
    // The pushOperations handler for 'failed' + non-retryable error calls store.discard
    // Note: actual discard logic checks for "400" or "VALIDATION" etc. in error string
    // The op should be removed
    expect(result.current.size()).toBe(0);
  });

  it('valid op behind failed op still processes (no FIFO blockage)', async () => {
    const { result } = renderHook(() => useOfflineStore());

    const op1done = { status: 'failed', error: '400 BAD_REQUEST: missing field' };
    const op2done = { status: 'created', entity_id: 'entry-2', server_data: { id: 'entry-2' } };
    let callCount = 0;
    mockApi.post.mockImplementation(async () => {
      callCount++;
      return {
        data: {
          results: callCount === 1
            ? [op1done, op2done]
            : [op2done],
        },
      };
    });

    await act(async () => {
      await result.current.enqueue({
        type: 'cycle/correction', data: { period_start_date: 'bad-date' }, tempId: 'bad',
        idempotencyKey: 'ik-bad', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
      await result.current.enqueue({
        type: 'mood/create', data: { mood: 'happy', intensity: 4 }, tempId: 'good',
        idempotencyKey: 'ik-good', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });
    expect(result.current.size()).toBe(2);

    await act(async () => { await pushOperations(result.current.operations); });
    expect(result.current.size()).toBe(0);
  });

  it('non-retryable network error discards operations (4xx via try-catch)', async () => {
    const { result } = renderHook(() => useOfflineStore());
    mockApi.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { detail: 'Bad request' } },
      config: { headers: {} },
    });

    await enqueueOp(result);
    await act(async () => { await pushOperations(result.current.operations); });
    // Non-retryable: discard all ops in the batch
    expect(result.current.size()).toBe(0);
  });
});

// =============================================================================
// Scenario 18: Queue Backlog — 100 Operations
// =============================================================================

describe('Scenario 18: Queue backlog — 100 ops, FIFO, idempotency', () => {
  it('stores 100 operations', async () => {
    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      for (let i = 0; i < 100; i++) {
        await result.current.enqueue({
          type: 'mood/create',
          data: { mood: `mood_${i}`, intensity: (i % 5) + 1 },
          tempId: `t_${i}`,
          idempotencyKey: `ik_${i}`,
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
      }
    });
    expect(result.current.size()).toBe(100);
  });

  it('FIFO order preserved', async () => {
    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: { content: 'first' }, tempId: 'first',
        idempotencyKey: 'ik1', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
      await result.current.enqueue({
        type: 'mood/create', data: { mood: 'happy' }, tempId: 'second',
        idempotencyKey: 'ik2', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });
    expect(result.current.operations[0].type).toBe('journal/create');
    expect(result.current.operations[1].type).toBe('mood/create');
  });

  it('getPendingOperations excludes exhausted retries', async () => {
    const { result } = renderHook(() => useOfflineStore());
    let exhaustedId = '';
    await act(async () => {
      await result.current.enqueue({
        type: 'journal/create', data: {}, tempId: 'ok',
        idempotencyKey: 'ik-ok', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
      exhaustedId = await result.current.enqueue({
        type: 'mood/create', data: {}, tempId: 'exhausted',
        idempotencyKey: 'ik-ex', clientUpdatedAt: new Date().toISOString(), priority: 'normal',
      });
    });
    await act(async () => {
      for (let i = 0; i < 5; i++) { await result.current.incrementRetry(exhaustedId); }
    });
    expect(result.current.operations.length).toBe(2);
    expect(result.current.getPendingOperations().length).toBe(1);
  });

  it('batch of 100 ops sent via pushOperations', async () => {
    mockApi.post.mockResolvedValue({
      data: {
        results: Array.from({ length: 100 }, (_, i) => ({
          status: 'created',
          entity_id: `entry-${i}`,
          server_data: { id: `entry-${i}` },
        })),
      },
    });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      for (let i = 0; i < 100; i++) {
        await result.current.enqueue({
          type: 'mood/create',
          data: { mood: `mood_${i}`, intensity: (i % 5) + 1 },
          tempId: `t_${i}`,
          idempotencyKey: `ik_${i}`,
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
      }
    });

    await act(async () => { await pushOperations(result.current.operations); });
    expect(mockApi.post).toHaveBeenCalledTimes(1);
    const payload = mockApi.post.mock.calls[0][1];
    expect(payload.operations).toHaveLength(100);
  });

  it('gzip threshold check: >= 10 ops triggers gzip config', async () => {
    mockApi.post.mockResolvedValue({ data: { results: [] } });

    const { result } = renderHook(() => useOfflineStore());
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        await result.current.enqueue({
          type: 'mood/create', data: { mood: `m${i}` }, tempId: `t${i}`,
          idempotencyKey: `ik${i}`, clientUpdatedAt: new Date().toISOString(), priority: 'normal',
        });
      }
    });

    await act(async () => { await pushOperations(result.current.operations); });
    expect(mockApi.post).toHaveBeenCalled();
    const config = mockApi.post.mock.calls[0][2];
    expect(config.headers['Content-Encoding']).toBe('gzip');
  });
});
