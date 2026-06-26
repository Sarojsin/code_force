/**
 * MoodHistoryScreen — timeline of mood logs with trend indicators.
 */

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

interface MoodLog {
  id: string;
  mood: string;
  emoji: string;
  intensity: number;
  createdAt: string;
  note?: string;
}

const MOCK_LOGS: MoodLog[] = [
  { id: '1', mood: 'Happy', emoji: '&#128522;', intensity: 8, createdAt: 'Today, 10:30 AM', note: 'Great morning walk' },
  { id: '2', mood: 'Anxious', emoji: '&#128552;', intensity: 6, createdAt: 'Yesterday, 2:15 PM' },
  { id: '3', mood: 'Tired', emoji: '&#128564;', intensity: 4, createdAt: '2 days ago, 8:00 PM' },
  { id: '4', mood: 'Sad', emoji: '&#128542;', intensity: 3, createdAt: '3 days ago, 6:30 PM' },
  { id: '5', mood: 'Motivated', emoji: '&#128170;', intensity: 9, createdAt: '4 days ago, 7:00 AM' },
];

function TrendArrow({ current, next }: { current: number; next?: number }) {
  if (next === undefined) return <Txt variant="caption" color="muted">&mdash;</Txt>;
  if (current > next) return <Txt variant="caption" color="success">&uarr;</Txt>;
  if (current < next) return <Txt variant="caption" color="danger">&darr;</Txt>;
  return <Txt variant="caption" color="muted">&rarr;</Txt>;
}

export function MoodHistoryScreen() {
  const theme = useTheme();

  const renderItem = ({ item, index }: { item: MoodLog; index: number }) => (
    <Card elevated style={{ marginBottom: theme.spacing.md }} accessibilityLabel={`Mood: ${item.mood}, intensity ${item.intensity}`}>
      <View style={styles.row}>
        <Txt variant="h2" style={{ marginRight: theme.spacing.sm }}>{item.emoji}</Txt>
        <View style={{ flex: 1 }}>
          <View style={styles.topRow}>
            <Txt variant="h3">{item.mood}</Txt>
            <TrendArrow current={item.intensity} next={MOCK_LOGS[index + 1]?.intensity} />
          </View>
          <Txt variant="bodySmall" color="secondary">Intensity: {item.intensity}/10</Txt>
          {item.note && <Txt variant="caption" color="muted" style={{ marginTop: 2 }}>{item.note}</Txt>}
        </View>
      </View>
      <Txt variant="caption" color="muted" style={{ marginTop: 8 }}>{item.createdAt}</Txt>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={MOCK_LOGS}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">Mood History</Txt>
            <Txt variant="body" color="secondary">Track your emotional trends over time.</Txt>
          </View>
        }
        ListEmptyComponent={
          <Card><Txt variant="body" color="secondary" align="center">No moods logged yet.</Txt></Card>
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
