import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface EndDateState {
  entryId: string | null;
  periodStartDate: string | null;
  predictionId: string | null;
  notificationId: string | null;
  avgPeriodLength: number;
}

interface EndDateActions {
  setPending: (entryId: string, periodStartDate: string, predictionId: string | null, avgPeriodLength?: number) => void;
  setNotificationId: (notificationId: string) => void;
  clearPending: () => void;
}

export const useEndDateStore = create<EndDateState & EndDateActions>()(
  persist(
    (set) => ({
      entryId: null,
      periodStartDate: null,
      predictionId: null,
      notificationId: null,
      avgPeriodLength: 5,

      setPending: (entryId, periodStartDate, predictionId, avgPeriodLength = 5) =>
        set({ entryId, periodStartDate, predictionId, avgPeriodLength }),

      setNotificationId: (notificationId) => set({ notificationId }),

      clearPending: () =>
        set({ entryId: null, periodStartDate: null, predictionId: null, notificationId: null, avgPeriodLength: 5 }),
    }),
    {
      name: 'shecare.end_date_pending',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        entryId: state.entryId,
        periodStartDate: state.periodStartDate,
        predictionId: state.predictionId,
        notificationId: state.notificationId,
        avgPeriodLength: state.avgPeriodLength,
      }),
    },
  ),
);
