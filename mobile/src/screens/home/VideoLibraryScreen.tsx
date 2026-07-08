/**
 * VideoLibraryScreen — YouTube-inspired card UI per UI_UX Video_Section spec.
 * Categories, search, continue watching, recommended videos.
 */

import React, { useState } from 'react';
import { FlatList, StyleSheet, View, Pressable, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

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
}

const CATEGORIES = ['All', 'Yoga', 'Nutrition', 'PCOS', 'Mental Health', 'Exercise', 'Sleep', 'Pregnancy'];

const VIDEOS: VideoItem[] = [
  { id: 'v1', title: 'Yoga for Period Cramps Relief', channel: 'Wellness with SheCare', views: '12K views', duration: '12:34', category: 'Yoga', thumbnailColor: '#FFD5B8' },
  { id: 'v2', title: 'Nutrition Tips for PCOS', channel: 'Health Experts', views: '8.2K views', duration: '15:20', category: 'Nutrition', thumbnailColor: '#C8E6C9' },
  { id: 'v3', title: 'Understanding Your Cycle', channel: 'SheCare Education', views: '24K views', duration: '8:15', category: 'Mental Health', thumbnailColor: '#BBDEFB' },
  { id: 'v4', title: 'Morning Yoga Routine', channel: 'Wellness with SheCare', views: '5.1K views', duration: '20:00', category: 'Yoga', thumbnailColor: '#FFD5B8' },
  { id: 'v5', title: 'PCOS Diet Plan', channel: 'Health Experts', views: '15K views', duration: '10:45', category: 'PCOS', thumbnailColor: '#C8E6C9' },
  { id: 'v6', title: 'Meditation for Anxiety', channel: 'Mindful Living', views: '18K views', duration: '25:00', category: 'Mental Health', thumbnailColor: '#E1BEE7' },
  { id: 'v7', title: 'Exercise During Period', channel: 'Fitness for Women', views: '9.8K views', duration: '14:30', category: 'Exercise', thumbnailColor: '#FFF9C4' },
  { id: 'v8', title: 'Sleep Hygiene Tips', channel: 'Wellness with SheCare', views: '7.5K views', duration: '6:20', category: 'Sleep', thumbnailColor: '#BBDEFB' },
  { id: 'v9', title: 'Healthy Pregnancy Meals', channel: 'Health Experts', views: '22K views', duration: '18:00', category: 'Pregnancy', thumbnailColor: '#F8BBD0' },
];

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
        accessibilityLabel={`${item.title}, ${item.duration}`}
        style={{ width: CARD_W, marginBottom: CARD_GAP }}
      >
        {/* Thumbnail */}
        <View style={[styles.thumbnail, { backgroundColor: item.thumbnailColor, borderRadius: theme.radius.lg }]}>
          <Svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <Path d="M8 5v14l11-7z" fill={theme.colors.primary} opacity="0.8" />
          </Svg>
          <View style={[styles.durationBadge, { backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: theme.radius.sm }]}>
            <Text variant="caption" style={{ color: '#fff', fontSize: 10 }}>{item.duration}</Text>
          </View>
        </View>
        <Text variant="bodySmall" style={{ marginTop: 6, fontWeight: '600' }} numberOfLines={2}>{item.title}</Text>
        <Text variant="caption" color="muted" style={{ marginTop: 2 }}>{item.channel}</Text>
        <Text variant="caption" color="muted">{item.views}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function VideoLibraryScreen() {
  const theme = useTheme();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = VIDEOS.filter(v => {
    const matchCategory = selectedCategory === 'All' || v.category === selectedCategory;
    const matchSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#FFF8FB' }]}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="h1">Videos</Text>
          <Text variant="body" color="secondary">Learn & grow with expert content</Text>
        </View>

        {/* Search bar */}
        <View style={[styles.searchBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.pill }]}>
          <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke={theme.colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search videos..."
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel="Search videos"
            style={[styles.searchInput, { color: theme.colors.textPrimary }]}
          />
        </View>

        {/* Categories */}
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
                  {
                    backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                    borderColor: active ? theme.colors.primary : theme.colors.border,
                    borderRadius: theme.radius.pill,
                  },
                ]}
              >
                <Text variant="bodySmall" style={{ color: active ? '#fff' : theme.colors.textPrimary }}>{item}</Text>
              </Pressable>
            );
          }}
        />

        {/* Video grid */}
        <FlatList
          data={filtered}
          keyExtractor={v => v.id}
          numColumns={2}
          columnWrapperStyle={{ gap: CARD_GAP, paddingHorizontal: 24 }}
          contentContainerStyle={{ paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => <VideoCard item={item} />}
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
  empty: { paddingVertical: 60, paddingHorizontal: 24 },
});
