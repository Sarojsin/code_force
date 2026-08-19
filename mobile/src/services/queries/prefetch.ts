/**
 * Startup pre-warm for the first Home paint (Phase B.2).
 *
 * Fire-and-forget React Query `prefetchQuery` calls issued once auth is known,
 * so the first `HomeDashboardScreen` / `useVideoRecommendations` mounts find
 * warm cache entries (networkMode: 'offlineFirst') instead of loading
 * skeletons. staleTime here must MATCH the staleTime in the consuming
 * query hooks — otherwise the prefetched data is treated as stale instantly
 * and refetched on mount, defeating the purpose.
 */

import { queryClient } from 'src/app/providers';
import { cycleService, nurseContentService } from 'src/services/api';
import { getCycleKeys } from './cycle';
import { nurseContentKeys } from './nurse_content';
import { toLocalDateStr } from 'src/utils';

export async function prefetchAppData(userId: string | null): Promise<void> {
  const keys = getCycleKeys(userId);

  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: [...keys.calendar, 3, 3],
      queryFn: () => cycleService.getCalendar(3, 3, toLocalDateStr(new Date())),
      staleTime: 10 * 60_000,
    }),
    queryClient.prefetchQuery({
      queryKey: keys.predictions,
      queryFn: () => cycleService.getPredictions(),
      staleTime: 10 * 60_000,
    }),
    queryClient.prefetchQuery({
      queryKey: [...nurseContentKeys.list, { limit: 100 }],
      queryFn: () => nurseContentService.getContents({ limit: 100 }),
      staleTime: 5 * 60_000,
    }),
  ]);
}