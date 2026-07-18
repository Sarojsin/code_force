import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Skeleton, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useCycleEntries } from 'src/services/queries';

function toDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function CycleHistoryScreen() {
  const theme = useTheme();
  const { data: entries, isLoading } = useCycleEntries({ limit: 50 });

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <View style={{ padding: theme.spacing.lg }}>
          <Skeleton height={24} width={200} style={{ marginBottom: 16 }} />
          <Skeleton height={80} style={{ marginBottom: 12 }} />
          <Skeleton height={80} style={{ marginBottom: 12 }} />
          <Skeleton height={80} />
        </View>
      </SafeAreaView>
    );
  }

  const sortedEntries = entries ? [...entries].sort(
    (a, b) => new Date(b.period_start_date + 'T00:00:00').getTime() - new Date(a.period_start_date + 'T00:00:00').getTime(),
  ) : [];

  const renderItem = ({ item, index }: { item: { id: string; period_start_date: string; period_end_date?: string | null }; index: number }) => {
    const endDate = item.period_end_date || item.period_start_date;
    const startMs = new Date(item.period_start_date + 'T00:00:00').getTime();
    const endMs = new Date(endDate + 'T00:00:00').getTime();
    const periodLength = Math.round((endMs - startMs) / 86400000) + 1;

    return (
      <Card elevated style={{ marginBottom: theme.spacing.md }} accessibilityLabel={`Cycle from ${toDisplayDate(item.period_start_date)}`}>
        <View style={styles.cardHeader}>
          <View style={[styles.indicator, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm }]} />
          <Txt variant="h3" style={{ flex: 1 }}>Cycle {sortedEntries.length - index}</Txt>
          <Txt variant="bodySmall" color="secondary">{periodLength} days</Txt>
        </View>
        <View style={styles.detailRow}>
          <Txt variant="body" color="secondary">
            {toDisplayDate(item.period_start_date)} – {toDisplayDate(endDate)}
          </Txt>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={sortedEntries}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">Cycle History</Txt>
            <Txt variant="body" color="secondary">Your past cycles and patterns.</Txt>
          </View>
        }
        ListEmptyComponent={
          <Card>
            <Txt variant="body" color="secondary" align="center">No cycles logged yet.</Txt>
          </Card>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  indicator: { width: 8, height: 8, marginRight: 8 },
  detailRow: { marginTop: 4 },
});
