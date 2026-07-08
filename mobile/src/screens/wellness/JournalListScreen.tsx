import React, { useCallback } from 'react';
import { FlatList, StyleSheet, View, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';

import { Button, Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { wellnessService } from 'src/services/api/wellness';
import type { JournalEntry } from 'src/services/api/wellness';

type Nav = any;

function sentimentColor(label: string | null): string {
  switch (label) {
    case 'positive': return '#D1FAE5';
    case 'negative': return '#FEE2E2';
    default: return '#FEF3C7';
  }
}

export function JournalListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();

  const { data: entries, isLoading, isError, refetch } = useQuery<JournalEntry[]>({
    queryKey: ['wellness', 'journal'],
    queryFn: () => wellnessService.getJournalEntries(50, 0),
  });

  const renderItem = useCallback(({ item }: { item: JournalEntry }) => (
    <Pressable
      onPress={() => navigation.navigate('JournalEntry', { id: item.id })}
      accessibilityRole="button"
      accessibilityLabel={`Journal: ${item.title ?? 'untitled'}`}
    >
      <Card elevated style={{ marginBottom: theme.spacing.md }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Txt variant="h3">{item.title ?? 'Untitled'}</Txt>
            <Txt variant="bodySmall" color="secondary" style={{ marginTop: 4 }} numberOfLines={2}>
              {item.content}
            </Txt>
          </View>
          {item.sentiment_label && (
            <View style={[styles.sentiment, { backgroundColor: sentimentColor(item.sentiment_label), borderRadius: theme.radius.pill }]}>
              <Txt variant="caption" color="primary">{item.sentiment_label}</Txt>
            </View>
          )}
        </View>
        <View style={styles.footer}>
          <Txt variant="caption" color="muted">
            {new Date(item.created_at).toLocaleDateString()}
          </Txt>
          {item.mood && (
            <View style={[styles.moodTag, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.sm }]}>
              <Txt variant="caption" color="primary">{item.mood}</Txt>
            </View>
          )}
        </View>
      </Card>
    </Pressable>
  ), [navigation, theme]);

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
        data={entries ?? []}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: theme.spacing.lg }}
        refreshing={isLoading}
        onRefresh={refetch}
        ListHeaderComponent={
          <View style={{ marginBottom: theme.spacing.lg }}>
            <Txt variant="h1">Journal</Txt>
            <Txt variant="body" color="secondary">Your personal thoughts and reflections.</Txt>
          </View>
        }
        ListEmptyComponent={
          <Card>
            <Txt variant="body" color="secondary" align="center">
              {isError ? 'Failed to load entries. Pull to retry.' : 'No journal entries yet. Start writing!'}
            </Txt>
          </Card>
        }
      />
      <View style={styles.fab}>
        <Button
          label="+ New Entry"
          onPress={() => navigation.navigate('JournalEntry', { id: 'new' })}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  sentiment: { paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  moodTag: { paddingHorizontal: 8, paddingVertical: 2 },
  fab: { padding: 16 },
});
