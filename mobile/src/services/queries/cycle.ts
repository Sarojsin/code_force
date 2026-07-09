import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cycleService, CalendarResponse, CycleEntry } from 'src/services/api';

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
  return useMutation({
    mutationFn: (data: Partial<CycleEntry>) => cycleService.createEntry(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cycleKeys.entries });
    },
  });
}

export function useUpdateCycleEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CycleEntry> }) =>
      cycleService.updateEntry(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cycleKeys.entries });
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
  });
}

export function useLogSnooze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ predictedCycleId, dayOffset }: { predictedCycleId: string; dayOffset: number }) =>
      cycleService.logSnooze(predictedCycleId, dayOffset),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cycleKeys.calendar });
    },
  });
}
