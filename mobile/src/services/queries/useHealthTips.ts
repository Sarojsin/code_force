import { useQuery } from '@tanstack/react-query';
import { wellnessService } from 'src/services/api/wellness';
import type { HealthTipListResponse } from 'src/services/api/wellness';

export function useHealthTips(metric_type?: string, limit: number = 3) {
  return useQuery<HealthTipListResponse>({
    queryKey: ['wellness', 'healthTips', metric_type, limit],
    queryFn: () => wellnessService.getHealthTips(metric_type, limit),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
