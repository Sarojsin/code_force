/**
 * PregnancyMilestonesScreen — list of milestones by week.
 */

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

interface Milestone {
  id: string;
  week: number;
  title: string;
  description: string;
  achieved: boolean;
}

const MILESTONES: Milestone[] = [
  { id: '1', week: 4, title: ' implantation', description: 'The embryo implants in the uterus.', achieved: true },
  { id: '2', week: 8, title: 'Heartbeat detectable', description: 'Tiny heart starts beating.', achieved: true },
  { id: '3', week: 12, title: 'End of first trimester', description: 'Baby\'s organs are formed.', achieved: false },
  { id: '4', week: 16, title: ' Quickening', description: 'You may feel the baby move.', achieved: false },
  { id: '5', week: 20, title: 'Anatomy scan', description: 'Mid-pregnancy ultrasound.', achieved: false },
  { id: '6', week: 24, title: 'Viability threshold', description: 'Baby has a chance of survival if born early.', achieved: false },
  { id: '7', week: 28, title: 'Third trimester begins', description: 'Baby gains weight rapidly.', achieved: false },
  { id: '8', week: 32, title: 'Frequent movement', description: 'Baby\'s movements are strong and regular.', achieved: false },
  { id: '9', week: 36, title: 'Engagement', description: 'Baby moves into head-down position.', achieved: false },
  { id: '10', week: 40, title: 'Full term', description: 'Ready for birth!', achieved: false },
];

export function PregnancyMilestonesScreen() {
  const theme = useTheme();

  const renderItem = ({ item }: { item: Milestone }) => (
    <Card
      elevated
      style={[styles.card, { opacity: item.achieved ? 1 : 0.7 }]}
      accessibilityLabel={`Week ${item.week}: ${item.title}`}
    >
      <View style={styles.row}>
        <View style={[
          styles.weekBadge,
          {
            backgroundColor: item.achieved ? theme.colors.success : theme.colors.border,
            borderRadius: theme.radius.md,
          },
        ]}>
          <Txt variant="bodySmall" color={item.achieved ? 'inverse' : 'primary'}>{item.week}</Txt>
        </View>
        <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
          <Txt variant="h3">{item.title}</Txt>
          <Txt variant="bodySmall" color="secondary" style={{ marginTop: 2 }}>{item.description}</Txt>
        </View>
        {item.achieved && (
          <Txt variant="body" color="success">&#10003;</Txt>
        )}
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={MILESTONES}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">Milestones</Txt>
            <Txt variant="body" color="secondary">Key pregnancy milestones by week.</Txt>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  card: { marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  weekBadge: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
