import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import {
  wellnessService,
  JournalEntry,
  MoodLog,
} from 'src/services/api';
import { useOfflineStore } from 'src/stores/offlineStore';
import { isNetworkError } from 'src/services/sync';
import { generateId } from 'src/utils';
import { upsertJournalEntry, upsertMoodLog } from 'src/services/localDb/writeThroughHelpers';

export const wellnessKeys = {
  all: ['wellness'] as const,
  journal: ['wellness', 'journal'] as const,
  moodLogs: ['wellness', 'moodLogs'] as const,
  breathing: ['wellness', 'breathing'] as const,
  insights: ['wellness', 'insights'] as const,
};

export function useJournalEntries(params?: { page?: number; per_page?: number }) {
  return useQuery({
    queryKey: [...wellnessKeys.journal, params],
    queryFn: () => wellnessService.getJournalEntries(params?.per_page, params?.page),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<JournalEntry>) => wellnessService.createJournalEntry(data as any),
    onSuccess: (result) => {
      upsertJournalEntry(result as unknown as Record<string, unknown>);
      qc.invalidateQueries({ queryKey: wellnessKeys.journal });
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
        qc.setQueryData(wellnessKeys.journal, (old: any) => {
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
  return useQuery({
    queryKey: [...wellnessKeys.moodLogs, params],
    queryFn: () => wellnessService.getMoodLogs(params?.per_page),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function useCreateMoodLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MoodLog>) => wellnessService.createMoodLog(data as any),
    onSuccess: (result) => {
      upsertMoodLog(result as unknown as Record<string, unknown>);
      qc.invalidateQueries({ queryKey: wellnessKeys.moodLogs });
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
        qc.setQueryData(wellnessKeys.moodLogs, (old: any) => {
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
  return useQuery({
    queryKey: wellnessKeys.breathing,
    queryFn: () => wellnessService.getBreathingExercises(),
  });
}

export function useCompleteBreathingSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (exerciseId: string) => wellnessService.completeBreathingSession(exerciseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wellnessKeys.breathing });
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
        qc.setQueryData(wellnessKeys.breathing, (old: any) => {
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
  return useQuery({
    queryKey: wellnessKeys.insights,
    queryFn: () => wellnessService.getInsights(),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}
