/**
 * VideoLibraryScreen — public health content library (videos + images + articles).
 *
 * Fetches approved educational content from the backend and renders a
 * FlatList of video thumbnails and image galleries. Uses React Query
 * for caching (rule 2.2) and FlatList for performance (rule 2.7).
 */

import React from 'react';
import { FlatList, Image, StyleSheet, View, TouchableOpacity, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, focusManager } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text as Txt, Card, EmptyState, Loader } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { nurseContentService, type NurseContent } from 'src/services/api/nurse_content';
import type { WellnessStackParamList } from 'src/navigation/types';

const CATEGORIES = ['all', 'wellness', 'pregnancy', 'cycle', 'nutrition', 'mental_health'] as const;

focusManager.setEventListener((handleFocus) => {
  const onFocus = () => handleFocus(true);
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') onFocus();
  });
  return () => sub.remove();
});

export function VideoLibraryScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<WellnessStackParamList>>();
  const [activeCategory, setActiveCategory] = React.useState('all');

  const {
    data: contents,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery<NurseContent[]>({
    queryKey: ['nurse-contents', activeCategory],
    queryFn: () =>
      nurseContentService.getContents({
        limit: 100,
        category: activeCategory === 'all' ? undefined : activeCategory,
      }),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
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
            <View
              key={cat}
              style={[styles.categoryChip, activeCategory === cat && { backgroundColor: theme.colors.primary }]}
            >
              <Txt variant="caption" style={[styles.categoryLabel, activeCategory === cat && { color: theme.colors.textInverse }]}>
                {cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
              </Txt>
            </View>
          ))}
        </View>
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.skeletonCard, { backgroundColor: theme.colors.border }]}>
            <View style={[styles.skeletonThumb, { backgroundColor: theme.colors.surface }]} />
            <View style={styles.skeletonBody}>
              <View style={[styles.skeletonLine, { width: '70%', backgroundColor: theme.colors.surface }]} />
              <View style={[styles.skeletonLine, { width: '40%', backgroundColor: theme.colors.surface }]} />
            </View>
          </View>
        ))}
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
              {cat.charAt(0).toUpperCase() + cat.slice(1).replace('_', ' ')}
            </Txt>
          </TouchableOpacity>
        ))}
      </View>

      {contents && contents.length === 0 && !isFetching ? (
        <EmptyState
          title="No content yet"
          message={
            activeCategory === 'all'
              ? 'Check back soon for new health content.'
              : `No ${activeCategory.replace('_', ' ')} content yet.`
          }
        />
      ) : (
        <FlatList
          data={contents ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ContentCard
              content={item}
              theme={theme}
              onPress={() => navigation.navigate('ContentDetail', { id: item.id })}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={isFetching && contents && contents.length > 0 ? <Loader /> : null}
        />
      )}
    </SafeAreaView>
  );
}

function ContentCard({ content, theme, onPress }: { content: NurseContent; theme: any; onPress: () => void }) {
  const isVideo = content.content_type === 'video';
  const isImage = content.content_type === 'image';
  const thumbnail = content.thumbnail_url || (content.images && content.images[0]?.url) || null;

  return (
    <Card style={styles.card} padded onPress={onPress}>
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
        {content.description ? (
          <Txt variant="bodySmall" color="secondary" style={styles.cardSummary} numberOfLines={2}>
            {content.description}
          </Txt>
        ) : null}
        <View style={styles.cardFooter}>
          <Txt variant="caption" color="muted">{content.category.replace('_', ' ')}</Txt>
          {isVideo && content.video_duration_seconds ? (
            <Txt variant="caption" color="muted">{Math.round(content.video_duration_seconds / 60)} min</Txt>
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
  categoryRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, marginBottom: 16, flexWrap: 'wrap' },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
  },
  categoryLabel: { fontWeight: '600' },
  list: { paddingHorizontal: 24, paddingBottom: 24 },
  card: { marginBottom: 16 },
  thumbnail: { width: '100%', height: 160, borderRadius: 12 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { marginTop: 12 },
  cardTitle: { marginBottom: 4, fontSize: 18 },
  cardSummary: { marginTop: 4, marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  skeletonCard: { marginHorizontal: 24, marginBottom: 16, borderRadius: 12, overflow: 'hidden' },
  skeletonThumb: { width: '100%', height: 160 },
  skeletonBody: { padding: 12, gap: 8 },
  skeletonLine: { height: 14, borderRadius: 4 },
});
