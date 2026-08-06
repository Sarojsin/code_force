import { AxiosError } from 'axios';

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
  buildLunaStatePayload,
  clearLunaSync,
  enqueueAndPush,
  getLunaKeys,
  LUNA_QUEUE_CAP,
  mergeServerMemory,
  replayLunaQueue,
} from 'src/services/companion/lunaSyncClient';
import type { LunaServerState } from 'src/services/companion/lunaSyncClient';
import { companionLocalService } from 'src/services/localDb/CompanionLocalService';
import { EncryptedStorage } from 'src/services/storage';

const USER = 'user-luna-1';
const QUEUE_KEY = `shecare.luna.offline.queue.${USER}`;

const mockApi = jest.requireMock('src/services/api/client').api;
const mockUuid = jest.requireMock('src/utils/uuid');
const mockSentry = jest.requireMock('@sentry/react-native');
const mockStorage = jest.requireMock('src/services/storage').EncryptedStorage;

function networkError(): AxiosError {
  return new AxiosError('Network Error');
}

function httpError(status: number): AxiosError {
  const response = {
    status,
    data: { error: { code: 'X', details: 'x' } },
    headers: {},
    config: {},
    statusText: status === 429 ? 'Too Many Requests' : 'Unprocessable Entity',
  } as any;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, response);
}

function sample(date: string, mood: 'happy' | 'sad' = 'happy', intensity = 4): any {
  return { date, mood, intensity, source: 'manual', created_at: `${date}T18:00:00Z` };
}

function serverState(overrides: Partial<LunaServerState> = {}): LunaServerState {
  return {
    id: 'state-1',
    xp: 1000,
    level: 5,
    coins: 120,
    relationship_level: 3,
    mood_trend: { trend: 'improving', samples: [sample('2026-08-01')], updated_at: '2026-08-06T00:00:00Z' },
    preferences: { speechEnabled: true, speechRate: 1.2, muteSounds: false },
    achievements: [{ id: 'sleep_streak_7', unlocked_at: '2026-08-01T00:00:00Z' }],
    habit_patterns: { sleep_avg_hour: 23.1, top_log_types: ['sleep', 'water'] },
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-06T00:00:00Z',
    ...overrides,
  };
}

let uuidCounter = 0;

async function seedQueue(entries: Array<{ idempotency_key: string; payload: any }>): Promise<void> {
  const now = new Date().toISOString();
  await mockStorage.setItem(
    QUEUE_KEY,
    JSON.stringify(entries.map((e) => ({
      idempotency_key: e.idempotency_key,
      client_updated_at: now,
      queued_at: now,
      payload: e.payload,
    }))),
  );
}

async function queueLength(): Promise<number> {
  const raw = await EncryptedStorage.getItem(QUEUE_KEY);
  if (!raw) return 0;
  return (JSON.parse(raw) as unknown[]).length;
}

describe('getLunaKeys (Rules §1.1)', () => {
  it('scopes every key by userId', () => {
    const a = getLunaKeys('u-a');
    const b = getLunaKeys('u-b');
    expect(a.state).toEqual(['luna', 'u-a', 'state']);
    expect(b.state).toEqual(['luna', 'u-b', 'state']);
    expect(a.all[1]).not.toBe(b.all[1]);
    expect(getLunaKeys(undefined).state[1]).toBe('anonymous');
  });
});

describe('buildLunaStatePayload — aggregate only', () => {
  beforeEach(async () => {
    try {
      const db = (await import('../../db/connection')).getDb();
      const { companionMetadata } = await import('../../db/schema');
      const { eq } = await import('drizzle-orm');
      await db.delete(companionMetadata).where(eq(companionMetadata.user_id, USER));
    } catch {}
    mockUuid.generateUUID.mockReturnValue('00000000-0000-4000-8000-000000000001');
  });

  it('emits aggregate scalars + client_updated_at', async () => {
    await companionLocalService.upsertMetadata({
      user_id: USER,
      xp: 1234,
      coins: 88,
      level: 5,
      relationship_level: 2,
      owned_outfits: [],
      memory: {},
      is_hidden: false,
      reduce_animations: false,
      mute_sounds: false,
      created_at: new Date().toISOString(),
      updated_at: '2026-08-06T10:00:00Z',
    } as any);
    const meta = (await companionLocalService.getMetadata(USER))!;
    const payload = buildLunaStatePayload(meta);
    expect(payload.xp).toBe(1234);
    expect(payload.coins).toBe(88);
    expect(payload.level).toBe(5);
    expect(payload.relationship_level).toBe(2);
    expect(payload.client_updated_at).toBe(meta.updated_at);
    expect(payload.preferences).toEqual({ muteSounds: false, reduceAnimations: false, isHidden: false });
  });

  it('maps speech prefs + settings into preferences', async () => {
    await companionLocalService.upsertMetadata({
      user_id: USER,
      xp: 0,
      coins: 0,
      level: 1,
      relationship_level: 1,
      owned_outfits: [],
      memory: {
        speech: { enabled: true, voiceId: 'en-US-x-tpd', rate: 1.3, pitch: 0.8 },
      },
      is_hidden: true,
      reduce_animations: true,
      mute_sounds: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);
    const meta = (await companionLocalService.getMetadata(USER))!;
    const payload = buildLunaStatePayload(meta);
    expect(payload.preferences).toEqual({
      speechEnabled: true,
      speechRate: 1.3,
      speechPitch: 0.8,
      voiceId: 'en-US-x-tpd',
      muteSounds: true,
      reduceAnimations: true,
      isHidden: true,
    });
  });

  it('maps achievement ids to AchievementItems', async () => {
    await companionLocalService.upsertMetadata({
      user_id: USER,
      xp: 0,
      coins: 0,
      level: 1,
      relationship_level: 1,
      owned_outfits: [],
      memory: { achievements: ['sleep_streak_7', 'period_aware'] },
      is_hidden: false,
      reduce_animations: false,
      mute_sounds: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);
    const meta = (await companionLocalService.getMetadata(USER))!;
    const payload = buildLunaStatePayload(meta);
    expect(payload.achievements).toHaveLength(2);
    expect(payload.achievements![0].id).toBe('sleep_streak_7');
    expect(payload.achievements![0].unlocked_at).toBeTruthy();
  });

  it('maps habitPatterns + typed moodSamples', async () => {
    await companionLocalService.upsertMetadata({
      user_id: USER,
      xp: 0,
      coins: 0,
      level: 1,
      relationship_level: 1,
      owned_outfits: [],
      memory: {
        habitPatterns: { sleep_avg_hour: 23.1, top_log_types: ['sleep'] },
        moodSamples: [sample('2026-08-05', 'happy', 5), sample('2026-08-06', 'sad', 2)],
      },
      is_hidden: false,
      reduce_animations: false,
      mute_sounds: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);
    const meta = (await companionLocalService.getMetadata(USER))!;
    const payload = buildLunaStatePayload(meta);
    expect(payload.habit_patterns).toEqual({ sleep_avg_hour: 23.1, top_log_types: ['sleep'] });
    expect(payload.mood_trend?.samples).toHaveLength(2);
    expect(payload.mood_trend?.samples![1].mood).toBe('sad');
  });

  it('drops malformed moodSamples but keeps valid ones', async () => {
    await companionLocalService.upsertMetadata({
      user_id: USER,
      xp: 0,
      coins: 0,
      level: 1,
      relationship_level: 1,
      owned_outfits: [],
      memory: {
        moodSamples: [
          sample('2026-08-05'),
          { date: 'bad', mood: 'happy', intensity: 5, source: 'manual', created_at: 'x' },
          { date: '2026-08-06', mood: 'happy', intensity: 9, source: 'manual', created_at: 'x' },
        ],
      },
      is_hidden: false,
      reduce_animations: false,
      mute_sounds: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);
    const meta = (await companionLocalService.getMetadata(USER))!;
    const payload = buildLunaStatePayload(meta);
    expect(payload.mood_trend?.samples).toHaveLength(1);
  });

  it('NEVER serializes journal/dialogue/health content', async () => {
    await companionLocalService.upsertMetadata({
      user_id: USER,
      xp: 10,
      coins: 10,
      level: 1,
      relationship_level: 1,
      owned_outfits: [],
      memory: {
        achievements: ['x'],
        habitPatterns: { a: 1 },
        dialogueHistory: [{ text: 'secret' }],
        journalEntries: [{ content: 'my diary' }],
        rawHealth: { bp: 120 },
      },
      is_hidden: false,
      reduce_animations: false,
      mute_sounds: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any);
    const meta = (await companionLocalService.getMetadata(USER))!;
    const payload = buildLunaStatePayload(meta);
    const serialized = JSON.stringify(payload);
    const sensitive = ['content', 'dialogue', 'journalEntries', 'rawHealth', 'body', 'notes', 'symptoms'];
    for (const key of sensitive) {
      expect(serialized).not.toContain(key);
    }
  });
});

describe('offline queue — cap, idempotency, FIFO replay', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    Object.keys(mockStorage.__store).forEach((k) => delete mockStorage.__store[k]);
    await clearLunaSync(USER);
    uuidCounter = 0;
    mockUuid.generateUUID.mockImplementation(() => {
      uuidCounter += 1;
      return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
    });
  });

  it('queues offline writes and replays in FIFO order on reconnect', async () => {
    mockApi.put.mockRejectedValueOnce(networkError()).mockRejectedValueOnce(networkError());

    const payloadA = { xp: 5, coins: 1, client_updated_at: '2026-08-06T09:00:00Z' };
    const payloadB = { xp: 10, coins: 3, client_updated_at: '2026-08-06T09:01:00Z' };
    await enqueueAndPush(USER, payloadA);
    await enqueueAndPush(USER, payloadB);

    expect(await queueLength()).toBe(2);

    mockApi.put.mockClear();
    mockApi.put.mockImplementation(async () => ({ data: serverState() }));
    const result = await replayLunaQueue(USER);

    expect(result).toEqual({ pushed: 2, dropped: 0, interrupted: false });
    expect(await queueLength()).toBe(0);
    const order = mockApi.put.mock.calls.map((c: any[]) => c[1]);
    expect(order).toEqual([payloadA, payloadB]);
  });

  it('dedupes identical idempotency_keys on replay', async () => {
    await seedQueue([
      { idempotency_key: 'key-1', payload: { xp: 5 } },
      { idempotency_key: 'key-1', payload: { xp: 5 } },
      { idempotency_key: 'key-2', payload: { xp: 7 } },
    ]);
    mockApi.put.mockResolvedValue({ data: serverState() });
    const result = await replayLunaQueue(USER);
    expect(result.pushed).toBe(2);
    expect(mockApi.put).toHaveBeenCalledTimes(2);
    expect(mockApi.put.mock.calls[0][2].headers['Idempotency-Key']).toBe('key-1');
  });

  it('enforces the 500 cap: oldest dropped + Sentry warning', async () => {
    mockApi.put.mockRejectedValue(networkError());
    for (let i = 0; i < LUNA_QUEUE_CAP + 5; i += 1) {
      await enqueueAndPush(USER, { xp: i, client_updated_at: `2026-08-06T${String(i % 60).padStart(2, '0')}:00:00Z` });
    }
    expect(await queueLength()).toBe(LUNA_QUEUE_CAP);
    expect(mockSentry.captureMessage).toHaveBeenCalledWith(
      'luna.queue.cap_exceeded',
      expect.objectContaining({ level: 'warning' }),
    );

    mockApi.put.mockResolvedValue({ data: serverState() });
    const result = await replayLunaQueue(USER);
    expect(result.pushed).toBe(LUNA_QUEUE_CAP);
    expect(result.dropped).toBe(0);
  });

  it('interrupts on network error, preserving FIFO tail for retry', async () => {
    await seedQueue([
      { idempotency_key: 'k1', payload: { xp: 1 } },
      { idempotency_key: 'k2', payload: { xp: 2 } },
      { idempotency_key: 'k3', payload: { xp: 3 } },
    ]);
    const pushedXps: number[] = [];
    let offline = true;
    mockApi.put.mockImplementation(async (_url: string, payload: any) => {
      if (offline && payload.xp === 2) throw networkError();
      pushedXps.push(payload.xp);
      return { data: serverState() };
    });

    const result = await replayLunaQueue(USER);
    expect(result).toEqual({ pushed: 1, dropped: 0, interrupted: true });
    expect(await queueLength()).toBe(2);

    offline = false;
    const second = await replayLunaQueue(USER);
    expect(second).toEqual({ pushed: 2, dropped: 0, interrupted: false });
    expect(await queueLength()).toBe(0);
    expect(pushedXps).toEqual([1, 2, 3]);
  });

  it('drops permanent 4xx failures and continues FIFO replay', async () => {
    await seedQueue([
      { idempotency_key: 'k1', payload: { xp: 1 } },
      { idempotency_key: 'k2', payload: { xp: 2 } },
      { idempotency_key: 'k3', payload: { xp: 3 } },
    ]);
    mockApi.put
      .mockResolvedValueOnce({ data: serverState() })
      .mockRejectedValueOnce(httpError(422))
      .mockResolvedValueOnce({ data: serverState() });

    const result = await replayLunaQueue(USER);
    expect(result).toEqual({ pushed: 2, dropped: 1, interrupted: false });
    expect(await queueLength()).toBe(0);
  });
});

describe('mergeServerMemory', () => {
  it('merges speech prefs, achievements, habit patterns, mood samples', () => {
    const merged = mergeServerMemory(
      { speech: { enabled: false, rate: 1, pitch: 1, voiceId: null }, petsLoved: 3 },
      serverState(),
    );
    expect(merged.speech).toEqual({ enabled: true, rate: 1.2, pitch: 1, voiceId: null });
    expect(merged.achievements).toEqual(['sleep_streak_7']);
    expect(merged.habitPatterns).toEqual({ sleep_avg_hour: 23.1, top_log_types: ['sleep', 'water'] });
    expect(merged.moodSamples).toHaveLength(1);
    expect(merged.moodTrend).toBe('improving');
    expect(merged.petsLoved).toBe(3);
  });

  it('keeps local speech values for fields the server did not send', () => {
    const merged = mergeServerMemory(
      { speech: { enabled: true, rate: 1.7, pitch: 0.9, voiceId: 'v1' } },
      serverState({ preferences: {} }),
    );
    expect(merged.speech).toEqual({ enabled: true, rate: 1.7, pitch: 0.9, voiceId: 'v1' });
  });

  it('leaves achievements/habit patterns untouched when server has none', () => {
    const merged = mergeServerMemory(
      { achievements: ['local_badge'], habitPatterns: { local: 1 } },
      serverState({ achievements: [], habit_patterns: {} }),
    );
    expect(merged.achievements).toEqual(['local_badge']);
    expect(merged.habitPatterns).toEqual({ local: 1 });
  });
});
