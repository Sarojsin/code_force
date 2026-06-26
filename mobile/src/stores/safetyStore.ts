import { create } from 'zustand';

import { safetyService, SosAlert } from 'src/services/api';
import { logger } from 'src/utils';

interface SafetyState {
  activeAlert: SosAlert | null;
  isLoading: boolean;
  badgeCount: number;
  fetchActiveAlert: () => Promise<void>;
  setActiveAlert: (alert: SosAlert | null) => void;
  clearAlert: () => void;
}

export const useSafetyStore = create<SafetyState>((set) => ({
  activeAlert: null,
  isLoading: false,
  badgeCount: 0,

  fetchActiveAlert: async () => {
    set({ isLoading: true });
    try {
      const alert = await safetyService.getActiveSos();
      set({ activeAlert: alert, badgeCount: alert ? 1 : 0, isLoading: false });
    } catch (err) {
      logger.error('safetyStore.fetchActiveAlert.failed', err);
      set({ isLoading: false });
    }
  },

  setActiveAlert: (alert) => {
    set({ activeAlert: alert, badgeCount: alert ? 1 : 0 });
  },

  clearAlert: () => {
    set({ activeAlert: null, badgeCount: 0 });
  },
}));
