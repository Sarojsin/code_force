/**
 * CycleHistoryScreen — FlatList of past cycle entries with calendar indicator.
 */

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

interface CycleEntry {
  id: string;
  startDate: string;
  endDate: string;
  cycleLength: number;
  flow: string;
}

const MOCK_CYCLES: CycleEntry[] = [
  { id: '1', startDate: 'Jan 1', endDate: 'Jan 5', cycleLength: 28, flow: 'Medium' },
  { id: '2', startDate: 'Jan 29', endDate: 'Feb 2', cycleLength: 27, flow: 'Light' },
  { id: '3', startDate: 'Feb 25', endDate: 'Mar 1', cycleLength: 29, flow: 'Heavy' },
];

export function CycleHistoryScreen() {
  const theme = useTheme();

  const renderItem = ({ item, index }: { item: CycleEntry; index: number }) => (
    <Card elevated style={{ marginBottom: theme.spacing.md }} accessibilityLabel={`Cycle from ${item.startDate}`}>
      <View style={styles.cardHeader}>
        <View style={[styles.indicator, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm }]} />
        <Txt variant="h3" style={{ flex: 1 }}>Cycle {MOCK_CYCLES.length - index}</Txt>
        <Txt variant="bodySmall" color="secondary">{item.cycleLength} days</Txt>
      </View>
      <View style={styles.detailRow}>
        <Txt variant="body" color="secondary">{item.startDate} – {item.endDate}</Txt>
      </View>
      <View style={styles.detailRow}>
        <Txt variant="bodySmall" color="muted">Flow: {item.flow}</Txt>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={MOCK_CYCLES}
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
