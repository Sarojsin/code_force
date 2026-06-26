import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  wellnessService,
  JournalEntry,
  MoodLog,
} from 'src/services/api';

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
    queryFn: () => wellnessService.getJournalEntries(params),
  });
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<JournalEntry>) => wellnessService.createJournalEntry(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wellnessKeys.journal });
    },
  });
}

export function useMoodLogs(params?: { page?: number; per_page?: number }) {
  return useQuery({
    queryKey: [...wellnessKeys.moodLogs, params],
    queryFn: () => wellnessService.getMoodLogs(params),
  });
}

export function useCreateMoodLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MoodLog>) => wellnessService.createMoodLog(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: wellnessKeys.moodLogs });
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
  });
}

export function useInsights() {
  return useQuery({
    queryKey: wellnessKeys.insights,
    queryFn: () => wellnessService.getInsights(),
  });
}
