import { create } from 'zustand';

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

export const useEndDateStore = create<EndDateState & EndDateActions>()((set) => ({
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
}));
