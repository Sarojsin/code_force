import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';

import { useCurrentCycleState } from 'src/hooks/useCurrentCycleState';
import { useMoodLogs, useInsights } from 'src/services/queries/wellness';
import { useCycleAnalytics, useCyclePredictions } from 'src/services/queries/cycle';
import { useAuthStore } from 'src/stores/authStore';
import { localDb } from 'src/services/localDb';
import { useHealthTips } from 'src/services/queries/useHealthTips';
import { computeReadiness, computeReadinessBreakdown } from 'src/utils/readinessScore';
import { filterTipsByPhase } from 'src/utils/filterRecommendations';
import { getMoodInsight } from 'src/utils/moodInsight';
import type { CycleDay } from 'src/db/schema';
import type { MoodLog } from 'src/services/api';
import type { WellnessInsights } from 'src/services/api/wellness';
import type { CycleAnalytics, PredictionListResponse } from 'src/services/api/cycle';
import type { CurrentCycleState } from 'src/hooks/useCurrentCycleState';
import type { HealthTipResponse } from 'src/services/api/wellness';

export interface UseWellnessDashboardReturn {
  cycle: CurrentCycleState;
  moodLogs: MoodLog[];
  insights: WellnessInsights | undefined;
  analytics: CycleAnalytics | undefined;
  predictions: PredictionListResponse | undefined;
  dayData: CycleDay | null;
  healthTips: HealthTipResponse[];
  readinessScore: number | null;
  readinessBreakdown: { sleep: number; mood: number; water: number; activity: number } | null;
  phaseRecommendations: HealthTipResponse[];
  moodInsight: string | null;
  isLoading: boolean;
  error: Error | null;
}

export function useWellnessDashboard(): UseWellnessDashboardReturn {
  const cycle = useCurrentCycleState();
  const moodLogsResult = useMoodLogs({ per_page: 30 });
  const insightsResult = useInsights();
  const analyticsResult = useCycleAnalytics();
  const predictionsResult = useCyclePredictions();
  const healthTipsResult = useHealthTips(undefined, 10);
  const userId = useAuthStore((s) => s.user?.id);

  const [dayData, setDayData] = useState<CycleDay | null>(null);
  const [dayDataLoading, setDayDataLoading] = useState(true);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!userId) {
      setDayData(null);
      setDayDataLoading(false);
      return;
    }
    setDayDataLoading(true);
    localDb.cycleDay.getByDate(userId, todayStr).then((data: CycleDay | null) => {
      setDayData(data);
      setDayDataLoading(false);
    }).catch(() => {
      setDayData(null);
      setDayDataLoading(false);
    });
  }, [userId, todayStr]);

  const moodLogs = moodLogsResult.data ?? [];

  const readinessScore = useMemo(
    () => computeReadiness(cycle.phaseKey, dayData, moodLogs),
    [cycle.phaseKey, dayData, moodLogs],
  );

  const readinessBreakdown = useMemo(
    () => computeReadinessBreakdown(cycle.phaseKey, dayData, moodLogs),
    [cycle.phaseKey, dayData, moodLogs],
  );

  const phaseRecommendations = useMemo(
    () => filterTipsByPhase(
      healthTipsResult.data?.data ?? [],
      cycle.phaseKey,
      analyticsResult.data?.common_symptoms,
    ),
    [healthTipsResult.data, cycle.phaseKey, analyticsResult.data?.common_symptoms],
  );

  const moodInsight = useMemo(
    () => getMoodInsight(
      moodLogs,
      cycle.phaseLabel,
      cycle.phaseDesc,
      cycle.hasCycleData,
      cycle.cycleDay,
    ),
    [moodLogs, cycle.phaseKey, cycle.phaseLabel, cycle.phaseDesc, cycle.hasCycleData, cycle.cycleDay],
  );

  const isLoading = cycle.isLoading || moodLogsResult.isLoading || insightsResult.isLoading || dayDataLoading;

  return {
    cycle,
    moodLogs,
    insights: insightsResult.data,
    analytics: analyticsResult.data,
    predictions: predictionsResult.data,
    dayData,
    healthTips: healthTipsResult.data?.data ?? [],
    readinessScore,
    readinessBreakdown,
    phaseRecommendations,
    moodInsight,
    isLoading,
    error: cycle.error || moodLogsResult.error || insightsResult.error,
  };
}
