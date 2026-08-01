import { useCallback, useMemo, useState } from 'react';

import { getBackfillCards, BackfillCard } from 'src/utils/backfillCards';
import {
  useCreateCycleEntry,
  useCycleEntries,
  useUpdateCycleEntry,
} from 'src/services/queries';
import { useEndDateStore } from 'src/stores/endDateStore';
import { cancelEndDateNotification } from 'src/services/endDateNotifications';

export interface CatchUp {
  backfillCards: BackfillCard[];
  busyMonth: string | null;
  isDoneOrSkipped: (monthLabel: string) => boolean;
  isSkipped: (monthLabel: string) => boolean;
  handleFill: (expectedStart: string, expectedEnd: string, monthLabel: string) => void;
  handleSkip: (expectedStart: string, expectedEnd: string, monthLabel: string) => void;
  endDate: {
    entryId: string | null;
    periodStartDate: string | null;
    notificationId: string | null;
    daysSinceStart: number;
  } | null;
  confirmEndDate: (endDate: string) => void;
  skipEndDate: () => void;
  endDateLoading: boolean;
}

export function useCatchUp(): CatchUp {
  const createEntry = useCreateCycleEntry();
  const updateEntry = useUpdateCycleEntry();
  const { data: entries } = useCycleEntries({ limit: 1 });

  const [done, setDone] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [busyMonth, setBusyMonth] = useState<string | null>(null);

  const entryId = useEndDateStore((s) => s.entryId);
  const periodStartDate = useEndDateStore((s) => s.periodStartDate);
  const notificationId = useEndDateStore((s) => s.notificationId);
  const clearPending = useEndDateStore((s) => s.clearPending);

  const backfillCards = useMemo(() => getBackfillCards(entries ?? [], new Date()), [entries]);

  const isDoneOrSkipped = useCallback(
    (monthLabel: string) => done.includes(monthLabel) || skipped.includes(monthLabel),
    [done, skipped],
  );
  const isSkipped = useCallback((monthLabel: string) => skipped.includes(monthLabel), [skipped]);

  const handleFill = useCallback(
    (expectedStart: string, expectedEnd: string, monthLabel: string) => {
      setBusyMonth(monthLabel);
      createEntry.mutate(
        {
          period_start_date: expectedStart,
          period_end_date: expectedEnd,
          cycle_type: 'menstrual',
        },
        {
          onSuccess: () => {
            setDone((prev) => [...prev, monthLabel]);
            setBusyMonth(null);
          },
          onError: () => setBusyMonth(null),
        },
      );
    },
    [createEntry],
  );

  const handleSkip = useCallback(
    (expectedStart: string, expectedEnd: string, monthLabel: string) => {
      setBusyMonth(monthLabel);
      createEntry.mutate(
        {
          period_start_date: expectedStart,
          period_end_date: expectedEnd,
          cycle_type: 'anovulatory',
        },
        {
          onSuccess: () => {
            setSkipped((prev) => [...prev, monthLabel]);
            setBusyMonth(null);
          },
          onError: () => setBusyMonth(null),
        },
      );
    },
    [createEntry],
  );

  const daysSinceStart = periodStartDate
    ? Math.max(
        0,
        Math.round((new Date().getTime() - new Date(periodStartDate + 'T00:00:00').getTime()) / 86400000),
      )
    : 0;

  const endDate = periodStartDate
    ? { entryId, periodStartDate, notificationId, daysSinceStart }
    : null;

  const confirmEndDate = useCallback(
    (endDateValue: string) => {
      if (!entryId) return;
      updateEntry.mutate(
        { id: entryId, data: { period_end_date: endDateValue } },
        {
          onSuccess: () => {
            if (notificationId) cancelEndDateNotification(notificationId).catch(() => {});
            clearPending();
          },
        },
      );
    },
    [updateEntry, entryId, notificationId, clearPending],
  );

  const skipEndDate = useCallback(() => {
    if (notificationId) cancelEndDateNotification(notificationId).catch(() => {});
    clearPending();
  }, [notificationId, clearPending]);

  return {
    backfillCards,
    busyMonth,
    isDoneOrSkipped,
    isSkipped,
    handleFill,
    handleSkip,
    endDate,
    confirmEndDate,
    skipEndDate,
    endDateLoading: updateEntry.isPending,
  };
}
