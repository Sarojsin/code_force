import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CalendarResponse } from 'src/services/api';
import { useLogCorrection, useLogSnooze } from 'src/services/queries';

const SNOOZE_KEY = 'shecare.sticky_snooze';

interface SnoozeState {
  predictionId: string;
  dayOffset: number;
  snoozedAt: string;
}

export interface PeriodCheckIn {
  visible: boolean;
  predictedDate: string;
  predictionId: string;
  loading: boolean;
  onConfirm: (predictionId: string, confirmedDate: string) => void;
  onAdjust: (predictionId: string, newDate: string) => void;
  onSnooze: (predictionId: string, dayOffset: number) => void;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function usePeriodCheckIn(calData?: CalendarResponse | null): PeriodCheckIn {
  const logCorrection = useLogCorrection();
  const logSnooze = useLogSnooze();
  const [snoozeState, setSnoozeState] = useState<SnoozeState | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SNOOZE_KEY).then((val) => {
      if (val) {
        try {
          setSnoozeState(JSON.parse(val));
        } catch {}
      }
    });
  }, []);

  const persistSnooze = useCallback(async (state: SnoozeState | null) => {
    if (state) {
      await AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify(state));
    } else {
      await AsyncStorage.removeItem(SNOOZE_KEY);
    }
    setSnoozeState(state);
  }, []);

  const prediction = calData?.predictions ?? null;
  const today = useMemo(() => new Date(), []);

  const visible = (() => {
    if (!prediction) return false;
    if (!calData?.needs_checkin) return false;
    if (snoozeState) {
      const snoozedAt = new Date(snoozeState.snoozedAt);
      if (toDateStr(snoozedAt) === toDateStr(today)) return false;
      const snoozeEnd = addDays(snoozedAt, snoozeState.dayOffset);
      if (today <= snoozeEnd) return false;
    }
    return true;
  })();

  const onConfirm = useCallback(
    (predictionId: string, confirmedDate: string) => {
      logCorrection.mutate(
        { period_start_date: confirmedDate, corrected_prediction_id: predictionId },
        { onSuccess: () => persistSnooze(null) },
      );
    },
    [logCorrection, persistSnooze],
  );

  const onAdjust = useCallback(
    (predictionId: string, newDate: string) => {
      logCorrection.mutate(
        { period_start_date: newDate, corrected_prediction_id: predictionId },
        { onSuccess: () => persistSnooze(null) },
      );
    },
    [logCorrection, persistSnooze],
  );

  const onSnooze = useCallback(
    (predictionId: string, _dayOffset: number) => {
      const currentOffset =
        snoozeState?.predictionId === predictionId ? snoozeState.dayOffset + 1 : 1;
      logSnooze.mutate(
        { predictedCycleId: predictionId, dayOffset: currentOffset },
        {
          onSuccess: () =>
            persistSnooze({ predictionId, dayOffset: currentOffset, snoozedAt: toDateStr(today) }),
        },
      );
    },
    [logSnooze, persistSnooze, snoozeState, today],
  );

  return {
    visible,
    predictedDate: prediction?.predicted_next_period_start ?? '',
    predictionId: prediction?.id ?? '',
    loading: logCorrection.isPending || logSnooze.isPending,
    onConfirm,
    onAdjust,
    onSnooze,
  };
}
