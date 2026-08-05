import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import type { CycleDay } from 'src/db/schema';

export interface MiniMetric {
  emoji: string;
  label: string;
  value: string;
  color: string;
}

interface MiniMetricsRowProps {
  dayData: CycleDay | null;
}

export function MiniMetricsRow({ dayData }: MiniMetricsRowProps) {
  const theme = useTheme();

  const metrics: MiniMetric[] = [
    {
      emoji: '🌙',
      label: 'Sleep',
      value: dayData?.sleep_minutes ? `${Math.round(dayData.sleep_minutes / 60)}h` : '—',
      color: theme.colors.accent,
    },
    {
      emoji: '💧',
      label: 'Water',
      value: dayData?.water_glasses != null ? `${dayData.water_glasses}/8` : '—',
      color: theme.colors.mint,
    },
    {
      emoji: '🏃',
      label: 'Energy',
      value: dayData?.energy_level != null ? `${dayData.energy_level}/3` : '—',
      color: theme.colors.roseQuartz,
    },
    {
      emoji: '🧘',
      label: 'Stress',
      value: dayData?.pain_level != null ? `${10 - dayData.pain_level}/10` : '—',
      color: theme.colors.primary,
    },
  ];

  return (
    <View style={styles.row}>
      {metrics.map((m) => (
        <MetricMiniCard key={m.label} metric={m} theme={theme} />
      ))}
    </View>
  );
}

function MetricMiniCard({ metric, theme }: { metric: MiniMetric; theme: any }) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Txt variant="emoji" style={styles.emoji}>{metric.emoji}</Txt>
      <Txt variant="h3" style={styles.value}>{metric.value}</Txt>
      <Txt variant="caption" color="muted" style={styles.label}>{metric.label}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 16,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
  },
  emoji: {
    fontSize: 20,
  },
  value: {
    marginTop: 2,
  },
  label: {
    fontSize: 10,
  },
});
