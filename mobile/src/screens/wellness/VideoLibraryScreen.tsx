/**
 * VideoLibraryScreen — Smart Health Library (DayDetailSheet → VideoLibrary plan).
 *
 * General health content library (videos + images + articles) with an optional
 * "For You" mode: when enabled, content is prioritized by the user's recently
 * logged symptoms (last-7-days `cycle_days` from local SQLite, offline-first),
 * scored client-side by the pure `videoRecommendations` engine.
 *
 * "No Data, No Issue" (plan §7.4): no symptoms logged → friendly info banner +
 * full general library, never an empty state. The global master switch
 * (Settings → Smart recommendations) hides the For You toggle entirely.
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  TouchableOpacity,
  Pressable,
  AppState,
  ScrollView,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { focusManager } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Sparkles, ClipboardList } from 'lucide-react-native';

import { Text as Txt, Card, EmptyState, HorizontalCardCarousel } from 'src/components/ui';
import { useTheme } from 'src/theme';
import type { Theme } from 'src/theme';
import type { NurseContent } from 'src/services/api/nurse_content';
import { useVideoRecommendations } from 'src/hooks/useVideoRecommendations';
import { useVideoLibrarySettings } from 'src/hooks/useVideoLibrarySettings';
import { ICON_BY_SYMPTOM } from 'src/utils/expertRecommendations';
import { navigate } from 'src/navigation/rootNavigation';
import type { WellnessStackParamList } from 'src/navigation/types';

const CATEGORIES = ['all', 'wellness', 'pregnancy', 'cycle', 'nutrition', 'mental_health'] as const;
const CAROUSEL_CARD_WIDTH = 280;

// getItemLayout intentionally skipped: ContentCard heights vary (160px thumbnail
// + variable body), so a fixed itemSize would corrupt scroll positions.

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
  const [activeCategory, setActiveCategory] = useState('all');
  const [forYou, setForYou] = useState(false);

  const { smartRecommendationsEnabled } = useVideoLibrarySettings();
  const {
    all,
    recommended,
    general,
    matchedSymptoms,
    hasData,
    isLoading,
    isError,
    refetch,
  } = useVideoRecommendations(forYou ? 'all' : activeCategory);

  const effectiveGeneral = useMemo(() => (forYou ? general : all), [forYou, general, all]);

  // Stable navigation handler — same reference for memoized ContentCard items,
  // the RecommendedSection, and the FlatList renderItem.
  const handleOpenContent = useCallback(
    (id: string) => navigation.navigate('ContentDetail', { id }),
    [navigation],
  );

  const chooseCategory = useCallback((cat: (typeof CATEGORIES)[number]) => {
    setActiveCategory(cat);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: NurseContent }) => (
      <ContentCard content={item} theme={theme} onPress={handleOpenContent} />
    ),
    [theme, handleOpenContent],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <LibraryHeader
          forYou={smartRecommendationsEnabled && forYou}
          onToggle={smartRecommendationsEnabled ? setForYou : undefined}
          theme={theme}
        />
        {smartRecommendationsEnabled && forYou ? (
          <View style={styles.forYouLoadingLabel}>
            <Txt variant="caption" color="muted">Preparing your picks…</Txt>
          </View>
        ) : null}
        <SkeletonRows theme={theme} />
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
      <LibraryHeader
        forYou={smartRecommendationsEnabled && forYou}
        onToggle={smartRecommendationsEnabled ? setForYou : undefined}
        theme={theme}
      />

      {forYou && !hasData ? (
        <NoSymptomsBanner theme={theme} onLogToday={() => navigate('Main', { screen: 'Calendar' })} />
      ) : null}

      {forYou && hasData && recommended.length > 0 ? (
        <RecommendedSection
          theme={theme}
          contents={recommended}
          matchedSymptoms={matchedSymptoms}
          onPress={handleOpenContent}
        />
      ) : null}

      {forYou && hasData && matchedSymptoms.length > 0 ? (
        <View style={styles.sectionTitleRow}>
          <Txt variant="h2" style={styles.sectionTitle}>Browse all videos</Txt>
        </View>
      ) : null}

      {!forYou ? (
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => chooseCategory(cat)}
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
      ) : null}

      {effectiveGeneral && effectiveGeneral.length === 0 && !forYou ? (
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
          data={effectiveGeneral ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          initialNumToRender={7}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            forYou && !hasData && (all ?? []).length > 0 ? <Txt variant="bodySmall" color="secondary" style={styles.browseAllNote}>Browse the full library below.</Txt> : null
          }
        />
      )}
      {forYou && (all ?? []).length === 0 && !isLoading ? (
        <EmptyState
          title="No content yet"
          message="Check back soon for new health content."
        />
      ) : null}
    </SafeAreaView>
  );
}

function LibraryHeader({
  forYou,
  onToggle,
  theme,
}: {
  forYou: boolean;
  onToggle?: (v: boolean) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.header}>
      <Txt variant="h1" style={styles.title}>Health Library</Txt>
      <View style={styles.headerRow}>
        <Txt variant="body" color="secondary" style={styles.subtitle}>
          Videos, images, and articles from our health experts.
        </Txt>
        {onToggle ? (
          <Pressable
            onPress={() => onToggle(!forYou)}
            style={[
              styles.forYouPill,
              forYou && { backgroundColor: theme.colors.primaryDeep },
            ]}
            accessibilityRole="switch"
            accessibilityState={{ checked: forYou }}
            accessibilityLabel={forYou ? 'For You on — showing personalized videos' : 'Turn on For You to see personalized videos'}
          >
            <Sparkles size={14} color={forYou ? theme.colors.textInverse : theme.colors.primaryDeep} accessible={false} />
            <Txt
              variant="caption"
              style={[styles.forYouLabel, forYou && { color: theme.colors.textInverse }]}
            >
              {forYou ? 'For You ✓' : 'For You'}
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const RecommendedSection = memo(function RecommendedSection({
  theme,
  contents,
  matchedSymptoms,
  onPress,
}: {
  theme: Theme;
  contents: NurseContent[];
  matchedSymptoms: string[];
  onPress: (id: string) => void;
}) {
  // Stable per-chunk callback so RecommendedCard receives a consistent
  // onPress reference across re-renders of the section.
  const handleCardPress = useCallback((id: string) => onPress(id), [onPress]);

  return (
    <View>
      <View style={styles.sectionTitleRow}>
        <Txt variant="h2" style={styles.sectionTitle}>Based on your recent symptoms</Txt>
      </View>
      {matchedSymptoms.length > 0 ? (
        <View style={styles.symptomChipRow}>
          {matchedSymptoms.slice(0, 4).map((s) => (
            <View key={s} style={[styles.symptomChip, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.chip }]}>
              <Txt variant="chip" style={{ color: theme.colors.primaryDeep }}>
                {ICON_BY_SYMPTOM[s] ? `${ICON_BY_SYMPTOM[s]} ` : ''}{s}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
      <HorizontalCardCarousel cardWidth={CAROUSEL_CARD_WIDTH} accessibilityLabel="Recommended videos">
        {contents.map((item) => (
          <RecommendedCard key={item.id} content={item} theme={theme} onPress={handleCardPress} />
        ))}
      </HorizontalCardCarousel>
    </View>
  );
});

const RecommendedCard = memo(function RecommendedCard({
  content,
  theme,
  onPress,
}: {
  content: NurseContent;
  theme: Theme;
  onPress: (id: string) => void;
}) {
  const isVideo = content.content_type === 'video';
  const thumbnail = content.thumbnail_url || (content.images && content.images[0]?.url) || null;

  return (
    <Card
      style={[styles.recoCard, { borderRadius: theme.radius.cardLg, borderColor: theme.colors.borderSubtle }]}
      padded={false}
      onPress={() => onPress(content.id)}
    >
      {thumbnail ? (
        <ExpoImage
          source={{ uri: thumbnail }}
          style={styles.recoThumb}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.recoThumb, styles.placeholder, { backgroundColor: theme.colors.border }]}>
          <Txt variant="caption" color="muted">{isVideo ? 'Video' : 'Article'}</Txt>
        </View>
      )}
      <View style={styles.recoBody}>
        <Txt variant="h3" style={styles.recoTitle} numberOfLines={2}>{content.title}</Txt>
        <View style={styles.recoFooter}>
          <Txt variant="caption" color="muted">{content.category.replace('_', ' ')}</Txt>
          {isVideo && content.video_duration_seconds ? (
            <Txt variant="caption" color="muted">{Math.round(content.video_duration_seconds / 60)} min</Txt>
          ) : null}
        </View>
      </View>
    </Card>
  );
});

function NoSymptomsBanner({
  theme,
  onLogToday,
}: {
  theme: ReturnType<typeof useTheme>;
  onLogToday: () => void;
}) {
  return (
    <View style={[styles.noSymptomsBanner, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.lg }]}>
      <View style={styles.noSymptomsRow}>
        <ClipboardList size={18} color={theme.colors.primaryDeep} accessible={false} />
        <Txt variant="bodySmall" color="secondary" style={styles.noSymptomsText}>
          No recent symptoms logged. Explore our full library.
        </Txt>
      </View>
      <Pressable
        onPress={onLogToday}
        style={[styles.logTodayBtn, { backgroundColor: theme.colors.primaryDeep, borderRadius: theme.radius.md }]}
        accessibilityRole="button"
        accessibilityLabel="Log today's symptoms"
      >
        <Txt variant="chip" style={{ color: theme.colors.textInverse }}>📝 Log Today's Symptoms</Txt>
      </Pressable>
    </View>
  );
}

const ContentCard = memo(function ContentCard({
  content,
  theme,
  onPress,
}: {
  content: NurseContent;
  theme: Theme;
  onPress: (id: string) => void;
}) {
  const isVideo = content.content_type === 'video';
  const isImage = content.content_type === 'image';
  const thumbnail = content.thumbnail_url || (content.images && content.images[0]?.url) || null;

  return (
    <Card style={styles.card} padded onPress={() => onPress(content.id)}>
      {thumbnail ? (
        <ExpoImage
          source={{ uri: thumbnail }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
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
});

function SkeletonRows({ theme }: { theme: Theme }) {
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.skeletonCard, { backgroundColor: theme.colors.border }]}>
          <View style={[styles.skeletonThumb, { backgroundColor: theme.colors.surface }]} />
          <View style={styles.skeletonBody}>
            <View style={[styles.skeletonLine, { width: '70%', backgroundColor: theme.colors.surface }]} />
            <View style={[styles.skeletonLine, { width: '40%', backgroundColor: theme.colors.surface }]} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { padding: 24, paddingBottom: 12 },
  title: { marginBottom: 4 },
  subtitle: { marginTop: 4, opacity: 0.7, flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  forYouLoadingLabel: { paddingHorizontal: 24, paddingTop: 4, marginBottom: 8 },
  forYouPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFB3C6',
    backgroundColor: 'transparent',
    minHeight: 44,
  },
  forYouLabel: { fontWeight: '700' },
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
  sectionTitleRow: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  sectionTitle: { fontWeight: '700' },
  symptomChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 24, paddingBottom: 4 },
  symptomChip: { paddingHorizontal: 10, paddingVertical: 4 },
  recoCard: { width: CAROUSEL_CARD_WIDTH, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  recoThumb: { width: '100%', height: 140 },
  recoBody: { padding: 12, gap: 6 },
  recoTitle: { fontSize: 16 },
  recoFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  noSymptomsBanner: { marginHorizontal: 24, padding: 16, gap: 12, marginBottom: 12 },
  noSymptomsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noSymptomsText: { flex: 1 },
  logTodayBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 44,
  },
  browseAllNote: { textAlign: 'center', marginTop: 4 },
});