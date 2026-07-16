import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { wellnessService } from 'src/services/api/wellness';
import type { MoodLog } from 'src/services/api/wellness';

const MOOD_EMOJIS: Record<string, string> = {
  Happy: '😊', Neutral: '😐', Sad: '😢', Angry: '😠',
  Anxious: '😰', Tired: '😴', Loved: '🥰', Motivated: '💪',
};

function TrendArrow({ current, next }: { current: number; next?: number }) {
  if (next === undefined) return <Txt variant="caption" color="muted">—</Txt>;
  if (current > next) return <Txt variant="caption" color="success">↑</Txt>;
  if (current < next) return <Txt variant="caption" color="danger">↓</Txt>;
  return <Txt variant="caption" color="muted">→</Txt>;
}

const MoodItem = React.memo(function MoodItem({ item, nextIntensity, theme }: { item: MoodLog; nextIntensity?: number; theme: any }) {
  const emoji = MOOD_EMOJIS[item.mood] ?? '😐';
  return (
    <Card elevated style={{ marginBottom: theme.spacing.md }} accessibilityLabel={`Mood: ${item.mood}, intensity ${item.intensity}`}>
      <View style={styles.row}>
        <Txt variant="h2" style={{ marginRight: theme.spacing.sm }}>{emoji}</Txt>
        <View style={{ flex: 1 }}>
          <View style={styles.topRow}>
            <Txt variant="h3">{item.mood}</Txt>
            <TrendArrow current={item.intensity} next={nextIntensity} />
          </View>
          <Txt variant="bodySmall" color="secondary">Intensity: {item.intensity}/10</Txt>
          {item.notes && <Txt variant="caption" color="muted" style={{ marginTop: 2 }}>{item.notes}</Txt>}
        </View>
      </View>
      <Txt variant="caption" color="muted" style={{ marginTop: 8 }}>
        {new Date(item.logged_at).toLocaleString()}
      </Txt>
    </Card>
  );
});

export function MoodHistoryScreen() {
  const theme = useTheme();

  const { data: logs, isLoading, isError, refetch } = useQuery<MoodLog[]>({
    queryKey: ['wellness', 'mood'],
    queryFn: () => wellnessService.getMoodLogs(30),
  });

  const renderItem = useCallback(({ item, index }: { item: MoodLog; index: number }) => (
    <MoodItem item={item} nextIntensity={logs?.[index + 1]?.intensity} theme={theme} />
  ), [logs, theme]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={logs ?? []}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        refreshing={isLoading}
        onRefresh={refetch}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        initialNumToRender={7}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">Mood History</Txt>
            <Txt variant="body" color="secondary">Track your emotional trends over time.</Txt>
          </View>
        }
        ListEmptyComponent={
          <Card>
            <Txt variant="body" color="secondary" align="center">
              {isError ? 'Failed to load mood history.' : 'No moods logged yet.'}
            </Txt>
          </Card>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
