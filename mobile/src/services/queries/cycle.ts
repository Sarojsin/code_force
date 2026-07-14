import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import { cycleService, CycleEntry } from 'src/services/api';
import { useOfflineStore } from 'src/stores/offlineStore';
import { isNetworkError } from 'src/services/sync';
import { generateId } from 'src/utils';

export const cycleKeys = {
  all: ['cycle'] as const,
  entries: ['cycle', 'entries'] as const,
  predictions: ['cycle', 'predictions'] as const,
  calendar: ['cycle', 'calendar'] as const,
  analytics: ['cycle', 'analytics'] as const,
};

export function useCycleEntries(params?: { limit?: number; offset?: number; months_back?: number }) {
  return useQuery({
    queryKey: [...cycleKeys.entries, params],
    queryFn: () => cycleService.getEntries(params),
  });
}

export function useCreateCycleEntry() {
  const qc = useQueryClient();
  const offlineStore = useOfflineStore();
  return useMutation({
    mutationFn: (data: Partial<CycleEntry>) => cycleService.createEntry(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cycleKeys.entries });
    },
    onError: (error, data) => {
      if (isNetworkError(error)) {
        const tempId = generateId();
        offlineStore.enqueue({
          type: 'cycle/create',
          endpoint: '/api/v1/cycle/entries',
          data,
          tempId,
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        qc.setQueryData(cycleKeys.entries, (old: any) => {
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

export function useUpdateCycleEntry() {
  const qc = useQueryClient();
  const offlineStore = useOfflineStore();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CycleEntry> }) =>
      cycleService.updateEntry(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cycleKeys.entries });
    },
    onError: (error, variables) => {
      if (isNetworkError(error)) {
        offlineStore.enqueue({
          type: 'cycle/update',
          endpoint: `/api/v1/cycle/entries/${variables.id}`,
          data: { id: variables.id, ...variables.data },
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        qc.setQueryData(cycleKeys.entries, (old: any) => {
          if (!Array.isArray(old)) return old;
          return old.map((item: any) => item.id === variables.id ? { ...item, ...variables.data, _optimistic: true } : item);
        });
      } else {
        Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to update' });
      }
    },
  });
}

export function useCyclePredictions() {
  return useQuery({
    queryKey: cycleKeys.predictions,
    queryFn: () => cycleService.getPredictions(),
  });
}

export function useCycleCalendar(monthsBack = 3, monthsForward = 3) {
  return useQuery({
    queryKey: [...cycleKeys.calendar, monthsBack, monthsForward],
    queryFn: () => cycleService.getCalendar(monthsBack, monthsForward),
  });
}

export function useCycleAnalytics() {
  return useQuery({
    queryKey: cycleKeys.analytics,
    queryFn: () => cycleService.getAnalytics(),
  });
}

export function useLogCorrection() {
  const qc = useQueryClient();
  const offlineStore = useOfflineStore();
  return useMutation({
    mutationFn: (data: {
      period_start_date: string;
      period_end_date?: string;
      symptoms?: string[];
      corrected_prediction_id?: string | null;
    }) => cycleService.logCorrection(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cycleKeys.calendar });
      qc.invalidateQueries({ queryKey: cycleKeys.predictions });
      qc.invalidateQueries({ queryKey: cycleKeys.entries });
    },
    onError: (error, variables) => {
      if (isNetworkError(error)) {
        offlineStore.enqueue({
          type: 'cycle/correction',
          endpoint: '/api/v1/cycle/corrections',
          data: variables,
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        qc.setQueryData(cycleKeys.calendar, (old: any) => {
          if (!old) return old;
          return { ...old, _correction: variables, _optimistic: true };
        });
      } else {
        Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to save correction' });
      }
    },
  });
}

export function useLogSnooze() {
  const qc = useQueryClient();
  const offlineStore = useOfflineStore();
  return useMutation({
    mutationFn: ({ predictedCycleId, dayOffset }: { predictedCycleId: string; dayOffset: number }) =>
      cycleService.logSnooze(predictedCycleId, dayOffset),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cycleKeys.calendar });
    },
    onError: (error, variables) => {
      if (isNetworkError(error)) {
        offlineStore.enqueue({
          type: 'cycle/snooze',
          endpoint: '/api/v1/cycle/snooze',
          data: variables,
          idempotencyKey: generateId(),
          clientUpdatedAt: new Date().toISOString(),
          priority: 'normal',
        });
        Toast.show({ type: 'info', text1: 'Saved offline — will sync when online' });
        qc.setQueryData(cycleKeys.calendar, (old: any) => {
          if (!old) return old;
          return { ...old, _snooze: variables, _optimistic: true };
        });
      } else {
        Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to snooze' });
      }
    },
  });
}
