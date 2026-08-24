import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { onboardingService } from 'src/services/api';
import type { LifestyleUpdate } from 'src/types/onboarding';
import type { OnboardingResponse } from 'src/types/onboarding';

export const onboardingKeys = {
  all: ['onboarding'] as const,
  me: ['onboarding', 'me'] as const,
};

export function useOnboardingProfile() {
  return useQuery({
    queryKey: onboardingKeys.me,
    queryFn: () => onboardingService.get(),
    staleTime: 10 * 60_000,
    retry: 1,
  });
}

export function useUpdateLifestyle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: LifestyleUpdate) => onboardingService.updateLifestyle(data),
    onSuccess: (result) => {
      qc.setQueryData<OnboardingResponse>(onboardingKeys.me, result);
    },
  });
}