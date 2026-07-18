import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Skeleton, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useCycleAnalytics } from 'src/services/queries';

export function CycleAnalyticsScreen() {
  const theme = useTheme();
  const { data: analytics, isLoading } = useCycleAnalytics();
  const barColors = [theme.colors.primary, theme.colors.accent, theme.colors.warning, theme.colors.success];

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <View style={{ padding: theme.spacing.lg }}>
          <Skeleton height={24} width={180} style={{ marginBottom: 16 }} />
          <Skeleton height={80} style={{ marginBottom: 12 }} />
          <Skeleton height={80} style={{ marginBottom: 12 }} />
          <Skeleton height={200} />
        </View>
      </SafeAreaView>
    );
  }

  const avgCycle = analytics?.average_cycle_length_days;
  const totalEntries = analytics?.total_entries ?? 0;
  const commonSymptoms = analytics?.common_symptoms ?? [];
  const commonMoods = analytics?.common_moods ?? [];
  const maxSymptomCount = Math.max(1, ...commonSymptoms.map(s => s.count));
  const maxMoodCount = Math.max(1, ...commonMoods.map(m => m.count));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>Analytics</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>
          Your cycle patterns at a glance.
        </Txt>

        <View style={styles.statRow}>
          <Card style={{ flex: 1, marginRight: theme.spacing.sm }} padded accessibilityLabel="Average cycle length">
            <Txt variant="h2" color="primary" align="center">{avgCycle ?? '--'}</Txt>
            <Txt variant="bodySmall" color="secondary" align="center">Avg cycle (days)</Txt>
          </Card>
          <Card style={{ flex: 1, marginLeft: theme.spacing.sm }} padded accessibilityLabel="Total cycles logged">
            <Txt variant="h2" color="primary" align="center">{totalEntries}</Txt>
            <Txt variant="bodySmall" color="secondary" align="center">Cycles logged</Txt>
          </Card>
        </View>

        {commonSymptoms.length > 0 && (
          <Card style={{ marginTop: theme.spacing.lg }}>
            <Txt variant="h3" style={{ marginBottom: theme.spacing.md }}>Common symptoms</Txt>
            {commonSymptoms.map((s, i) => (
              <View key={s.symptom} style={styles.barRow}>
                <Txt variant="bodySmall" style={{ width: 80 }}>{s.symptom}</Txt>
                <View style={[styles.barBg, { backgroundColor: theme.colors.border, borderRadius: theme.radius.sm }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${(s.count / maxSymptomCount) * 100}%`,
                        backgroundColor: barColors[i % barColors.length],
                        borderRadius: theme.radius.sm,
                      },
                    ]}
                  />
                </View>
                <Txt variant="caption" color="muted" style={{ width: 30, textAlign: 'right' }}>{s.count}</Txt>
              </View>
            ))}
          </Card>
        )}

        {commonMoods.length > 0 && (
          <Card style={{ marginTop: theme.spacing.md }}>
            <Txt variant="h3" style={{ marginBottom: theme.spacing.md }}>Common moods</Txt>
            {commonMoods.map((m, i) => (
              <View key={m.mood} style={styles.barRow}>
                <Txt variant="bodySmall" style={{ width: 80 }}>{m.mood}</Txt>
                <View style={[styles.barBg, { backgroundColor: theme.colors.border, borderRadius: theme.radius.sm }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${(m.count / maxMoodCount) * 100}%`,
                        backgroundColor: barColors[i % barColors.length],
                        borderRadius: theme.radius.sm,
                      },
                    ]}
                  />
                </View>
                <Txt variant="caption" color="muted" style={{ width: 30, textAlign: 'right' }}>{m.count}</Txt>
              </View>
            ))}
          </Card>
        )}

        {totalEntries === 0 && (
          <Card style={{ marginTop: theme.spacing.lg }}>
            <Txt variant="body" color="secondary" align="center">
              No data yet — log your first period cycle to see analytics.
            </Txt>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  statRow: { flexDirection: 'row', marginBottom: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  barBg: { flex: 1, height: 20, marginLeft: 8, marginRight: 8 },
  barFill: { height: '100%' },
});
