import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SyncMetrics {
  lastSyncAt: string | null;
  lastSyncDuration: number | null;
  lastSyncStatus: 'success' | 'failed' | null;
  totalOpsPushed: number;
  totalOpsPulled: number;
  totalSyncCycles: number;
  failedSyncCycles: number;
  maxQueueSize: number;
}

interface SyncMetricsState extends SyncMetrics {
  recordSync: (
    status: 'success' | 'failed',
    duration: number,
    opsPushed: number,
    opsPulled: number,
    queueSize: number,
  ) => void;
  reset: () => void;
}

const initial: SyncMetrics = {
  lastSyncAt: null,
  lastSyncDuration: null,
  lastSyncStatus: null,
  totalOpsPushed: 0,
  totalOpsPulled: 0,
  totalSyncCycles: 0,
  failedSyncCycles: 0,
  maxQueueSize: 0,
};

export const useSyncMetricsStore = create<SyncMetricsState>()(
  persist(
    (set, get) => ({
      ...initial,
      recordSync: (status, duration, opsPushed, opsPulled, queueSize) => {
        const state = get();
        set({
          lastSyncAt: new Date().toISOString(),
          lastSyncDuration: duration,
          lastSyncStatus: status,
          totalOpsPushed: state.totalOpsPushed + opsPushed,
          totalOpsPulled: state.totalOpsPulled + opsPulled,
          totalSyncCycles: state.totalSyncCycles + 1,
          failedSyncCycles: state.failedSyncCycles + (status === 'failed' ? 1 : 0),
          maxQueueSize: Math.max(state.maxQueueSize, queueSize),
        });
      },
      reset: () => set(initial),
    }),
    {
      name: 'shecare.sync.metrics',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
