import { create } from 'zustand';
import { healthMetricsLocalService } from '../services/localDb';
import type { MetricType } from '../services/localDb/HealthMetricsLocalService';

interface MetricLog {
  loggedAt: string;
  value: any;
}

interface HealthMetricsState {
  todayLogs: Record<MetricType, MetricLog[]>;
  streaks: Record<MetricType, number>;
  completion: { logged: MetricType[]; total: number };
  isLoading: boolean;

  reset: () => void;
  hydrate: (userId: string) => Promise<void>;
  refreshToday: (userId: string) => Promise<void>;
  refreshStreaks: (userId: string) => Promise<void>;
  refreshAll: (userId: string) => Promise<void>;
  logMetric: (userId: string, type: MetricType, value: any) => Promise<void>;
}

const ALL_METRICS: MetricType[] = [
  'sleep',
  'water',
  'food',
  'exercise',
  'medication',
];

export const useHealthMetricsStore = create<HealthMetricsState>(
  (set, get) => ({
    todayLogs: {
      sleep: [],
      water: [],
      food: [],
      exercise: [],
      medication: [],
    },
    streaks: {
      sleep: 0,
      water: 0,
      food: 0,
      exercise: 0,
      medication: 0,
    },
    completion: { logged: [], total: 5 },
    isLoading: false,

    reset: () => set({
      todayLogs: {
        sleep: [],
        water: [],
        food: [],
        exercise: [],
        medication: [],
      },
      streaks: {
        sleep: 0,
        water: 0,
        food: 0,
        exercise: 0,
        medication: 0,
      },
      completion: { logged: [], total: 5 },
      isLoading: false,
    }),

    hydrate: async (userId: string) => {
      set({ isLoading: true });
      await get().refreshAll(userId);
      set({ isLoading: false });
    },

    refreshToday: async (userId: string) => {
      const rows = await healthMetricsLocalService.getToday(userId);
      const grouped: Record<string, MetricLog[]> = {};
      for (const m of ALL_METRICS) grouped[m] = [];
      for (const row of rows) {
        const type = row.metric_type as MetricType;
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push({
          loggedAt: row.logged_at,
          value: JSON.parse(row.value),
        });
      }
      const logged = Object.entries(grouped)
        .filter(([, logs]) => logs.length > 0)
        .map(([type]) => type as MetricType);
      set({
        todayLogs: grouped as Record<MetricType, MetricLog[]>,
        completion: { logged, total: 5 },
      });
    },

    refreshStreaks: async (userId: string) => {
      const results = await Promise.all(
        ALL_METRICS.map((m) =>
          healthMetricsLocalService.getStreak(userId, m).then((s) => [m, s] as const)
        )
      );
      const streaks = Object.fromEntries(results) as Record<MetricType, number>;
      set({ streaks });
    },

    refreshAll: async (userId: string) => {
      const [rows, streaksResults] = await Promise.all([
        healthMetricsLocalService.getToday(userId),
        Promise.all(
          ALL_METRICS.map((m) =>
            healthMetricsLocalService
              .getStreak(userId, m)
              .then((s) => [m, s] as const)
          )
        ),
      ]);
      const grouped: Record<string, MetricLog[]> = {};
      for (const m of ALL_METRICS) grouped[m] = [];
      for (const row of rows) {
        const type = row.metric_type as MetricType;
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push({
          loggedAt: row.logged_at,
          value: JSON.parse(row.value),
        });
      }
      const logged = Object.entries(grouped)
        .filter(([, logs]) => logs.length > 0)
        .map(([type]) => type as MetricType);
      const streaks = Object.fromEntries(streaksResults) as Record<MetricType, number>;
      set({
        todayLogs: grouped as Record<MetricType, MetricLog[]>,
        completion: { logged, total: 5 },
        streaks,
      });
    },

    logMetric: async (userId: string, type: MetricType, value: any) => {
      await healthMetricsLocalService.logMetric(userId, type, value);
      await get().refreshAll(userId);
    },
  })
);
