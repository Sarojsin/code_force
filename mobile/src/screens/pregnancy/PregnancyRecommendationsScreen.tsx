/**
 * PregnancyRecommendationsScreen — recommendations list.
 */

import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';

interface Recommendation {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  icon: string;
}

const RECOMMENDATIONS: Recommendation[] = [
  { id: '1', category: 'Nutrition', title: 'Take prenatal vitamins', description: 'Folic acid and iron are essential.', priority: 'high', icon: '&#128138;' },
  { id: '2', category: 'Exercise', title: 'Gentle walking', description: '30 min of moderate activity daily.', priority: 'medium', icon: '&#128694;' },
  { id: '3', category: 'Wellness', title: 'Stay hydrated', description: 'Drink 8-10 glasses of water daily.', priority: 'high', icon: '&#128167;' },
  { id: '4', category: 'Sleep', title: 'Sleep on your side', description: 'Left side improves blood flow.', priority: 'medium', icon: '&#128164;' },
  { id: '5', category: 'Checkup', title: 'Schedule prenatal visit', description: 'Monthly visits up to week 28.', priority: 'high', icon: '&#127973;' },
  { id: '6', category: 'Nutrition', title: 'Increase calcium intake', description: 'Dairy, leafy greens, fortified foods.', priority: 'medium', icon: '&#129374;' },
  { id: '7', category: 'Wellness', title: 'Manage stress', description: 'Try meditation or breathing exercises.', priority: 'low', icon: '&#129495;' },
];

const priorityColors = { high: '#FEE2E2', medium: '#FEF3C7', low: '#D1FAE5' } as const;

export function PregnancyRecommendationsScreen() {
  const theme = useTheme();

  const renderItem = ({ item }: { item: Recommendation }) => (
    <Card elevated style={{ marginBottom: theme.spacing.md }} accessibilityLabel={`${item.category}: ${item.title}`}>
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }]}>
          <Txt variant="h2">{item.icon}</Txt>
        </View>
        <View style={{ flex: 1, marginLeft: theme.spacing.md }}>
          <View style={styles.topRow}>
            <Txt variant="caption" color="muted">{item.category}</Txt>
            <View style={[styles.priorityBadge, { backgroundColor: priorityColors[item.priority], borderRadius: theme.radius.sm }]}>
              <Txt variant="caption" color="primary">{item.priority}</Txt>
            </View>
          </View>
          <Txt variant="h3" style={{ marginTop: 2 }}>{item.title}</Txt>
          <Txt variant="bodySmall" color="secondary" style={{ marginTop: 4 }}>{item.description}</Txt>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={RECOMMENDATIONS}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">Recommendations</Txt>
            <Txt variant="body" color="secondary">Personalized tips for a healthy pregnancy.</Txt>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  iconBox: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2 },
});
