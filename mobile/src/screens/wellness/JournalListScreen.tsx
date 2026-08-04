import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View, Pressable, ActivityIndicator, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';

import { Button, Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useJournalEntries } from 'src/services/queries/wellness';
import { useNetworkStatus } from 'src/services/sync';
import type { JournalEntry } from 'src/services/api/wellness';

type Nav = any;

function sentimentMeta(label: string | null): { color: string; bg: string } {
  switch (label) {
    case 'positive': return { color: '#16A34A', bg: '#D1FAE5' };
    case 'negative': return { color: '#DC2626', bg: '#FEE2E2' };
    default: return { color: '#B45309', bg: '#FEF3C7' };
  }
}

function moodEmoji(mood: string | null): string {
  if (!mood) return '💬';
  const map: Record<string, string> = {
    happy: '😄', calm: '😊', tired: '😴', anxious: '😟', sad: '😢', radiant: '✨',
    Happy: '😄', Calm: '😊', Tired: '😴', Anxious: '😟', Sad: '😢', Radiant: '✨',
  };
  return map[mood] ?? '💬';
}

const JournalItem = React.memo(function JournalItemComponent({ item, onPress, theme }: { item: JournalEntry; onPress: () => void; theme: any }) {
  const sentiment = sentimentMeta(item.sentiment_label);
  const emoji = moodEmoji(item.mood);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Journal: ${item.title ?? 'untitled'}`}
    >
      <Card elevated style={styles.itemCard}>
        <LinearGradient
          colors={['#FF6B8A', '#D4507A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.itemAccent}
        />
        <View style={styles.itemBody}>
          <View style={styles.itemTopRow}>
            <View style={[styles.itemEmojiWrap, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.pill }]}>
              <Txt style={styles.itemEmoji}>{emoji}</Txt>
            </View>
            <View style={styles.itemTextWrap}>
              <Txt variant="h3" numberOfLines={1} style={styles.itemTitle}>
                {item.title ?? 'Untitled'}
              </Txt>
              <Txt variant="bodySmall" color="secondary" numberOfLines={2} style={styles.itemPreview}>
                {item.content}
              </Txt>
            </View>
          </View>
          <View style={styles.itemFooter}>
            <Txt variant="caption" color="muted">
              {new Date(item.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </Txt>
            {item.sentiment_label && (
              <View style={[styles.sentimentPill, { backgroundColor: sentiment.bg }]}>
                <Txt variant="caption" style={styles.sentimentLabel}>{item.sentiment_label}</Txt>
              </View>
            )}
            <Txt variant="caption" color="muted" style={styles.chevron}>›</Txt>
          </View>
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

  const { data: entries, isLoading, isError, refetch } = useJournalEntries({ page: 0, per_page: 50 });
  const { isConnected } = useNetworkStatus();

  const handleEntryPress = useCallback((id: string) => {
    navigation.navigate('JournalEntry', { id });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: JournalEntry }) => (
    <JournalItem item={item} onPress={() => handleEntryPress(item.id)} theme={theme} />
  ), [handleEntryPress, theme]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, styles.loadingCenter, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const emptyMessage = !isConnected
    ? "You're offline. Saved entries will appear here once synced."
    : isError
      ? 'Failed to load entries. Pull to retry.'
      : 'No journal entries yet. Start writing!';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <LinearGradient
        colors={[theme.colors.accentLight + '59', 'transparent']}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[styles.flex, { paddingBottom: tabBarHeight }]}>
        <FlatList
          data={entries ?? []}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          style={styles.flex}
          refreshing={isLoading}
          onRefresh={refetch}
          windowSize={10}
          maxToRenderPerBatch={10}
          removeClippedSubviews={true}
          initialNumToRender={7}
          ListHeaderComponent={
            <View style={styles.header}>
              <Txt variant="h1" style={styles.headerTitle}>Journal</Txt>
              <LinearGradient
                colors={['#FF6B8A', '#D4507A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.headerAccent}
              />
              <Txt variant="body" color="secondary" style={styles.headerSubtitle}>
                Your personal thoughts and reflections.
              </Txt>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyArt, { backgroundColor: theme.colors.primaryMuted }]}>
                <Txt style={styles.emptyArtEmoji}>📓</Txt>
              </View>
              <Txt variant="h3" align="center" style={styles.emptyTitle}>
                {isError ? 'Couldn\u2019t load entries' : isConnected ? 'Your journal awaits' : 'You\u2019re offline'}
              </Txt>
              <Txt variant="body" color="secondary" align="center">
                {emptyMessage}
              </Txt>
              {!isError && isConnected && (
                <Button
                  label="Write your first entry"
                  onPress={() => setShowNewEntrySheet(true)}
                  style={styles.emptyCta}
                />
              )}
            </View>
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
              <Txt variant="h3" style={styles.sheetTitle}>New Entry</Txt>
              <Pressable
                style={[styles.sheetOption, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }]}
                onPress={() => { setShowNewEntrySheet(false); navigation.navigate('JournalEntry', { id: 'new' }); }}
              >
                <Txt variant="body" style={styles.sheetOptionSerif}>✍️  Journal Entry</Txt>
                <Txt variant="caption" color="secondary">Write a personal reflection</Txt>
              </Pressable>
              <Pressable
                style={[styles.sheetOption, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }]}
                onPress={() => { setShowNewEntrySheet(false); navigation.navigate('DiaryLibrary', {}); }}
              >
                <Txt variant="body" style={styles.sheetOptionSerif}>📖  Memory Diary</Txt>
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
  flex: { flex: 1 },
  loadingCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 24,
    paddingBottom: 8,
  },
  header: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
  },
  headerAccent: {
    width: 48,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
  },
  headerSubtitle: {
    marginTop: 10,
  },
  itemCard: {
    marginBottom: 14,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  itemAccent: {
    width: 6,
  },
  itemBody: {
    flex: 1,
    paddingVertical: 2,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemEmojiWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEmoji: { fontSize: 20 },
  itemTextWrap: { flex: 1 },
  itemTitle: {
    fontSize: 17,
  },
  itemPreview: {
    marginTop: 2,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  sentimentPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  sentimentLabel: { fontWeight: '600' },
  chevron: {
    marginLeft: 'auto',
    fontSize: 20,
    fontWeight: '600',
  },
  emptyCard: {
    padding: 28,
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 32,
    textAlign: 'center',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 12,
    gap: 12,
  },
  emptyArt: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyArtEmoji: {
    fontSize: 34,
  },
  emptyTitle: {
    marginTop: 4,
  },
  emptyCta: {
    marginTop: 8,
    minWidth: 220,
  },
  fab: { padding: 16 },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 12 },
  sheetTitle: { marginBottom: 4 },
  sheetOption: { padding: 16, gap: 4 },
  sheetOptionSerif: { fontFamily: 'Playfair Display', fontSize: 16 },
  sheetCancel: { alignItems: 'center', padding: 12, marginTop: 4 },
});
