/**
 * CycleAnalyticsScreen — average cycle length, common symptoms, mood charts.
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

const MOCK_STATS = {
  avgCycleLength: 28,
  avgPeriodLength: 5,
  loggedCycles: 4,
  commonSymptoms: ['Cramps', 'Fatigue', 'Bloating'] as string[],
  commonMoods: ['Irritable', 'Tired', 'Sad'] as string[],
};

export function CycleAnalyticsScreen() {
  const theme = useTheme();
  const barColors = [theme.colors.primary, theme.colors.accent, theme.colors.warning, theme.colors.success];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>Analytics</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>
          Your cycle patterns at a glance.
        </Txt>

        <View style={styles.statRow}>
          <Card style={{ flex: 1, marginRight: theme.spacing.sm }} padded accessibilityLabel="Average cycle length">
            <Txt variant="h2" color="primary" align="center">{MOCK_STATS.avgCycleLength}</Txt>
            <Txt variant="bodySmall" color="secondary" align="center">Avg cycle (days)</Txt>
          </Card>
          <Card style={{ flex: 1, marginLeft: theme.spacing.sm }} padded accessibilityLabel="Average period length">
            <Txt variant="h2" color="primary" align="center">{MOCK_STATS.avgPeriodLength}</Txt>
            <Txt variant="bodySmall" color="secondary" align="center">Avg period (days)</Txt>
          </Card>
        </View>
        <View style={styles.statRow}>
          <Card style={{ flex: 1, marginRight: theme.spacing.sm }} padded>
            <Txt variant="h2" color="success" align="center">{MOCK_STATS.loggedCycles}</Txt>
            <Txt variant="bodySmall" color="secondary" align="center">Cycles logged</Txt>
          </Card>
          <Card style={{ flex: 1, marginLeft: theme.spacing.sm }} padded>
            <Txt variant="bodySmall" color="secondary" align="center">Prediction</Txt>
            <Txt variant="bodySmall" color="muted" align="center">Improving...</Txt>
          </Card>
        </View>

        <Card style={{ marginTop: theme.spacing.lg }}>
          <Txt variant="h3" style={{ marginBottom: theme.spacing.md }}>Common symptoms</Txt>
          {MOCK_STATS.commonSymptoms.map((s, i) => (
            <View key={s} style={styles.barRow}>
              <Txt variant="bodySmall" style={{ width: 80 }}>{s}</Txt>
              <View style={[styles.bar, { backgroundColor: theme.colors.border, borderRadius: theme.radius.sm }]}>
                <View style={[styles.barFill, { width: `${(3 - i) * 33}%`, backgroundColor: barColors[i], borderRadius: theme.radius.sm }]} />
              </View>
            </View>
          ))}
        </Card>

        <Card style={{ marginTop: theme.spacing.md }}>
          <Txt variant="h3" style={{ marginBottom: theme.spacing.md }}>Common moods</Txt>
          {MOCK_STATS.commonMoods.map((m, i) => (
            <View key={m} style={styles.barRow}>
              <Txt variant="bodySmall" style={{ width: 80 }}>{m}</Txt>
              <View style={[styles.bar, { backgroundColor: theme.colors.border, borderRadius: theme.radius.sm }]}>
                <View style={[styles.barFill, { width: `${(3 - i) * 33}%`, backgroundColor: barColors[i], borderRadius: theme.radius.sm }]} />
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  statRow: { flexDirection: 'row', marginBottom: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  bar: { flex: 1, height: 20, marginLeft: 8 },
  barFill: { height: '100%' },
});
