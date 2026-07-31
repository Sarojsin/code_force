import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View, Pressable, ActivityIndicator, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
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

const JournalItem = React.memo(function JournalItem({ item, onPress, theme }: { item: JournalEntry; onPress: () => void; theme: any }) {
  return (
    <Pressable
      onPress={onPress}
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
  );
});

export function JournalListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [showNewEntrySheet, setShowNewEntrySheet] = useState(false);

  const tabBarHeight = useBottomTabBarHeight();

  const { data: entries, isLoading, isError, refetch } = useQuery<JournalEntry[]>({
    queryKey: ['wellness', 'journal'],
    queryFn: () => wellnessService.getJournalEntries(50, 0),
  });

  const handleEntryPress = useCallback((id: string) => {
    navigation.navigate('JournalEntry', { id });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: JournalEntry }) => (
    <JournalItem item={item} onPress={() => handleEntryPress(item.id)} theme={theme} />
  ), [handleEntryPress, theme]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={{ flex: 1, paddingBottom: tabBarHeight }}>
        <FlatList
          data={entries ?? []}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: theme.spacing.lg }}
          style={{ flex: 1 }}
          refreshing={isLoading}
          onRefresh={refetch}
          windowSize={10}
          maxToRenderPerBatch={10}
          removeClippedSubviews={true}
          initialNumToRender={7}
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
            onPress={() => setShowNewEntrySheet(true)}
            fullWidth
          />
        </View>

        <Modal visible={showNewEntrySheet} transparent animationType="slide" onRequestClose={() => setShowNewEntrySheet(false)}>
          <Pressable style={styles.sheetOverlay} onPress={() => setShowNewEntrySheet(false)}>
            <Pressable style={[styles.sheet, { backgroundColor: theme.colors.surface }]}>
              <Txt variant="h3" style={{ marginBottom: theme.spacing.md }}>New Entry</Txt>
              <Pressable
                style={[styles.sheetOption, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }]}
                onPress={() => { setShowNewEntrySheet(false); navigation.navigate('JournalEntry', { id: 'new' }); }}
              >
                <Txt variant="body" style={{ fontFamily: 'Literata_400Regular' }}>✍️  Journal Entry</Txt>
                <Txt variant="caption" color="secondary">Write a personal reflection</Txt>
              </Pressable>
              <Pressable
                style={[styles.sheetOption, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }]}
                onPress={() => { setShowNewEntrySheet(false); navigation.navigate('DiaryLibrary', {}); }}
              >
                <Txt variant="body" style={{ fontFamily: 'LibreCaslonText_600SemiBold' }}>📖  Memory Diary</Txt>
                <Txt variant="caption" color="secondary">Create a scrapbook page</Txt>
              </Pressable>
              <TouchableOpacity onPress={() => setShowNewEntrySheet(false)} style={[styles.sheetCancel, { borderRadius: theme.radius.pill }]}>
                <Txt variant="body" color="secondary">Cancel</Txt>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
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
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 12 },
  sheetOption: { padding: 16, gap: 4 },
  sheetCancel: { alignItems: 'center', padding: 12, marginTop: 4 },
});
