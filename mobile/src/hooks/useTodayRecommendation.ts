import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';

import { useAuthStore } from 'src/stores/authStore';
import { localDb } from 'src/services/localDb';
import { eventBus } from 'src/services/eventBus';
import { useCurrentCycleState } from 'src/hooks/useCurrentCycleState';
import {
  getRecommendations,
  getRecommendationInputFromDay,
} from 'src/utils/expertRecommendations';
import { getSafetyForDay } from 'src/utils/symptomSafety';
import type { CycleDay } from 'src/db/schema';
import type { PhaseRange } from 'src/utils/cyclePhases';
import type { RecommendationCard } from 'src/utils/recommendations';
import type { SafetyTier } from 'src/utils/symptomSafety';

export interface TodayRecommendation {
  /** First card from the engine (null on seek_care / no card). */
  card: RecommendationCard | null;
  tier: SafetyTier;
  phaseKey: PhaseRange['key'];
  painLevel: number;
  /** Whether today's CycleDay exists in localDb. */
  hasData: boolean;
  isLoading: boolean;
}

/**
 * Single shared source of truth for "today's" recommendation.
 *
 * Composes the three pure functions (`getRecommendationInputFromDay`,
 * `getRecommendations`, `getSafetyForDay`) with the same input so `card` and
 * `tier` never disagree. Consumed by the Home banner, Wellness "For today",
 * Luna proactive, and Luna reactive — never duplicated.
 *
 * Staleness fix: `useTodayDayData` fetches once per userId, so after a day save
 * it would return stale/null data. We re-fetch from localDb when the `day_logged`
 * event fires (cycle.ts emits it AFTER `upsertCycleDay` already updated localDb).
 */
export function useTodayRecommendation(): TodayRecommendation {
  const userId = useAuthStore((s) => s.user?.id);
  const { phaseKey } = useCurrentCycleState();
  const [dayData, setDayData] = useState<CycleDay | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setDayData(null);
      setIsLoading(false);
      return;
    }
    const load = () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      localDb.cycleDay
        .getByDate(userId, today)
        .then((data: CycleDay | null) => {
          setDayData(data);
          setIsLoading(false);
        })
        .catch(() => {
          setDayData(null);
          setIsLoading(false);
        });
    };
    load();
    return eventBus.on('day_logged', () => load());
  }, [userId]);

  return useMemo(() => {
    const input = getRecommendationInputFromDay(dayData, phaseKey);
    const cards = getRecommendations(input);
    const card = cards.length > 0 ? cards[0] : null;
    const tier = getSafetyForDay({
      painLevel: input.painLevel,
      phaseKey: input.phaseKey,
      selectedSymptomNames: input.selectedSymptoms,
      severities: input.severities,
    }).tier;
    return {
      card,
      tier,
      phaseKey,
      painLevel: input.painLevel,
      hasData: dayData !== null,
      isLoading,
    };
  }, [dayData, phaseKey, isLoading]);
}
