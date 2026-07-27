# Phase 2 Day 3 — Health Hub: Store + Components

## Goal
Build the `healthMetricsStore` (Zustand) for runtime UI state, and create the reusable `HealthMetricCard` and `StreakBadge` components.

---

## 3.1 Create `src/stores/healthMetricsStore.ts`

```typescript
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

  hydrate: (userId: string) => Promise<void>;
  refreshToday: (userId: string) => Promise<void>;
  refreshStreaks: (userId: string) => Promise<void>;
  logMetric: (
    userId: string,
    type: MetricType,
    value: any
  ) => Promise<void>;
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

  /** Atomic refresh — fetches both today logs and streaks, then updates state once */
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
    const streaks = Object.fromEntries(streaksResults) as Record<
      MetricType,
      number
    >;
    set({
      todayLogs: grouped as Record<MetricType, MetricLog[]>,
      completion: { logged, total: 5 },
      streaks,
    });
  },

  logMetric: async (userId: string, type: MetricType, value: any) => {
    await healthMetricsLocalService.logMetric(userId, type, value);
    // Atomic refresh — single set() to avoid race conditions
    await get().refreshAll(userId);
  },
  })
);
```

**Why Zustand for local-only data** — This store wraps `HealthMetricsLocalService` calls and caches today's data in memory for instant UI renders. It follows the same pattern as `companionStore` but without persistence middleware (SQLite is the source of truth).

---

## 3.2 Create `src/components/ui/HealthMetricCard.tsx`

```tsx
import React, { useMemo } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/tokens';

interface HealthMetricCardProps {
  icon: string;
  label: string;
  value: string;
  target: string;
  logged: boolean;
  streak: number;
  onPress: () => void;
}

export const HealthMetricCard = React.memo(function HealthMetricCard({
  icon,
  label,
  value,
  target,
  logged,
  streak,
  onPress,
}: HealthMetricCardProps) {
  const theme = useTheme();

  const progress = useMemo(() => {
    // Parse value and target to calculate ratio
    const val = parseFloat(value) || 0;
    const tgt = parseFloat(target) || 1;
    return Math.min(val / tgt, 1);
  }, [value, target]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: logged
            ? theme.colors.primaryContainer
            : theme.colors.surface,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
      accessibilityLabel={`${label}: ${value} of ${target} target. ${logged ? 'Logged' : 'Not logged'}. Streak: ${streak} days. Tap to log.`}
      accessibilityRole="button"
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.colors.primary }]}>
        {value}
      </Text>
      <Text style={[styles.target, { color: theme.colors.textSecondary }]}>
        Target: {target}
      </Text>
      {/* Simple progress bar */}
      <View style={styles.progressBg}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${progress * 100}%`,
              backgroundColor: logged
                ? theme.colors.primary
                : theme.colors.muted,
            },
          ]}
        />
      </View>
      {streak > 0 && (
        <View style={styles.streakRow}>
          <Text style={styles.fire}>🔥</Text>
          <Text style={[styles.streakText, { color: theme.colors.accent }]}>
            {streak} day{streak > 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: '48%',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    minHeight: 140,
  },
  icon: { fontSize: 28, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  value: { fontSize: 18, fontWeight: '700' },
  target: { fontSize: 11, marginBottom: 8 },
  progressBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  fire: { fontSize: 12, marginRight: 2 },
  streakText: { fontSize: 11, fontWeight: '600' },
});
```

---

## 3.3 Create `src/components/ui/StreakBadge.tsx`

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/tokens';

interface StreakBadgeProps {
  metricType: string;
  count: number;
  icon: string;
}

export const StreakBadge = React.memo(function StreakBadge({
  metricType,
  count,
  icon,
}: StreakBadgeProps) {
  const theme = useTheme();
  if (count === 0) return null;

  return (
    <View
      style={[styles.badge, { backgroundColor: theme.colors.primaryContainer }]}
      accessibilityLabel={`${metricType} streak: ${count} days`}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.count, { color: theme.colors.primary }]}>
        {count}
      </Text>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
        {metricType}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  icon: { fontSize: 14, marginRight: 4 },
  count: { fontSize: 14, fontWeight: '700', marginRight: 4 },
  label: { fontSize: 12 },
});
```

---

## 3.4 Validation

- [ ] `healthMetricsStore` is created with `create<HealthMetricsState>()` typing
- [ ] `hydrate()` calls both `refreshToday()` and `refreshStreaks()`
- [ ] `logMetric()` inserts and refreshes state
- [ ] `HealthMetricCard` renders with theme tokens, progress bar, streak indicator
- [ ] `HealthMetricCard` uses `React.memo` and `useMemo` for progress
- [ ] `StreakBadge` returns `null` when count is 0
- [ ] Touch targets ≥ 44×44 on card
- [ ] `tsc --noEmit` passes with 0 new errors
