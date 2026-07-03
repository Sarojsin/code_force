import React from 'react';
import { ScrollView, StyleSheet, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { wellnessService } from 'src/services/api/wellness';
import type { WellnessInsights } from 'src/services/api/wellness';

const INSIGHT_CARDS = [
  { key: 'total_journal_entries', label: 'Journal entries', icon: '📝', color: '#D1FAE5' },
  { key: 'total_mood_logs', label: 'Mood logs (30d)', icon: '😊', color: '#FEF3C7' },
  { key: 'average_mood_intensity', label: 'Avg mood intensity', icon: '📊', color: '#BFDBFE' },
  { key: 'most_common_mood', label: 'Most common mood', icon: '🏆', color: '#EDE9FE' },
];

export function InsightsScreen() {
  const theme = useTheme();

  const { data: insights, isLoading } = useQuery<WellnessInsights>({
    queryKey: ['wellness', 'insights'],
    queryFn: () => wellnessService.getInsights(),
  });

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>Wellness Insights</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>
          Your wellness patterns and progress.
        </Txt>

        <View style={styles.grid}>
          {INSIGHT_CARDS.map(card => {
            const raw = insights?.[card.key as keyof WellnessInsights];
            const value = raw != null ? String(raw) : '—';
            return (
              <Card
                key={card.key}
                style={[styles.card, { backgroundColor: card.color, borderColor: 'transparent' }]}
                padded
                accessibilityLabel={`${card.label}: ${value}`}
              >
                <Txt variant="h2" style={{ marginBottom: 4 }}>{card.icon}</Txt>
                <Txt variant="h3" style={{ marginBottom: 2 }}>{value}</Txt>
                <Txt variant="caption" color="secondary">{card.label}</Txt>
              </Card>
            );
          })}
        </View>

        {insights?.recommendation && (
          <Card style={{ marginTop: theme.spacing.lg }}>
            <Txt variant="h3" style={{ marginBottom: theme.spacing.md }}>Recommendation</Txt>
            <View style={styles.tipRow}>
              <Txt variant="bodySmall">{insights.recommendation}</Txt>
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', marginBottom: 12, minHeight: 100 },
  tipRow: { paddingVertical: 10 },
});
