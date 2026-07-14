import React, { useState, useCallback } from 'react';
import { FlatList, StyleSheet, View, Pressable, TextInput, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Text } from 'src/components/ui';
import { useTheme } from 'src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_W = (SCREEN_WIDTH - 48 - CARD_GAP) / 2;

interface VideoItem {
  id: string;
  title: string;
  channel: string;
  views: string;
  duration: string;
  category: string;
  thumbnailColor: string;
  availableOffline?: boolean;
  progress?: number;
}

const CATEGORIES = ['All', 'Yoga', 'Nutrition', 'PCOS', 'Mental Health', 'Exercise', 'Sleep', 'Pregnancy'];

const VIDEOS: VideoItem[] = [
  { id: 'v1', title: 'Yoga for Period Cramps Relief', channel: 'Wellness with SheCare', views: '12K views', duration: '12:34', category: 'Yoga', thumbnailColor: '#FFD5B8', availableOffline: true, progress: 0.4 },
  { id: 'v2', title: 'Nutrition Tips for PCOS', channel: 'Health Experts', views: '8.2K views', duration: '15:20', category: 'Nutrition', thumbnailColor: '#C8E6C9', progress: 0.6 },
  { id: 'v3', title: 'Understanding Your Cycle', channel: 'SheCare Education', views: '24K views', duration: '8:15', category: 'Mental Health', thumbnailColor: '#BBDEFB', progress: 0.2 },
  { id: 'v4', title: 'Morning Yoga Routine', channel: 'Wellness with SheCare', views: '5.1K views', duration: '20:00', category: 'Yoga', thumbnailColor: '#FFD5B8', availableOffline: true },
  { id: 'v5', title: 'PCOS Diet Plan', channel: 'Health Experts', views: '15K views', duration: '10:45', category: 'PCOS', thumbnailColor: '#C8E6C9', availableOffline: true },
  { id: 'v6', title: 'Meditation for Anxiety', channel: 'Mindful Living', views: '18K views', duration: '25:00', category: 'Mental Health', thumbnailColor: '#E1BEE7' },
  { id: 'v7', title: 'Exercise During Period', channel: 'Fitness for Women', views: '9.8K views', duration: '14:30', category: 'Exercise', thumbnailColor: '#FFF9C4' },
  { id: 'v8', title: 'Sleep Hygiene Tips', channel: 'Wellness with SheCare', views: '7.5K views', duration: '6:20', category: 'Sleep', thumbnailColor: '#BBDEFB' },
  { id: 'v9', title: 'Healthy Pregnancy Meals', channel: 'Health Experts', views: '22K views', duration: '18:00', category: 'Pregnancy', thumbnailColor: '#F8BBD0' },
];

const CONTINUE_WATCHING: VideoItem[] = VIDEOS.filter(v => v.progress != null && v.progress > 0);

function VideoCard({ item }: { item: VideoItem }) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.96); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${item.duration}${!item.availableOffline ? ', online only' : ''}`}
        style={{ width: CARD_W, marginBottom: CARD_GAP, opacity: item.availableOffline !== false ? 1 : 0.5 }}
      >
        <View style={[styles.thumbnail, { backgroundColor: item.thumbnailColor, borderRadius: theme.radius.lg }]}>
          {item.availableOffline === false && (
            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill={theme.colors.textMuted} opacity="0.7" />
              <Path d="M8 12h8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </Svg>
          )}
          {item.availableOffline !== false && (
            <Svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <Path d="M8 5v14l11-7z" fill={theme.colors.primary} opacity="0.8" />
            </Svg>
          )}
          <View style={[styles.durationBadge, { backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: theme.radius.sm }]}>
            <Text variant="caption" style={{ color: '#fff', fontSize: 10 }}>{item.duration}</Text>
          </View>
          {item.progress != null && item.progress > 0 && (
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${item.progress * 100}%`, backgroundColor: theme.colors.primary }]} />
            </View>
          )}
        </View>
        <Text variant="bodySmall" style={{ marginTop: 6, fontWeight: '600' }} numberOfLines={2}>{item.title}</Text>
        <Text variant="caption" color="muted" style={{ marginTop: 2 }}>{item.channel}</Text>
        <Text variant="caption" color="muted">{item.views}{item.availableOffline === false ? ' · Online only' : ''}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function VideoLibraryScreen() {
  const theme = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showContinue, setShowContinue] = useState(true);
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleSubmitSearch = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== trimmed);
      return [trimmed, ...filtered].slice(0, 5);
    });
  }, [searchQuery]);

  const handleRecentTap = useCallback((term: string) => {
    setSearchQuery(term);
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== term);
      return [term, ...filtered].slice(0, 5);
    });
  }, []);

  const filtered = VIDEOS.filter(v => {
    const matchCategory = selectedCategory === 'All' || v.category === selectedCategory;
    const matchSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#FFF8FB' }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text variant="h1">Videos</Text>
          <Text variant="body" color="secondary">Learn & grow with expert content</Text>
        </View>

        <View style={[styles.searchBar, { backgroundColor: theme.colors.surface, borderColor: isFocused ? '#FFB6C1' : theme.colors.border, borderWidth: isFocused ? 2 : StyleSheet.hairlineWidth, borderRadius: theme.radius.pill }]}>
          <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke={theme.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <TextInput
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Search videos..."
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel="Search videos"
            returnKeyType="search"
            onSubmitEditing={handleSubmitSearch}
            style={[styles.searchInput, { color: theme.colors.textPrimary }]}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => { setSearchQuery(''); }} accessibilityLabel="Clear search">
              <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke={theme.colors.textMuted} strokeWidth="2" strokeLinecap="round" />
              </Svg>
            </Pressable>
          )}
        </View>

        {isFocused && recentSearches.length > 0 && searchQuery.length === 0 && (
          <View style={[styles.recentContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md }]}>
            <Text variant="caption" color="muted" style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>Recent Searches</Text>
            {recentSearches.map((term) => (
              <Pressable key={term} onPress={() => handleRecentTap(term)} style={styles.recentRow} accessibilityLabel={`Search for ${term}`}>
                <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" stroke={theme.colors.textMuted} strokeWidth="1.5" />
                  <Path d="M12 6v6l4 2" stroke={theme.colors.textMuted} strokeWidth="1.5" strokeLinecap="round" />
                </Svg>
                <Text variant="body" style={{ marginLeft: 8, flex: 1 }}>{term}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={c => c}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 8, paddingVertical: 12 }}
          renderItem={({ item }) => {
            const active = item === selectedCategory;
            return (
              <Pressable
                onPress={() => setSelectedCategory(item)}
                style={[
                  styles.categoryChip,
                  { backgroundColor: active ? theme.colors.primary : theme.colors.surface, borderColor: active ? theme.colors.primary : theme.colors.border, borderRadius: theme.radius.pill },
                ]}
              >
                <Text variant="bodySmall" style={{ color: active ? '#fff' : theme.colors.textPrimary }}>{item}</Text>
              </Pressable>
            );
          }}
        />

        <FlatList
          data={filtered}
          keyExtractor={v => v.id}
          numColumns={2}
          columnWrapperStyle={{ gap: CARD_GAP, paddingHorizontal: 24 }}
          contentContainerStyle={{ paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <VideoCard item={item} />}
          ListHeaderComponent={
            showContinue && CONTINUE_WATCHING.length > 0 ? (
              <View style={[styles.continueBanner, { backgroundColor: '#FFF5E6', borderRadius: theme.radius.lg, borderColor: '#FFE0B2', marginHorizontal: 24, marginBottom: 16 }]}>
                <View style={styles.continueHeader}>
                  <Text variant="h3" style={{ color: '#E65100' }}>Continue Watching</Text>
                  <Pressable onPress={() => setShowContinue(false)} accessibilityLabel="Dismiss continue watching" accessibilityRole="button">
                    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <Path d="M18 6L6 18M6 6l12 12" stroke="#E65100" strokeWidth="2" strokeLinecap="round" />
                    </Svg>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                  {CONTINUE_WATCHING.map((v) => (
                    <Pressable key={v.id} style={[styles.continueCard, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md }]}>
                      <View style={[styles.continueThumb, { backgroundColor: v.thumbnailColor, borderRadius: theme.radius.sm }]}>
                        <View style={[styles.continueProgress, { width: `${(v.progress ?? 0) * 100}%`, backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm }]} />
                      </View>
                      <Text variant="caption" style={{ marginTop: 6, fontWeight: '600' }} numberOfLines={1}>{v.title}</Text>
                      <Text variant="caption" color="muted">{v.channel}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text variant="body" color="muted" align="center">No videos found</Text>
              <Text variant="caption" color="muted" align="center" style={{ marginTop: 4 }}>Try a different category or search term</Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24, paddingHorizontal: 16, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, marginTop: 12 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1 },
  thumbnail: { width: '100%', aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center' },
  durationBadge: { position: 'absolute', bottom: 6, right: 6, paddingHorizontal: 6, paddingVertical: 2 },
  progressBarBg: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(0,0,0,0.1)' },
  progressBarFill: { height: '100%' },
  continueBanner: { padding: 16, borderWidth: 1 },
  continueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  continueCard: { width: 140, marginRight: 12, padding: 8 },
  continueThumb: { width: '100%', height: 72, borderRadius: 8, overflow: 'hidden' },
  continueProgress: { position: 'absolute', bottom: 0, left: 0, height: 3 },
  empty: { paddingVertical: 60, paddingHorizontal: 24 },
  recentContainer: { marginHorizontal: 24, marginTop: 4, borderWidth: StyleSheet.hairlineWidth, paddingBottom: 4 },
  recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },
});
