import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import React from 'react';

jest.mock('src/services/storage', () => {
  const store: Record<string, string> = {};
  return {
    EncryptedStorage: {
      getItem: jest.fn(async (key: string) => store[key] ?? null),
      setItem: jest.fn(async (key: string, val: string) => { store[key] = val; }),
      removeItem: jest.fn(async (key: string) => { delete store[key]; }),
      clear: jest.fn(async () => { Object.keys(store).forEach((k) => delete store[k]); }),
      __store: store,
    },
  };
});

jest.mock('src/utils', () => ({
  ...jest.requireActual('src/utils'),
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('src/utils/uuid', () => ({
  generateUUID: jest.fn(),
  generateId: jest.fn(),
}));

jest.mock('@sentry/react-native', () => ({
  setTag: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.mock('src/services/api/client', () => ({
  api: {
    get: jest.fn(),
    put: jest.fn(),
  },
}));

import {
  applyServerState,
  getLunaKeys,
  reconcileLunaState,
  syncLunaState,
  useLunaState,
  usePushLunaState,
} from 'src/services/companion/lunaSyncClient';
import type { LunaServerState } from 'src/services/companion/lunaSyncClient';
import { companionLocalService } from 'src/services/localDb/CompanionLocalService';
import { useCompanionStore } from 'src/stores/companionStore';
import { useAuthStore } from 'src/stores/authStore';
import { EncryptedStorage } from 'src/services/storage';

const USER = 'user-luna-int';
const QUEUE_KEY = `shecare.luna.offline.queue.${USER}`;

const mockApi = jest.requireMock('src/services/api/client').api;
const mockStorage = jest.requireMock('src/services/storage').EncryptedStorage;
const mockUuid = jest.requireMock('src/utils/uuid');

const SENSITIVE_KEYS = ['content', 'notes', 'symptoms', 'body', 'dialogue', 'journalEntries', 'moodHistory', 'rawHealth'];

function networkError(): AxiosError {
  return new AxiosError('Network Error');
}

function serverState(overrides: Partial<LunaServerState> = {}): LunaServerState {
  return {
    id: 'state-1',
    xp: 2000,
    level: 10,
    coins: 300,
    relationship_level: 4,
    mood_trend: { trend: 'stable', samples: [], updated_at: null },
    preferences: { speechEnabled: true, speechRate: 1.1, muteSounds: false },
    achievements: [{ id: 'sleep_streak_7', unlocked_at: '2026-08-01T00:00:00Z' }],
    habit_patterns: { sleep_avg_hour: 23.1, top_log_types: ['sleep'] },
    created_at: '2026-08-01T00:00:00Z',
    updated_at: new Date(Date.now() + 86400000).toISOString(),
    ...overrides,
  };
}

async function seedLocalMetadata(overrides: Record<string, unknown> = {}): Promise<void> {
  await companionLocalService.upsertMetadata({
    user_id: USER,
    xp: 15,
    coins: 10,
    level: 1,
    relationship_level: 1,
    owned_outfits: [],
    memory: { achievements: ['local_badge'] },
    is_hidden: false,
    reduce_animations: false,
    mute_sounds: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...(overrides as any),
  });
}

async function queueSize(): Promise<number> {
  const raw = await EncryptedStorage.getItem(QUEUE_KEY);
  if (!raw) return 0;
  return (JSON.parse(raw) as unknown[]).length;
}

function expectNoSensitiveKeys(payload: unknown): void {
  const serialized = JSON.stringify(payload ?? {});
  for (const key of SENSITIVE_KEYS) {
    expect(serialized).not.toContain(key);
  }
}

beforeEach(async () => {
  jest.clearAllMocks();
  Object.keys(mockStorage.__store).forEach((k) => delete mockStorage.__store[k]);
  try {
    const db = (await import('../../db/connection')).getDb();
    const { companionMetadata } = await import('../../db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(companionMetadata).where(eq(companionMetadata.user_id, USER));
  } catch {}
  useCompanionStore.getState().reset();
  useAuthStore.setState({
    user: {
      id: USER,
      email: 'luna@test.com',
      phone_number: null,
      display_name: null,
      role: 'user',
      is_active: true,
      is_verified: true,
      provider: 'local',
      created_at: new Date().toISOString(),
      last_login_at: null,
      onboarding_completed: true,
    },
  });
  let n = 0;
  mockUuid.generateUUID.mockImplementation(() => {
    n += 1;
    return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  });
  mockApi.put.mockResolvedValue({ data: serverState() });
  mockApi.get.mockResolvedValue({ data: serverState() });
});

describe('lunaSyncIntegration — offline → reconnect → LWW merge', () => {
  it('queues while offline, replays in FIFO order, then merges newer server state', async () => {
    await seedLocalMetadata();
    const before = (await companionLocalService.getMetadata(USER))!;

    // Offline: both read + write fail with network errors.
    mockApi.put.mockRejectedValue(networkError());
    mockApi.get.mockRejectedValue(networkError());
    await syncLunaState(USER);
    expect(await queueSize()).toBe(1);

    // Reconnect: PUT + GET succeed; server row is newer.
    mockApi.put.mockResolvedValue({ data: serverState() });
    mockApi.get.mockResolvedValue({ data: serverState() });
    await syncLunaState(USER);

    expect(await queueSize()).toBe(0);

    // FIFO: the offline write is pushed first, then the live push.
    const putPayloads = mockApi.put.mock.calls.map((c: any[]) => c[1]);
    expect(putPayloads.length).toBeGreaterThanOrEqual(2);
    expect(putPayloads[0].xp).toBe(before.xp);
    for (const payload of putPayloads) expectNoSensitiveKeys(payload);

    // Server (newer) merged back into local metadata + store.
    const after = (await companionLocalService.getMetadata(USER))!;
    expect(after.xp).toBe(2000);
    expect(after.coins).toBe(300);
    expect((after.memory as Record<string, unknown>).speech).toMatchObject({ enabled: true });
    expect((after.memory as Record<string, unknown>).achievements).toEqual(['sleep_streak_7']);
    expect(useCompanionStore.getState().xp).toBe(2000);
  });

  it('ignores duplicate idempotency_keys during reconnect replay', async () => {
    await seedLocalMetadata();
    const now = new Date().toISOString();
    await mockStorage.setItem(
      QUEUE_KEY,
      JSON.stringify([
        { idempotency_key: 'dup', client_updated_at: now, queued_at: now, payload: { xp: 5 } },
        { idempotency_key: 'dup', client_updated_at: now, queued_at: now, payload: { xp: 5 } },
        { idempotency_key: 'other', client_updated_at: now, queued_at: now, payload: { xp: 7 } },
      ]),
    );
    mockApi.get.mockRejectedValue(networkError());
    await syncLunaState(USER);
    const replayPuts = mockApi.put.mock.calls.map((c: any[]) => c[1]);
    expect(replayPuts.filter((p: any) => p.xp === 5)).toHaveLength(1);
    expect(replayPuts.filter((p: any) => p.xp === 7)).toHaveLength(1);
    expect(await queueSize()).toBe(0);
  });

  it('only ever serializes aggregate keys across all PUT payloads', async () => {
    await seedLocalMetadata({
      memory: {
        achievements: ['a'],
        habitPatterns: { x: 1 },
        dialogueHistory: [{ text: 'secret chat' }],
        journalDrafts: [{ content: 'private' }],
      },
    });
    mockApi.put.mockRejectedValue(networkError());
    await syncLunaState(USER);
    for (const call of mockApi.put.mock.calls) expectNoSensitiveKeys(call[1]);
    for (const call of mockApi.get.mock.calls) expectNoSensitiveKeys(call[0]);
  });
});

describe('reconcileLunaState — LWW guard', () => {
  it('applies server state when the server row is newer', async () => {
    await seedLocalMetadata();
    mockApi.get.mockResolvedValue({ data: serverState() });
    await reconcileLunaState(USER);
    const meta = (await companionLocalService.getMetadata(USER))!;
    expect(meta.xp).toBe(2000);
  });

  it('keeps local state when the server row is older', async () => {
    await seedLocalMetadata();
    mockApi.get.mockResolvedValue({
      data: serverState({ xp: 5, updated_at: '2020-01-01T00:00:00Z' }),
    });
    await reconcileLunaState(USER);
    const meta = (await companionLocalService.getMetadata(USER))!;
    expect(meta.xp).toBe(15);
  });

  it('no-ops silently when offline', async () => {
    await seedLocalMetadata();
    mockApi.get.mockRejectedValue(networkError());
    await expect(reconcileLunaState(USER)).resolves.toBeUndefined();
    const meta = (await companionLocalService.getMetadata(USER))!;
    expect(meta.xp).toBe(15);
  });

  it('skips apply when server responds 304 (unchanged ETag)', async () => {
    await seedLocalMetadata();
    mockApi.get.mockResolvedValue({ status: 304, headers: {}, data: undefined });
    await reconcileLunaState(USER);
    const meta = (await companionLocalService.getMetadata(USER))!;
    expect(meta.xp).toBe(15);
  });
});

describe('applyServerState — local store + metadata', () => {
  it('persists scalars, settings and memory, then rehydrates the store', async () => {
    await seedLocalMetadata();
    await applyServerState(USER, serverState());
    const meta = (await companionLocalService.getMetadata(USER))!;
    expect(meta.xp).toBe(2000);
    expect(meta.level).toBe(10);
    expect(meta.coins).toBe(300);
    expect(meta.relationship_level).toBe(4);
    expect(meta.is_hidden).toBe(false);
    const memory = meta.memory as Record<string, unknown>;
    expect(memory.habitPatterns).toEqual({ sleep_avg_hour: 23.1, top_log_types: ['sleep'] });
    expect(memory.moodTrend).toBe('stable');
    expect(useCompanionStore.getState().xp).toBe(2000);
    expect(useCompanionStore.getState().speakEnabled).toBe(true);
  });
});

describe('React Query hooks', () => {
  let qc: QueryClient;
  let wrapper: (props: { children: React.ReactNode }) => React.JSX.Element;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
  });

  it('useLunaState reads the server aggregate (staleTime 5 min keeps it fresh)', async () => {
    mockApi.get.mockResolvedValue({ data: serverState() });
    const { result } = renderHook(() => useLunaState(), { wrapper });
    await waitFor(() => expect(result.current.data?.xp).toBe(2000));
    expect(result.current.isStale).toBe(false);
  });

  it('useLunaState query key is user-scoped via getLunaKeys', async () => {
    mockApi.get.mockResolvedValue({ data: serverState() });
    renderHook(() => useLunaState(), { wrapper });
    await act(async () => {});
    const state = qc.getQueryState(getLunaKeys(USER).state);
    expect(state).not.toBeUndefined();
    expect(getLunaKeys(USER).state[1]).toBe(USER);
  });

  it('usePushLunaState pushes and invalidates .all on success', async () => {
    const spyInvalidate = jest.spyOn(qc, 'invalidateQueries');
    mockApi.put.mockResolvedValue({ data: serverState() });
    const { result } = renderHook(() => usePushLunaState(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ xp: 5, coins: 2, client_updated_at: new Date().toISOString() });
    });
    expect(mockApi.put).toHaveBeenCalled();
    expect(spyInvalidate).toHaveBeenCalledWith({ queryKey: getLunaKeys(USER).all });
  });

  it('usePushLunaState queues (not throws) when offline', async () => {
    mockApi.put.mockRejectedValue(networkError());
    const { result } = renderHook(() => usePushLunaState(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ xp: 5 })).resolves.toBeUndefined();
    });
    expect(await queueSize()).toBe(1);
  });
});
