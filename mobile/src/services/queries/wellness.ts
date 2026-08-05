import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import {
  wellnessService,
  JournalEntry,
  MoodLog,
} from 'src/services/api';
import { useOfflineStore } from 'src/stores/offlineStore';
import { useAuthStore } from 'src/stores/authStore';
import { localDb } from 'src/services/localDb';
import { isNetworkError } from 'src/services/sync';
import { generateId } from 'src/utils';
import { upsertJournalEntry, upsertMoodLog } from 'src/services/localDb/writeThroughHelpers';

export function getWellnessKeys(userId?: string) {
  const id = userId ?? 'anonymous';
  return {
    all: ['wellness', id] as const,
    journal: ['wellness', id, 'journal'] as const,
    moodLogs: ['wellness', id, 'moodLogs'] as const,
    breathing: ['wellness', id, 'breathing'] as const,
    insights: ['wellness', id, 'insights'] as const,
  };
}

function mergeJournalEntries(server: JournalEntry[], local: JournalEntry[]): JournalEntry[] {
  const byId = new Map<string, JournalEntry>();
  for (const l of local) byId.set(l.id, l);
  for (const s of server) {
    const existing = byId.get(s.id);
    // Prefer local content (SQLite rows carry content + sentiment; API metadata omits content).
    byId.set(s.id, existing ? { ...s, content: existing.content ?? s.content, sentiment_label: existing.sentiment_label ?? s.sentiment_label } : s);
  }
  return [...byId.values()].sort(
    (a, b) => (b.entry_date || b.created_at).localeCompare(a.entry_date || a.created_at),
  );
}

function mergeMoodLogs(server: MoodLog[], local: MoodLog[]): MoodLog[] {
  const byId = new Map<string, MoodLog>();
  for (const l of local) byId.set(l.id, l);
  for (const s of server) byId.set(s.id, s);
  return [...byId.values()].sort(
    (a, b) => b.logged_at.localeCompare(a.logged_at),
  );
}

export function useJournalEntries(params?: { page?: number; per_page?: number }) {
  const userId = useAuthStore((s) => s.user?.id);
  const keys = getWellnessKeys(userId);
  return useQuery({
    queryKey: [...keys.journal, params],
    queryFn: async (): Promise<JournalEntry[]> => {
      let server: JournalEntry[] = [];
      try {
        server = await wellnessService.getJournalEntries(params?.per_page, params?.page);
      } catch {
        server = [];
      }
      const local = userId
        ? (await localDb.journal.getRecent(userId, params?.per_page ?? 50)) as unknown as JournalEntry[]
        : [];
      if (server.length > 0 && userId) {
        localDb.journal.upsertMany(server.map((e) => ({ ...e, user_id: userId })) as any);
      }
      return mergeJournalEntries(server, local);
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const keys = getWellnessKeys(userId);
  return useMutation({
    mutationFn: (data: Partial<JournalEntry>) => wellnessService.createJournalEntry(data as any),
    onSuccess: (result) => {
      upsertJournalEntry(result as unknown as Record<string, unknown>);
      qc.invalidateQueries({ queryKey: keys.journal });
    },
    onError: (error, data) => {
      if (isNetworkError(error)) {
        const tempId = generateId();
        useOfflineStore.getState().enqueue({
          type: 'journal/create',
          endpoint: '/api/v1/wellness/journal',
          data: data as unknown as Record<string, unknown>,
          tempId,
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        qc.setQueryData(keys.journal, (old: any) => {
          if (!old) return [{ ...data, id: tempId, _optimistic: true }];
          if (Array.isArray(old)) return [{ ...data, id: tempId, _optimistic: true }, ...old];
          return old;
        });
      } else {
        Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to save' });
      }
    },
  });
}

export function useMoodLogs(params?: { page?: number; per_page?: number }) {
  const userId = useAuthStore((s) => s.user?.id);
  const keys = getWellnessKeys(userId);
  return useQuery({
    queryKey: [...keys.moodLogs, params],
    queryFn: async (): Promise<MoodLog[]> => {
      let server: MoodLog[] = [];
      try {
        server = await wellnessService.getMoodLogs(params?.per_page);
      } catch {
        server = [];
      }
      const local = userId
        ? (await localDb.mood.getByDateRange(
            userId,
            new Date(Date.now() - 30 * 86400000).toISOString(),
            new Date().toISOString(),
          )) as unknown as MoodLog[]
        : [];
      if (server.length > 0 && userId) {
        localDb.mood.upsertMany(server.map((m) => ({ ...m, user_id: userId })) as any);
      }
      return mergeMoodLogs(server, local);
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useCreateMoodLog() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const keys = getWellnessKeys(userId);
  return useMutation({
    mutationFn: (data: Partial<MoodLog>) => wellnessService.createMoodLog(data as any),
    onSuccess: (result) => {
      upsertMoodLog(result as unknown as Record<string, unknown>);
      qc.invalidateQueries({ queryKey: keys.moodLogs });
    },
    onError: (error, data) => {
      if (isNetworkError(error)) {
        const tempId = generateId();
        useOfflineStore.getState().enqueue({
          type: 'mood/create',
          endpoint: '/api/v1/wellness/mood',
          data: data as unknown as Record<string, unknown>,
          tempId,
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        qc.setQueryData(keys.moodLogs, (old: any) => {
          if (!old) return [{ ...data, id: tempId, _optimistic: true }];
          if (Array.isArray(old)) return [{ ...data, id: tempId, _optimistic: true }, ...old];
          return old;
        });
      } else {
        Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to save mood' });
      }
    },
  });
}

export function useBreathingExercises() {
  const userId = useAuthStore((s) => s.user?.id);
  const keys = getWellnessKeys(userId);
  return useQuery({
    queryKey: keys.breathing,
    queryFn: () => wellnessService.getBreathingExercises(),
  });
}

export function useCompleteBreathingSession() {
  const qc = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const keys = getWellnessKeys(userId);
  return useMutation({
    mutationFn: (exerciseId: string) => wellnessService.completeBreathingSession(exerciseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.breathing });
    },
    onError: (error, exerciseId) => {
      if (isNetworkError(error)) {
        useOfflineStore.getState().enqueue({
          type: 'breathing/complete',
          endpoint: '/api/v1/wellness/breathing/complete',
          data: { exerciseId },
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        qc.setQueryData(keys.breathing, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((item: any) => item.id === exerciseId ? { ...item, completed: true, _optimistic: true } : item);
        });
      } else {
        Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to complete session' });
      }
    },
  });
}

export function useInsights() {
  const userId = useAuthStore((s) => s.user?.id);
  const keys = getWellnessKeys(userId);
  return useQuery({
    queryKey: keys.insights,
    queryFn: () => wellnessService.getInsights(),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}
