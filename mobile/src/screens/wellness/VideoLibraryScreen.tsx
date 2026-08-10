/**
 * VideoLibraryScreen — public health content library (videos + images + articles).
 *
 * Fetches approved educational content from the backend and renders a
 * FlatList of video thumbnails and image galleries. Uses React Query
 * for caching (rule 2.2) and FlatList for performance (rule 2.7).
 */

import React from 'react';
import { FlatList, Image, StyleSheet, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Text as Txt, Card, EmptyState, Loader } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { nurseContentService, NurseContent } from 'src/services/api/nurse_content';

const CATEGORIES = ['all', 'wellness', 'nutrition', 'pregnancy', 'safety'] as const;

export function VideoLibraryScreen() {
  const theme = useTheme();
  const [activeCategory, setActiveCategory] = React.useState('all');

  const {
    data: contents,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['nurse-contents'],
    queryFn: () => nurseContentService.getContents({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const filtered = React.useMemo(() => {
    if (!contents) return [];
    if (activeCategory === 'all') return contents;
    return contents.filter((c) => c.category === activeCategory);
  }, [contents, activeCategory]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <Loader />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <EmptyState
          title="Couldn't load content"
          message="Check your connection and try again."
          actionLabel="Retry"
          onAction={refetch}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Txt variant="h1" style={styles.title}>Health Library</Txt>
        <Txt variant="body" color="secondary" style={styles.subtitle}>
          Videos, images, and articles from our health experts.
        </Txt>
      </View>

      <View style={styles.categoryRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => setActiveCategory(cat)}
            style={[
              styles.categoryChip,
              activeCategory === cat && { backgroundColor: theme.colors.primary },
            ]}
            accessibilityRole="button"
            accessibilityLabel={'Filter by ' + cat}
          >
            <Txt
              variant="caption"
              style={[
                styles.categoryLabel,
                activeCategory === cat && { color: theme.colors.textInverse },
              ]}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Txt>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <EmptyState title="No content yet" message="Check back soon for new health content." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ContentCard content={item} theme={theme} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function ContentCard({ content, theme }: { content: NurseContent; theme: any }) {
  const isVideo = content.content_type === 'video';
  const isImage = content.content_type === 'image';
  const thumbnail = content.thumbnail_url || (content.images && content.images[0]?.url) || null;

  return (
    <Card style={styles.card} padded onPress={() => {}}>
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbnail, styles.placeholder, { backgroundColor: theme.colors.border }]}>
          <Txt variant="caption" color="muted">
            {isVideo ? 'Video' : isImage ? 'Image' : 'Article'}
          </Txt>
        </View>
      )}
      <View style={styles.cardBody}>
        <Txt variant="h3" style={styles.cardTitle}>{content.title}</Txt>
        {content.summary ? (
          <Txt variant="bodySmall" color="secondary" style={styles.cardSummary}>
            {content.summary}
          </Txt>
        ) : null}
        <View style={styles.cardFooter}>
          <Txt variant="caption" color="muted">{content.category}</Txt>
          {content.reading_time_minutes ? (
            <Txt variant="caption" color="muted">{content.reading_time_minutes} min read</Txt>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { padding: 24, paddingBottom: 12 },
  title: { marginBottom: 4 },
  subtitle: { marginTop: 4, opacity: 0.7 },
  categoryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 16 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
  },
  categoryLabel: { fontWeight: '600' },
  list: { paddingHorizontal: 24, gap: 16 },
  card: { marginBottom: 16 },
  thumbnail: { width: '100%', height: 160, borderRadius: 12 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { marginTop: 12 },
  cardTitle: { marginBottom: 4, fontSize: 18 },
  cardSummary: { marginTop: 4, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
});