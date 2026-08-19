import React from 'react';
import { ScrollView, StyleSheet, View, Dimensions, TouchableOpacity, Text } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ResizeMode, Video } from 'expo-av';
import { useQuery } from '@tanstack/react-query';
import { Text as Txt, EmptyState, Loader } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { nurseContentService } from 'src/services/api/nurse_content';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WellnessStackParamList } from 'src/navigation/types';

type Props = NativeStackScreenProps<WellnessStackParamList, 'ContentDetail'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function ContentDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const theme = useTheme();

  const { data: content, isLoading, isError, refetch } = useQuery({
    queryKey: ['nurse-content', id],
    queryFn: () => nurseContentService.getContentDetail(id),
  });

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerTitle: content?.title ?? 'Content',
      headerStyle: { backgroundColor: theme.colors.surface },
      headerTintColor: theme.colors.textPrimary,
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={{ marginRight: 8 }}>
          <Text style={{ fontSize: 24, color: theme.colors.textPrimary }}>{'‹'}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, content?.title, theme]);

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <Loader />
      </SafeAreaView>
    );
  }

  if (isError || !content) {
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

  const isVideo = content.content_type === 'video';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {isVideo && content.video_url ? (
          <View style={styles.videoWrapper}>
            <Video
              source={{ uri: content.video_url }}
              style={styles.video}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
            />
          </View>
        ) : null}

        {!isVideo && content.thumbnail_url ? (
          <ExpoImage
            source={{ uri: content.thumbnail_url }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : null}

        <View style={styles.body}>
          <Txt variant="h1" style={styles.title}>{content.title}</Txt>

          <View style={styles.metaRow}>
            <View style={[styles.badge, { backgroundColor: theme.colors.primary + '20' }]}>
              <Txt variant="caption" style={{ color: theme.colors.primary }}>
                {content.category.replace('_', ' ')}
              </Txt>
            </View>
            {content.author_name ? (
              <Txt variant="caption" color="muted">by {content.author_name}</Txt>
            ) : null}
          </View>

          {content.description ? (
            <Txt variant="body" style={styles.description}>{content.description}</Txt>
          ) : null}

          {isVideo && content.video_url ? (
            <View style={styles.videoInfo}>
              <Txt variant="caption" color="secondary">Video — tap play to watch</Txt>
            </View>
          ) : null}

          {content.tags && content.tags.length > 0 ? (
            <View style={styles.tagRow}>
              {content.tags.map((tag: string, i: number) => (
                <View key={i} style={[styles.tag, { borderColor: theme.colors.border }]}>
                  <Txt variant="caption" color="muted">{tag}</Txt>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { paddingBottom: 48 },
  videoWrapper: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 9 / 16, backgroundColor: '#000' },
  video: { width: '100%', height: '100%' },
  heroImage: { width: '100%', height: 240 },
  body: { padding: 24 },
  title: { marginBottom: 12, fontSize: 22 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  description: { lineHeight: 24, marginBottom: 16 },
  videoInfo: { marginBottom: 16 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
});
