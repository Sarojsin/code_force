/**
 * InsightsScreen — wellness insights dashboard.
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

const INSIGHTS = [
  { label: 'Entries this week', value: '5', color: '#D1FAE5', icon: '&#128221;' },
  { label: 'Avg mood score', value: '7.2', color: '#BFDBFE', icon: '&#128200;' },
  { label: 'Most common mood', value: 'Happy', color: '#FEF3C7', icon: '&#128522;' },
  { label: 'Breathing streak', value: '3 days', color: '#EDE9FE', icon: '&#128166;' },
  { label: 'Journal streak', value: '5 days', color: '#FCE7F3', icon: '&#128214;' },
];

export function InsightsScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>Wellness Insights</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>
          Your wellness patterns and progress.
        </Txt>

        <View style={styles.grid}>
          {INSIGHTS.map(item => (
            <Card
              key={item.label}
              style={[styles.card, { backgroundColor: item.color, borderColor: 'transparent' }]}
              padded
              accessibilityLabel={`${item.label}: ${item.value}`}
            >
              <Txt variant="h2" style={{ marginBottom: 4 }}>{item.icon}</Txt>
              <Txt variant="h3" style={{ marginBottom: 2 }}>{item.value}</Txt>
              <Txt variant="caption" color="secondary">{item.label}</Txt>
            </Card>
          ))}
        </View>

        <Card style={{ marginTop: theme.spacing.lg }}>
          <Txt variant="h3" style={{ marginBottom: theme.spacing.md }}>Recommendations</Txt>
          <View style={[styles.tipRow, { borderBottomColor: theme.colors.border }]}>
            <Txt variant="bodySmall">&#8226; Try journaling 10 minutes before bed</Txt>
          </View>
          <View style={[styles.tipRow, { borderBottomColor: theme.colors.border }]}>
            <Txt variant="bodySmall">&#8226; Your mood improves after exercise</Txt>
          </View>
          <View style={styles.tipRow}>
            <Txt variant="bodySmall">&#8226; Deep breathing helps with anxiety spikes</Txt>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', marginBottom: 12, minHeight: 100 },
  tipRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
