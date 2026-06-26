import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { cycleService, CycleEntry } from 'src/services/api';

export const cycleKeys = {
  all: ['cycle'] as const,
  entries: ['cycle', 'entries'] as const,
  predictions: ['cycle', 'predictions'] as const,
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

export function useCycleAnalytics() {
  return useQuery({
    queryKey: cycleKeys.analytics,
    queryFn: () => cycleService.getAnalytics(),
  });
}
