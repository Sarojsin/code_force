import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import { cycleService, CycleEntry } from 'src/services/api';
import { useOfflineStore } from 'src/stores/offlineStore';
import { useEndDateStore } from 'src/stores/endDateStore';
import { isNetworkError } from 'src/services/sync';
import { scheduleEndDateNotification } from 'src/services/endDateNotifications';
import { calculateCyclePhases, applyPhaseToDays } from 'src/utils';
import { generateId } from 'src/utils';
import { placeholderCycleEntries, placeholderCyclePredictions, placeholderCycleCalendar } from 'src/services/localDb/syncPlaceholders';
import { upsertCycleEntry } from 'src/services/localDb/writeThroughHelpers';

export const cycleKeys = {
  all: ['cycle'] as const,
  entries: ['cycle', 'entries'] as const,
  predictions: ['cycle', 'predictions'] as const,
  predictionHistory: ['cycle', 'predictions', 'history'] as const,
  calendar: ['cycle', 'calendar'] as const,
  analytics: ['cycle', 'analytics'] as const,
};

export function useCycleEntries(params?: { limit?: number; offset?: number; months_back?: number }) {
  return useQuery({
    queryKey: [...cycleKeys.entries, params],
    queryFn: () => cycleService.getEntries(params),
    initialData: () => placeholderCycleEntries(params?.limit) as any,
    staleTime: 0,
    retry: false,
  });
}

export function useCreateCycleEntry() {
  const qc = useQueryClient();
  const offlineStore = useOfflineStore();
  return useMutation({
    mutationFn: (data: Partial<CycleEntry>) => cycleService.createEntry(data),
    onSuccess: (result) => {
      upsertCycleEntry(result as unknown as Record<string, unknown>);
      qc.invalidateQueries({ queryKey: cycleKeys.entries });
      qc.invalidateQueries({ queryKey: cycleKeys.calendar });
      qc.invalidateQueries({ queryKey: cycleKeys.predictions });
      qc.invalidateQueries({ queryKey: cycleKeys.analytics });
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
        const errPayload = (error as any)?.response?.data;
        const details = errPayload?.error?.details;
        const code = errPayload?.error?.code;
        if (code === 'PERIOD_END_DATE_REQUIRED' || (details && details.length > 0)) {
          Toast.show({ type: 'error', text1: details || code || 'Failed to save' });
        } else {
          Toast.show({ type: 'error', text1: error instanceof Error ? error.message : 'Failed to save' });
        }
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
    onSuccess: (result) => {
      upsertCycleEntry(result as unknown as Record<string, unknown>);
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
    initialData: () => placeholderCyclePredictions() as any,
    staleTime: 0,
    retry: false,
  });
}

export function usePredictionHistory(limit = 12) {
  return useQuery({
    queryKey: [...cycleKeys.predictionHistory, limit],
    queryFn: () => cycleService.getPredictionHistory(limit),
  });
}

export function useCycleCalendar(monthsBack = 3, monthsForward = 3) {
  return useQuery({
    queryKey: [...cycleKeys.calendar, monthsBack, monthsForward],
    queryFn: () => cycleService.getCalendar(monthsBack, monthsForward),
    initialData: () => placeholderCycleCalendar() as any,
    staleTime: 0,
    retry: false,
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
      cycle_type?: string;
    }) => cycleService.logCorrection(
      data,
      generateId(),
      new Date().toISOString(),
    ),

    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: cycleKeys.calendar });
      const previous = qc.getQueryData([...cycleKeys.calendar, 3, 3]);

      qc.setQueryData([...cycleKeys.calendar, 3, 3], (old: any) => {
        if (!old?.days) return old;
        const days: Record<string, string> = { ...old.days };

        // Estimate period length from cached prediction, or fall back to 5
        const cachedAvgLen = (() => {
          if (old.predictions?.predicted_period_end && old.predictions?.predicted_next_period_start) {
            const s = new Date(old.predictions.predicted_next_period_start + 'T00:00:00');
            const e = new Date(old.predictions.predicted_period_end + 'T00:00:00');
            const est = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
            if (est >= 1 && est <= 14) return est;
          }
          return 5;
        })();

        const periodStart = new Date(variables.period_start_date + 'T00:00:00');
        const periodEnd = variables.period_end_date
          ? new Date(variables.period_end_date + 'T00:00:00')
          : new Date(periodStart.getTime() + cachedAvgLen * 86400000);
        const periodLength = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1;

        let cycleLength = 28;
        if (old.predictions?.predicted_next_period_start) {
          const predStart = new Date(old.predictions.predicted_next_period_start + 'T00:00:00');
          const diff = Math.round((predStart.getTime() - periodStart.getTime()) / 86400000);
          if (diff > 0 && diff < 60) {
            cycleLength = diff;
          }
        }

        // 1. Cancel old predicted period days near the correction date → c
        for (const [key, code] of Object.entries(days)) {
          if (code === 'p') {
            const dayDate = new Date(key + 'T00:00:00');
            const diffFromStart = Math.round((periodStart.getTime() - dayDate.getTime()) / 86400000);
            if (diffFromStart >= -14 && diffFromStart <= 10) {
              days[key] = 'c';
            }
          }
        }

        // 2. Add confirmed phases for the corrected cycle → P, F, O, L
        const confirmedPhases = calculateCyclePhases(periodStart, cycleLength, periodLength);
        applyPhaseToDays(days, confirmedPhases, 'P');

        // 3. Project next predicted cycle → p, f, o, l
        const nextPeriodStart = new Date(periodStart.getTime() + cycleLength * 86400000);
        const nextPhases = calculateCyclePhases(nextPeriodStart, cycleLength, cachedAvgLen);
        applyPhaseToDays(days, nextPhases, 'p');

        // 4. Update predictions and next_period_in_days for immediate UI refresh
        const today = new Date();
        const nextPeriodInDays = Math.max(0, Math.round((nextPeriodStart.getTime() - today.getTime()) / 86400000));
        const updatedPredictions = old.predictions ? {
          ...old.predictions,
          predicted_next_period_start: nextPeriodStart.toISOString().split('T')[0],
          predicted_period_end: new Date(nextPeriodStart.getTime() + cachedAvgLen * 86400000).toISOString().split('T')[0],
        } : old.predictions;

        return { ...old, days, predictions: updatedPredictions, next_period_in_days: nextPeriodInDays, needs_checkin: false, _optimistic: true };
      });

      return { previousCalendar: previous };
    },

    onSuccess: (result, variables) => {
      if (result && result.id) {
        upsertCycleEntry(result);
      }
      qc.invalidateQueries({ queryKey: cycleKeys.calendar });
      qc.invalidateQueries({ queryKey: cycleKeys.predictions });
      qc.invalidateQueries({ queryKey: cycleKeys.entries });
      qc.invalidateQueries({ queryKey: cycleKeys.analytics });
      qc.invalidateQueries({ queryKey: cycleKeys.predictionHistory });

      // If correction was sent without end_date, set pending end-date notification
      if (!variables.period_end_date && result?.id && result?.avg_period_length) {
        const endDateStore = useEndDateStore.getState();
        const predictionId = variables.corrected_prediction_id ?? null;
        endDateStore.setPending(result.id, variables.period_start_date, predictionId, result.avg_period_length);
        scheduleEndDateNotification(variables.period_start_date, result.avg_period_length).then((nid) => {
          if (nid) useEndDateStore.getState().setNotificationId(nid);
        });
      }

      Toast.show({ type: 'success', text1: 'Period corrected — predictions updated' });
    },

    onError: (error, variables, context) => {
      // 409 conflict — apply server's data to cache
      if ((error as any)?.response?.status === 409) {
        const serverData = (error as any)?.response?.data;
        if (serverData?.data?.days) {
          qc.setQueryData([...cycleKeys.calendar, 3, 3], serverData.data);
          Toast.show({ type: 'info', text1: 'Updated from another device' });
        } else {
          qc.invalidateQueries({ queryKey: cycleKeys.calendar });
          Toast.show({ type: 'info', text1: 'Updated from another device' });
        }
        return;
      }

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
        // Rollback on other errors
        if (context?.previousCalendar) {
          qc.setQueryData([...cycleKeys.calendar, 3, 3], context.previousCalendar);
        }
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
    onSuccess: (result) => {
      if (result && result.id) {
        upsertCycleEntry(result);
      }
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
