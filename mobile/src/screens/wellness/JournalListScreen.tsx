/**
 * JournalListScreen — FlatList of journal entries with sentiment badges.
 */

import React from 'react';
import { FlatList, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import type { WellnessStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<WellnessStackParamList, 'JournalList'>;

interface JournalEntry {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  moodTag: string;
}

const MOCK_JOURNALS: JournalEntry[] = [
  { id: '1', title: 'Good day at work', preview: 'Today went really well...', createdAt: '2h ago', sentiment: 'positive', moodTag: 'Happy' },
  { id: '2', title: 'Feeling anxious', preview: 'Had some anxiety about...', createdAt: '1d ago', sentiment: 'negative', moodTag: 'Anxious' },
  { id: '3', title: 'Meditation session', preview: 'Tried the new breathing...', createdAt: '2d ago', sentiment: 'neutral', moodTag: 'Calm' },
];

const sentimentColors = { positive: '#D1FAE5', neutral: '#FEF3C7', negative: '#FEE2E2' } as const;

export function JournalListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();

  const renderItem = ({ item }: { item: JournalEntry }) => (
    <Pressable
      onPress={() => navigation.navigate('JournalEntry', { id: item.id })}
      accessibilityRole="button"
      accessibilityLabel={`Journal: ${item.title}`}
    >
      <Card elevated style={{ marginBottom: theme.spacing.md }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Txt variant="h3">{item.title}</Txt>
            <Txt variant="bodySmall" color="secondary" style={{ marginTop: 4 }}>{item.preview}</Txt>
          </View>
          <View style={[styles.sentiment, { backgroundColor: sentimentColors[item.sentiment], borderRadius: theme.radius.pill }]}>
            <Txt variant="caption" color="primary">{item.sentiment}</Txt>
          </View>
        </View>
        <View style={styles.footer}>
          <Txt variant="caption" color="muted">{item.createdAt}</Txt>
          <View style={[styles.moodTag, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.sm }]}>
            <Txt variant="caption" color="primary">{item.moodTag}</Txt>
          </View>
        </View>
      </Card>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={MOCK_JOURNALS}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">Journal</Txt>
            <Txt variant="body" color="secondary">Your personal thoughts and reflections.</Txt>
          </View>
        }
        ListEmptyComponent={
          <Card><Txt variant="body" color="secondary" align="center">No journal entries yet. Start writing!</Txt></Card>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  sentiment: { paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  moodTag: { paddingHorizontal: 8, paddingVertical: 2 },
});
