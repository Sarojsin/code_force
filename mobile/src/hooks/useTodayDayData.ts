import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useAuthStore } from 'src/stores/authStore';
import { localDb } from 'src/services/localDb';
import type { CycleDay } from 'src/db/schema';

/**
 * Lightweight hook: fetch today's CycleDay from local SQLite.
 * No network calls — offline-first, same pattern as useWellnessDashboard
 * but scoped to a single day.
 */
export function useTodayDayData(): CycleDay | null {
  const userId = useAuthStore((s) => s.user?.id);
  const [dayData, setDayData] = useState<CycleDay | null>(null);

  useEffect(() => {
    if (!userId) {
      setDayData(null);
      return;
    }
    const today = format(new Date(), 'yyyy-MM-dd');
    localDb.cycleDay
      .getByDate(userId, today)
      .then((data: CycleDay | null) => setDayData(data))
      .catch(() => setDayData(null));
  }, [userId]);

  return dayData;
}
