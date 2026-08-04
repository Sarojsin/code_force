import { useMemo } from 'react';

import { computeCycleDay, computePhaseRanges, getCurrentCycleAnchor, getPhaseMeta } from 'src/utils';
import { useCycleCalendar } from 'src/services/queries';
import type { PhaseRange } from 'src/utils/cyclePhases';

export interface CurrentCycleState {
  /** null when the user has never logged a cycle / has no current anchor. */
  cycleDay: number | null;
  hasCycleData: boolean;
  phaseKey: PhaseRange['key'];
  phaseLabel: string;
  phaseEmoji: string;
  phaseBg: string;
  phaseFg: string;
  phaseAccent: string;
  phaseDesc: string;
  /** null when no prediction data exists. */
  nextPeriodDays: number | null;
  /** null when no prediction data exists. */
  predictedCycleLength: number | null;
  calData: ReturnType<typeof useCycleCalendar>['data'];
  isLoading: boolean;
  error: ReturnType<typeof useCycleCalendar>['error'];
  refetch: ReturnType<typeof useCycleCalendar>['refetch'];
}

/**
 * Single canonical source of cycle day and phase for the current date.
 * Both Home and Calendar screens should use this hook instead of
 * computing cycle day or phase independently.
 *
 * Returns `null` (NOT a hardcoded default) for cycleDay / nextPeriodDays /
 * predictedCycleLength when there is no current period anchor — so callers
 * show an empty state instead of a fabricated 28-day cycle.
 */
export function useCurrentCycleState(
  monthsBack = 3,
  monthsForward = 3,
): CurrentCycleState {
  const { data: calData, isLoading, error, refetch } = useCycleCalendar(monthsBack, monthsForward);
  const today = useMemo(() => new Date(), []);

  return useMemo(() => {
    const days = calData?.days ?? {};
    // Real cycle data exists only when there is a current period anchor
    // (confirmed OR predicted) at or before today.
    const hasCycleData = getCurrentCycleAnchor(days, today) !== null;
    const computedDay = computeCycleDay(days, today);
    const cycleDay = hasCycleData ? computedDay : null;
    const phaseRanges = computePhaseRanges(days, today);

    const activeRange: PhaseRange | undefined = phaseRanges.find(
      (r) =>
        r.startDay !== null &&
        r.endDay !== null &&
        cycleDay !== null &&
        cycleDay >= r.startDay! &&
        cycleDay <= r.endDay!,
    );

    const phaseKey: PhaseRange['key'] = activeRange?.key ?? 'menstrual';
    const meta = getPhaseMeta(phaseKey);
    const nextPeriodDays = calData?.next_period_in_days ?? null;
    const predictedCycleLength = calData?.predictions?.predicted_cycle_length ?? null;

    return {
      cycleDay,
      hasCycleData,
      phaseKey,
      phaseLabel: meta.label,
      phaseEmoji: meta.emoji,
      phaseBg: meta.bg,
      phaseFg: meta.fg,
      phaseAccent: meta.accent,
      phaseDesc: meta.desc,
      nextPeriodDays,
      predictedCycleLength,
      calData,
      isLoading,
      error,
      refetch,
    };
  }, [calData, today, isLoading, error, refetch]);
}
