import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useMoodLogs } from 'src/services/queries/wellness';
import type { MoodLog } from 'src/services/api';
import { MOOD_EMOJI_MAP } from 'src/components/ui/wellness/MoodPillList';

interface TrendArrowProps {
  current: number;
  next?: number;
}

function TrendArrow({ current, next }: TrendArrowProps) {
  if (next === undefined) return <Txt variant="caption" color="muted">—</Txt>;
  if (current > next) return <Txt variant="caption" color="success">↑</Txt>;
  if (current < next) return <Txt variant="caption" color="danger">↓</Txt>;
  return <Txt variant="caption" color="muted">→</Txt>;
}

const MoodItem = React.memo(function MoodItemInner({
  item,
  nextIntensity,
  theme,
}: {
  item: MoodLog;
  nextIntensity?: number;
  theme: any;
}) {
  const emoji = MOOD_EMOJI_MAP[item.mood] ?? '😐';
  return (
    <Card
      elevated
      style={[styles.card, { backgroundColor: theme.colors.surface }]}
      accessibilityLabel={`Mood: ${item.mood}, intensity ${item.intensity}`}
    >
      <View style={styles.row}>
        <Txt variant="h2" style={styles.emoji}>{emoji}</Txt>
        <View style={styles.info}>
          <View style={styles.topRow}>
            <Txt variant="h3">{item.mood}</Txt>
            <TrendArrow current={item.intensity} next={nextIntensity} />
          </View>
          <Txt variant="bodySmall" color="secondary">Intensity: {item.intensity}/10</Txt>
          {item.notes && <Txt variant="caption" color="muted" style={styles.notes}>{item.notes}</Txt>}
        </View>
      </View>
      <Txt variant="caption" color="muted" style={styles.timeText}>
        {new Date(item.logged_at).toLocaleString()}
      </Txt>
    </Card>
  );
});

export function MoodHistoryScreen() {
  const theme = useTheme();
  const { data: logs, isLoading, isError, refetch } = useMoodLogs({ per_page: 60 });

  const renderItem = useCallback(
    ({ item, index }: { item: MoodLog; index: number }) => (
      <MoodItem item={item} nextIntensity={logs?.[index + 1]?.intensity} theme={theme} />
    ),
    [logs, theme],
  );

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.safe, styles.centered, { backgroundColor: theme.colors.background }]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={logs ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshing={isLoading}
        onRefresh={refetch}
        windowSize={10}
        maxToRenderPerBatch={10}
        removeClippedSubviews={true}
        initialNumToRender={7}
        ListHeaderComponent={
          <View style={styles.header}>
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
  centered: { justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 24 },
  header: { marginBottom: 24 },
  card: {
    marginBottom: 8,
  },
  emoji: {
    marginRight: 8,
  },
  info: {
    flex: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notes: { marginTop: 2 },
  timeText: { marginTop: 8 },
});
