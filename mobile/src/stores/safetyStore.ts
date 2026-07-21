import { create } from 'zustand';

import { safetyService, SosAlert } from 'src/services/api';
import { getNativeDb } from 'src/db/connection';
import { logger } from 'src/utils';

interface SafetyState {
  activeAlert: SosAlert | null;
  isLoading: boolean;
  badgeCount: number;
  fetchActiveAlert: () => Promise<void>;
  setActiveAlert: (alert: SosAlert | null) => void;
  clearAlert: () => void;
}

function readActiveSosFromLocal(): SosAlert | null {
  try {
    const db = getNativeDb();
    const row = db.getFirstSync<any>(
      "SELECT * FROM sos_alerts WHERE is_active = 1 AND cancelled_at IS NULL AND resolved_at IS NULL ORDER BY triggered_at DESC LIMIT 1",
    );
    return (row ?? null) as SosAlert | null;
  } catch {
    return null;
  }
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
      const local = readActiveSosFromLocal();
      set({ activeAlert: local, badgeCount: local ? 1 : 0, isLoading: false });
      logger.error('safetyStore.fetchActiveAlert.failed_fallback_to_sqlite', err);
    }
  },

  setActiveAlert: (alert) => {
    set({ activeAlert: alert, badgeCount: alert ? 1 : 0 });
  },

  clearAlert: () => {
    set({ activeAlert: null, badgeCount: 0 });
  },
}));
