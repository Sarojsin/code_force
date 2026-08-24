import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ResizeMode, Video, Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { typography } from 'src/theme';
import { useDiaryPage } from '../../services/queries/diary';
import { diaryLocal } from '../../services/localDb';
import { resolveDiaryMediaUris } from '../../services/diary/diaryMediaUri';
import { emitDiaryOpened } from '../../services/diary/diaryEvents';

export function DiaryPageScreen({ route, navigation }: any) {
  const { diaryId, pageId } = route.params;
  const { top } = useSafeAreaInsets();
  const { data: page } = useDiaryPage(diaryId, pageId);
  const [mediaUris, setMediaUris] = useState<Record<string, string>>({});
  const [fallbackPage, setFallbackPage] = useState<any | null>(null);
  const [localObjects, setLocalObjects] = useState<any[]>([]);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const openedRef = useRef(false);

  const serverObjects = page?.objects ?? [];
  const objects = localObjects.length > 0 ? localObjects : serverObjects;

  useEffect(() => {
    resolveDiaryMediaUris(objects.map((o: any) => o.media_id)).then(setMediaUris);
  }, [objects]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [localPage, localObjs] = await Promise.all([
          diaryLocal.page.getById(pageId),
          diaryLocal.object.getByPage(pageId),
        ]);
        if (cancelled) return;
        if (localObjs.length > 0) setLocalObjects(localObjs);
        if (localPage && !page) {
          setFallbackPage({ ...localPage, objects: localObjs });
        }
      } catch {
        // Local lookup is best-effort; leave the viewer empty if it fails.
      }
    })();
    return () => { cancelled = true; };
  }, [page, pageId]);

  useEffect(() => {
    if ((page || fallbackPage) && !openedRef.current) {
      openedRef.current = true;
      emitDiaryOpened({ diaryId, pageId });
    }
  }, [page, fallbackPage, diaryId, pageId]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  if (!page && !fallbackPage) return null;

  const pageData = page ?? fallbackPage;

  const pageDate = new Date(pageData.page_date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const MOOD_EMOJI: Record<string, string> = {
    happy: '😊', calm: '😌', loved: '🥰', grateful: '🙏',
    peaceful: '🕊️', sad: '😢', anxious: '😰', energetic: '⚡',
  };

  async function playVoice(obj: any) {
    const uri = mediaUris[obj.media_id ?? ''];
    if (!uri) return;
    try {
      if (playingId === obj.id && soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setPlayingId(null);
        return;
      }
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
      soundRef.current = sound;
      setPlayingId(obj.id);
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded && status.didJustFinish) {
          soundRef.current = null;
          setPlayingId(null);
        }
      });
      await sound.playAsync();
    } catch (e) {
      console.warn('Voice playback failed', e);
      setPlayingId(null);
    }
  }

  function renderObject(obj: any) {
    const mediaUri = mediaUris[obj.media_id ?? ''];
    switch (obj.object_type) {
      case 'text':
        return <Text style={[styles.textBlock, obj.font_family ? { fontFamily: obj.font_family } : null, obj.font_size ? { fontSize: obj.font_size } : null]}>{obj.text_content}</Text>;
      case 'image':
        return mediaUri
          ? <ExpoImage source={{ uri: mediaUri }} style={[styles.mediaFrame, { width: obj.width ?? 200, height: obj.height ?? 200 }]} contentFit="cover" cachePolicy="memory-disk" />
          : <View style={[styles.mediaPlaceholder, { width: obj.width ?? 200, height: obj.height ?? 200 }]}><Text style={styles.mediaPlaceholderIcon}>🖼</Text></View>;
      case 'video':
        return mediaUri
          ? (
            <View style={[styles.videoWrapper, { width: obj.width ?? 280, height: obj.height ?? 220 }]}>
              <Video source={{ uri: mediaUri }} style={styles.videoFill} resizeMode={ResizeMode.CONTAIN} useNativeControls isLooping />
            </View>
          )
          : (
            <View style={[styles.videoWrapper, styles.videoPlaceholder, { width: obj.width ?? 280, height: obj.height ?? 220 }]}><Text style={styles.mediaPlaceholderIcon}>🎬</Text></View>
          );
      case 'voice':
        return (
          <View style={styles.voicePlayer}>
            <Text style={{ fontSize: 20 }}>🎤</Text>
            <Text style={styles.voiceLabel}>Voice note</Text>
            <TouchableOpacity style={[styles.playBtn, playingId === obj.id && styles.playBtnActive]} onPress={() => playVoice(obj)}>
              <Text style={styles.playBtnText}>{playingId === obj.id ? '■' : '▶'}</Text>
            </TouchableOpacity>
          </View>
        );
      case 'sticker':
        return <Text style={{ fontSize: 48 }}>{obj.sticker_id ?? '🌸'}</Text>;
      case 'mood':
        return (
          <View style={styles.moodBadge}>
            <Text style={[{ fontFamily: 'System' }, { fontSize: 32 }]}>{MOOD_EMOJI[obj.text_content ?? 'calm'] ?? '😊'}</Text>
            <Text style={styles.moodLabel}>{obj.text_content}</Text>
          </View>
        );
      default:
        return null;
    }
  }

  return (
    <View style={[styles.container, { paddingTop: top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pageDate}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('DiaryEditor', { diaryId, pageId })}>
          <Text style={styles.editIcon}>✏️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.canvas} contentContainerStyle={styles.canvasContent}>
        {pageData.memory_location && (
          <View style={styles.memoryChip}>
            <Text style={styles.memoryChipText}>{pageData.memory_location}</Text>
          </View>
        )}
        {objects?.map((obj: any) => (
          <View key={obj.id} style={[styles.object, { left: obj.position_x, top: obj.position_y, width: obj.width, height: obj.height }]}>
            {renderObject(obj)}
          </View>
        ))}
      </ScrollView>

      <View style={styles.pageFooter}>
        <TouchableOpacity><Text style={styles.chevron}>‹</Text></TouchableOpacity>
        <Text style={styles.pageIndicator}>Page {pageData.page_number}</Text>
        <TouchableOpacity><Text style={styles.chevron}>›</Text></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf9f1' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12 },
  backArrow: { fontSize: 24, color: '#410403' },
  headerTitle: { fontFamily: 'LibreCaslonText_600SemiBold', fontSize: 20, color: '#410403' },
  editIcon: { fontSize: 20 },
  canvas: { flex: 1, marginHorizontal: 24, backgroundColor: '#fff', borderRadius: 24, shadowColor: '#410403', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  canvasContent: { padding: 32 },
  memoryChip: { backgroundColor: '#ffca98', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4, alignSelf: 'flex-start', transform: [{ rotate: '3deg' }], marginBottom: 16 },
  memoryChipText: { fontFamily: 'WorkSans_600SemiBold', fontSize: 12, color: '#7a532a', letterSpacing: 1 },
  object: { position: 'absolute' },
  textBlock: { fontFamily: 'Literata_400Regular', fontSize: 18, color: '#1b1c17', lineHeight: 30 },
  pageFooter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, gap: 16, backgroundColor: '#f0eee6', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  chevron: { fontSize: 28, color: '#554240' },
  pageIndicator: { fontFamily: 'WorkSans_600SemiBold', fontSize: 12, color: '#410403' },
  voicePlayer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0eee6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  voiceLabel: { fontFamily: 'WorkSans_500Medium', fontSize: 12, color: '#554240', flex: 1 },
  playBtn: { backgroundColor: '#410403', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  playBtnActive: { backgroundColor: '#ba1a1a' },
  playBtnText: { color: '#fff', fontSize: 12 },
  moodBadge: { alignItems: 'center', backgroundColor: '#fffcf5', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#f0eee6' },
  moodLabel: { fontFamily: 'WorkSans_500Medium', fontSize: typography.label.fontSize, color: '#554240', marginTop: 2 },
  mediaFrame: { borderRadius: 4 },
  mediaPlaceholder: {
    borderRadius: 4, borderWidth: 1, borderStyle: 'dashed', borderColor: '#dbc1bd',
    backgroundColor: '#f5f4ec', alignItems: 'center', justifyContent: 'center',
  },
  mediaPlaceholderIcon: { fontSize: 28 },
  videoWrapper: { backgroundColor: '#1b1c17', borderRadius: 4, overflow: 'hidden' },
  videoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  videoFill: { flex: 1 },
});
