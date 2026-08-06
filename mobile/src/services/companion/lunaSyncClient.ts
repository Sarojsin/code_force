/**
 * lunaSyncClient — Luna2 Phase 4 cross-device sync of AGGREGATE companion state.
 *
 * Privacy boundary (luna2/luna2phase4_plan.md §0): ONLY aggregate state
 * (xp/level/coins/relationship_level, preferences, achievements, habit
 * patterns, mood trend) crosses the wire. Journal/dialogue/raw health data is
 * NEVER serialized here — `buildLunaStatePayload` only emits aggregate keys.
 *
 * Rules:
 * - Key scoping (Rules §1.1): every React Query key is user-scoped via
 *   `getLunaKeys(userId)`.
 * - staleTime 5 min for `useLunaState` (Rules §1.3); `.all` invalidated on
 *   mutation success (Rules §1.2).
 * - Offline queue: 500-entry hard cap, idempotency_key (UUID v4), FIFO replay,
 *   oldest dropped on overflow + Sentry warning (Rules §2.2, §2.3).
 * - LWW: each queued write carries `client_updated_at`; merge on server.
 * - ETag revalidation via `If-None-Match` (AGENTS.md §3.7).
 */

import { AxiosError } from 'axios';
import * as Sentry from '@sentry/react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api } from 'src/services/api/client';
import { EncryptedStorage } from 'src/services/storage';
import { companionLocalService } from 'src/services/localDb';
import type { CompanionMetadata, NewCompanionMetadata } from 'src/db/schema';
import { useCompanionStore } from 'src/stores/companionStore';
import { useAuthStore } from 'src/stores/authStore';
import { isNetworkError } from 'src/services/sync/isNetworkError';
import { addOfflineBreadcrumb } from 'src/services/queries/offlineMutationWrapper';
import { generateUUID } from 'src/utils/uuid';
import { logger } from 'src/utils';

export const LUNA_QUEUE_CAP = 500;
export const LUNA_STALE_TIME_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types (mirror backend schemas — see plans/30-mobile-api-contract.md §luna)
// ---------------------------------------------------------------------------

export type LunaMoodValue = 'happy' | 'sad' | 'anxious' | 'angry' | 'neutral';
export type LunaMoodSource = 'day_logged' | 'manual' | 'journal_analysis';
export type LunaMoodTrend = 'improving' | 'declining' | 'stable' | 'volatile';

export interface LunaMoodSample {
  date: string;
  mood: LunaMoodValue;
  intensity: number;
  source: LunaMoodSource;
  created_at: string;
}

export interface LunaServerState {
  id: string;
  xp: number;
  level: number;
  coins: number;
  relationship_level: number;
  mood_trend: {
    trend: LunaMoodTrend | null;
    samples: LunaMoodSample[];
    updated_at: string | null;
  };
  preferences: Record<string, unknown>;
  achievements: Array<{ id: string; unlocked_at: string }>;
  habit_patterns: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LunaStatePayload {
  xp?: number;
  level?: number;
  coins?: number;
  relationship_level?: number;
  mood_trend?: { samples?: LunaMoodSample[]; updated_at?: string };
  preferences?: Record<string, unknown>;
  achievements?: Array<{ id: string; unlocked_at: string }>;
  habit_patterns?: Record<string, unknown>;
  client_updated_at?: string;
}

export interface LunaQueuedWrite {
  idempotency_key: string;
  client_updated_at: string;
  queued_at: string;
  payload: LunaStatePayload;
}

export interface LunaReplayResult {
  pushed: number;
  dropped: number;
  interrupted: boolean;
}

// ---------------------------------------------------------------------------
// Key scoping (Rules §1.1) — every Luna query key is user-scoped.
// ---------------------------------------------------------------------------

export function getLunaKeys(userId?: string) {
  const id = userId ?? 'anonymous';
  return {
    all: ['luna', id] as const,
    state: ['luna', id, 'state'] as const,
  };
}

// ---------------------------------------------------------------------------
// Storage + in-memory ETag/state cache
// ---------------------------------------------------------------------------

const queueKey = (userId: string) => `shecare.luna.offline.queue.${userId}`;

/** Module-level ETag + last-known state per user, for cheap 304 revalidation. */
const stateCache = new Map<string, { etag: string | null; state: LunaServerState | null }>();

async function readQueue(userId: string): Promise<LunaQueuedWrite[]> {
  try {
    const raw = await EncryptedStorage.getItem(queueKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as LunaQueuedWrite[];
  } catch (err) {
    logger.warn('luna.queue.read_failed', err);
    return [];
  }
}

async function persistQueue(userId: string, queue: LunaQueuedWrite[]): Promise<void> {
  try {
    await EncryptedStorage.setItem(queueKey(userId), JSON.stringify(queue));
  } catch (err) {
    logger.error('luna.queue.persist_failed', err);
  }
}

async function enqueueLunaWrite(userId: string, write: LunaQueuedWrite): Promise<void> {
  const queue = await readQueue(userId);
  const deduped = queue.filter((w) => w.idempotency_key !== write.idempotency_key);
  deduped.push(write);
  let trimmed = deduped;
  if (trimmed.length > LUNA_QUEUE_CAP) {
    const dropped = trimmed.length - LUNA_QUEUE_CAP;
    const droppedEntries = trimmed.slice(0, dropped);
    trimmed = trimmed.slice(dropped);
    logger.warn('luna.queue.cap_exceeded', {
      event: 'luna.queue.cap',
      dropped,
      cap: LUNA_QUEUE_CAP,
      first_dropped_at: droppedEntries[0]?.queued_at,
    });
    Sentry.captureMessage('luna.queue.cap_exceeded', {
      level: 'warning',
      extra: { dropped, cap: LUNA_QUEUE_CAP },
    });
  }
  await persistQueue(userId, trimmed);
}

export async function clearLunaSync(userId: string): Promise<void> {
  stateCache.delete(userId);
  try {
    await EncryptedStorage.removeItem(queueKey(userId));
  } catch (err) {
    logger.warn('luna.clear.failed', err);
  }
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function headerEtag(etag: string | null | undefined): string | null {
  if (typeof etag !== 'string' || etag.length === 0) return null;
  return etag.replace(/^"|"$/g, '');
}

export async function fetchLunaState(
  userId: string,
): Promise<{ state: LunaServerState | null; etag: string | null; notModified: boolean }> {
  const cached = stateCache.get(userId);
  const headers: Record<string, string> = {};
  if (cached?.etag) headers['If-None-Match'] = `"${cached.etag}"`;
  const resp = await api.get('/luna/state', {
    headers,
    validateStatus: (status) => status === 200 || status === 304,
  });
  const etag = headerEtag(resp.headers?.etag);
  if (resp.status === 304) {
    return { state: cached?.state ?? null, etag: etag ?? cached?.etag ?? null, notModified: true };
  }
  const state = unwrap<LunaServerState>(resp.data);
  stateCache.set(userId, { etag, state });
  return { state, etag, notModified: false };
}

export async function pushLunaState(
  userId: string,
  payload: LunaStatePayload,
  idempotencyKey: string,
): Promise<LunaServerState> {
  const resp = await api.put('/luna/state', payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  const state = unwrap<LunaServerState>(resp.data);
  stateCache.set(userId, { etag: headerEtag(resp.headers?.etag), state });
  return state;
}

function isPermanentError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    const status = error.response?.status ?? 0;
    if (status === 0) return false; // network
    if (status === 408 || status === 429) return false; // retryable
    return status >= 400 && status < 500;
  }
  return false;
}

export async function replayLunaQueue(userId: string): Promise<LunaReplayResult> {
  const queue = await readQueue(userId);
  const seen = new Set<string>();
  const unique = queue.filter((w) => {
    if (seen.has(w.idempotency_key)) return false;
    seen.add(w.idempotency_key);
    return true;
  });

  let pushed = 0;
  let dropped = 0;

  for (let i = 0; i < unique.length; i++) {
    const write = unique[i];
    try {
      await pushLunaState(userId, write.payload, write.idempotency_key);
      pushed += 1;
    } catch (err) {
      if (isPermanentError(err)) {
        dropped += 1;
      } else {
        // Network / 5xx / 429: keep this write + the rest in FIFO order.
        await persistQueue(userId, unique.slice(i));
        return { pushed, dropped, interrupted: true };
      }
    }
  }

  await persistQueue(userId, []);
  return { pushed, dropped, interrupted: false };
}

/** Online push with offline fallback into the capped FIFO queue. */
export async function enqueueAndPush(
  userId: string,
  payload: LunaStatePayload,
): Promise<LunaServerState | void> {
  const write: LunaQueuedWrite = {
    idempotency_key: generateUUID(),
    client_updated_at: payload.client_updated_at ?? new Date().toISOString(),
    queued_at: new Date().toISOString(),
    payload,
  };
  try {
    return await pushLunaState(userId, write.payload, write.idempotency_key);
  } catch (err) {
    if (isNetworkError(err)) {
      await enqueueLunaWrite(userId, write);
      addOfflineBreadcrumb('luna.state', {
        keys: Object.keys(write.payload).filter((k) => k !== 'client_updated_at'),
      });
      return;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Local ↔ server mapping
// ---------------------------------------------------------------------------

const VALID_MOODS = new Set<string>(['happy', 'sad', 'anxious', 'angry', 'neutral']);
const VALID_SOURCES = new Set<string>(['day_logged', 'manual', 'journal_analysis']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isMoodSample(v: unknown): v is LunaMoodSample {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.date === 'string' &&
    ISO_DATE_RE.test(s.date) &&
    !Number.isNaN(Date.parse(s.date)) &&
    typeof s.mood === 'string' &&
    VALID_MOODS.has(s.mood) &&
    typeof s.intensity === 'number' &&
    s.intensity >= 1 &&
    s.intensity <= 5 &&
    typeof s.source === 'string' &&
    VALID_SOURCES.has(s.source) &&
    typeof s.created_at === 'string' &&
    !Number.isNaN(Date.parse(s.created_at))
  );
}

/**
 * Build the aggregate-only PUT payload from local `companion_metadata`.
 * Deliberately emits NO journal/dialogue/health content.
 */
export function buildLunaStatePayload(meta: CompanionMetadata): LunaStatePayload {
  const memory = (meta.memory ?? {}) as Record<string, unknown>;
  const speech = memory.speech as Record<string, unknown> | undefined;

  const preferences: Record<string, unknown> = {};
  if (speech && typeof speech === 'object') {
    if (typeof speech.enabled === 'boolean') preferences.speechEnabled = speech.enabled;
    if (typeof speech.rate === 'number') preferences.speechRate = speech.rate;
    if (typeof speech.pitch === 'number') preferences.speechPitch = speech.pitch;
    if (typeof speech.voiceId === 'string') preferences.voiceId = speech.voiceId;
  }
  if (typeof meta.mute_sounds === 'boolean') preferences.muteSounds = meta.mute_sounds;
  if (typeof meta.reduce_animations === 'boolean') preferences.reduceAnimations = meta.reduce_animations;
  if (typeof meta.is_hidden === 'boolean') preferences.isHidden = meta.is_hidden;

  const client_updated_at = meta.updated_at ?? new Date().toISOString();

  const payload: LunaStatePayload = {
    xp: meta.xp,
    level: meta.level,
    coins: meta.coins,
    relationship_level: meta.relationship_level,
    client_updated_at,
  };
  if (Object.keys(preferences).length > 0) payload.preferences = preferences;

  if (Array.isArray(memory.achievements)) {
    const ids = memory.achievements.filter((a): a is string => typeof a === 'string');
    if (ids.length > 0) {
      payload.achievements = ids.map((id) => ({ id, unlocked_at: client_updated_at }));
    }
  }

  if (memory.habitPatterns && typeof memory.habitPatterns === 'object') {
    payload.habit_patterns = memory.habitPatterns as Record<string, unknown>;
  }

  if (Array.isArray(memory.moodSamples)) {
    const samples = memory.moodSamples.filter(isMoodSample);
    if (samples.length > 0) {
      payload.mood_trend = { samples, updated_at: client_updated_at };
    }
  }

  return payload;
}

/** Merge server aggregate back into local memory (server wins per section). */
export function mergeServerMemory(
  current: Record<string, unknown>,
  server: LunaServerState,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...current };
  const prefs = server.preferences ?? {};
  const currentSpeech = (current.speech ?? {}) as Record<string, unknown>;
  next.speech = {
    enabled: typeof prefs.speechEnabled === 'boolean' ? prefs.speechEnabled : currentSpeech.enabled ?? false,
    rate: typeof prefs.speechRate === 'number' ? prefs.speechRate : currentSpeech.rate ?? 1,
    pitch: typeof prefs.speechPitch === 'number' ? prefs.speechPitch : currentSpeech.pitch ?? 1,
    voiceId: typeof prefs.voiceId === 'string' ? prefs.voiceId : currentSpeech.voiceId ?? null,
  };
  if (Array.isArray(server.achievements) && server.achievements.length > 0) {
    next.achievements = server.achievements.map((a) => a.id);
  }
  if (server.habit_patterns && Object.keys(server.habit_patterns).length > 0) {
    next.habitPatterns = server.habit_patterns;
  }
  if (Array.isArray(server.mood_trend?.samples) && server.mood_trend.samples.length > 0) {
    next.moodSamples = server.mood_trend.samples;
  }
  if (server.mood_trend?.trend) {
    next.moodTrend = server.mood_trend.trend;
  }
  return next;
}

/**
 * Apply a server state into `companion_metadata` when the server row is newer,
 * then re-hydrate the in-memory store for realtime feel.
 */
export async function applyServerState(userId: string, server: LunaServerState): Promise<void> {
  const local = await companionLocalService.getMetadata(userId);
  const currentMemory = (local?.memory ?? {}) as Record<string, unknown>;
  const mergedMemory = mergeServerMemory(currentMemory, server);

  const prefs = server.preferences ?? {};
  const settings: Partial<NewCompanionMetadata> = {};
  if (typeof prefs.muteSounds === 'boolean') settings.mute_sounds = prefs.muteSounds;
  if (typeof prefs.reduceAnimations === 'boolean') settings.reduce_animations = prefs.reduceAnimations;
  if (typeof prefs.isHidden === 'boolean') settings.is_hidden = prefs.isHidden;

  await companionLocalService.upsertMetadata({
    user_id: userId,
    xp: server.xp,
    level: server.level,
    coins: server.coins,
    relationship_level: server.relationship_level,
    memory: mergedMemory,
    updated_at: new Date().toISOString(),
    ...settings,
  } as NewCompanionMetadata);

  await useCompanionStore.getState().hydrate(userId);
}

// ---------------------------------------------------------------------------
// Orchestration: sync loop + launch reconciliation
// ---------------------------------------------------------------------------

export async function reconcileLunaState(userId: string): Promise<void> {
  let fetched;
  try {
    fetched = await fetchLunaState(userId);
  } catch (err) {
    if (isNetworkError(err)) return; // offline — keep local
    throw err;
  }
  if (fetched.notModified || !fetched.state) return;

  const local = await companionLocalService.getMetadata(userId);
  const serverTs = new Date(fetched.state.updated_at).getTime();
  const localTs = local ? new Date(local.updated_at ?? 0).getTime() : 0;
  if (serverTs > localTs) {
    await applyServerState(userId, fetched.state);
  }
}

/**
 * Full Phase 4 sync: replay the offline queue, push the local aggregate, then
 * reconcile the server row back into local storage.
 */
export async function syncLunaState(userId?: string): Promise<void> {
  const id = userId ?? useAuthStore.getState().user?.id;
  if (!id) return;

  await replayLunaQueue(id);

  const meta = await companionLocalService.getMetadata(id);
  if (meta) {
    const payload = buildLunaStatePayload(meta);
    const hasContent = Object.keys(payload).some((k) => k !== 'client_updated_at');
    if (hasContent) {
      await enqueueAndPush(id, payload);
    }
  }

  await reconcileLunaState(id);
}

// ---------------------------------------------------------------------------
// React Query hooks
// ---------------------------------------------------------------------------

/** Read path for server aggregate state. staleTime 5 min (Rules §1.3). */
export function useLunaState() {
  const userId = useAuthStore((s) => s.user?.id);
  const keys = getLunaKeys(userId);
  return useQuery({
    queryKey: keys.state,
    queryFn: async (): Promise<LunaServerState | null> => {
      if (!userId) return null;
      const { state } = await fetchLunaState(userId);
      return state;
    },
    staleTime: LUNA_STALE_TIME_MS,
    enabled: !!userId,
    retry: false,
  });
}

/** Mutation path — queues offline, invalidates `.all` on success (Rules §1.2). */
export function usePushLunaState() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const keys = getLunaKeys(userId);
  return useMutation({
    mutationFn: async (payload: LunaStatePayload): Promise<void> => {
      if (!userId) throw new Error('Luna sync requires a signed-in user');
      await enqueueAndPush(userId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.all });
    },
  });
}

/** Launch/login reconciliation (luna2phase4_plan.md §3.2). */
export function useLunaStateSync() {
  const userId = useAuthStore((s) => s.user?.id);
  useEffect(() => {
    if (!userId) return;
    syncLunaState(userId).catch((err) => logger.warn('luna.sync.failed', err));
  }, [userId]);
}
