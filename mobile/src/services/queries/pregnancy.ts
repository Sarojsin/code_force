import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  pregnancyService,
  PregnancyProfile,
  PregnancyDailyLog,
} from 'src/services/api';

export const pregnancyKeys = {
  all: ['pregnancy'] as const,
  profile: ['pregnancy', 'profile'] as const,
  dailyLogs: ['pregnancy', 'dailyLogs'] as const,
  milestones: ['pregnancy', 'milestones'] as const,
  recommendations: ['pregnancy', 'recommendations'] as const,
};

export function usePregnancyProfile() {
  return useQuery({
    queryKey: pregnancyKeys.profile,
    queryFn: () => pregnancyService.getProfile(),
  });
}

export function useUpdatePregnancyProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PregnancyProfile>) => pregnancyService.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pregnancyKeys.profile });
    },
  });
}

export function usePregnancyDailyLogs() {
  return useQuery({
    queryKey: pregnancyKeys.dailyLogs,
    queryFn: () => pregnancyService.getDailyLogs(),
  });
}

export function useCreatePregnancyDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<PregnancyDailyLog>) => pregnancyService.createDailyLog(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pregnancyKeys.dailyLogs });
    },
  });
}

export function usePregnancyMilestones() {
  return useQuery({
    queryKey: pregnancyKeys.milestones,
    queryFn: () => pregnancyService.getMilestones(),
  });
}

export function usePregnancyRecommendations() {
  return useQuery({
    queryKey: pregnancyKeys.recommendations,
    queryFn: () => pregnancyService.getRecommendations(),
  });
}
