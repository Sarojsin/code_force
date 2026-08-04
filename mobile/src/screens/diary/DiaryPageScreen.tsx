import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDiaryPage } from '../../services/queries/diary';

export function DiaryPageScreen({ route, navigation }: any) {
  const { diaryId, pageId } = route.params;
  const { top } = useSafeAreaInsets();
  const { data: page } = useDiaryPage(diaryId, pageId);

  if (!page) return null;

  const pageDate = new Date(page.page_date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const MOOD_EMOJI: Record<string, string> = {
    happy: '😊', calm: '😌', loved: '🥰', grateful: '🙏',
    peaceful: '🕊️', sad: '😢', anxious: '😰', energetic: '⚡',
  };

  function renderObject(obj: any) {
    switch (obj.object_type) {
      case 'text':
        return <Text style={[styles.textBlock, obj.font_family ? { fontFamily: obj.font_family } : null, obj.font_size ? { fontSize: obj.font_size } : null]}>{obj.text_content}</Text>;
      case 'image':
        return <Image source={{ uri: obj.media_id }} style={{ width: obj.width ?? 200, height: obj.height ?? 200, borderRadius: 4 }} resizeMode="cover" />;
      case 'video':
        return (
          <View style={{ width: obj.width ?? 280, height: obj.height ?? 220, backgroundColor: '#1b1c17', borderRadius: 4, overflow: 'hidden' }}>
            <Video source={{ uri: obj.media_id }} style={{ flex: 1 }} resizeMode={ResizeMode.CONTAIN} useNativeControls isLooping />
          </View>
        );
      case 'voice':
        return (
          <View style={styles.voicePlayer}>
            <Text style={{ fontSize: 20 }}>🎤</Text>
            <Text style={styles.voiceLabel}>Voice note</Text>
            <TouchableOpacity style={styles.playBtn}><Text style={styles.playBtnText}>▶</Text></TouchableOpacity>
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
        {page.memory_location && (
          <View style={styles.memoryChip}>
            <Text style={styles.memoryChipText}>{page.memory_location}</Text>
          </View>
        )}
        {(page as any).objects?.map((obj: any) => (
          <View key={obj.id} style={[styles.object, { left: obj.position_x, top: obj.position_y, width: obj.width, height: obj.height }]}>
            {renderObject(obj)}
          </View>
        ))}
      </ScrollView>

      <View style={styles.pageFooter}>
        <TouchableOpacity><Text style={styles.chevron}>‹</Text></TouchableOpacity>
        <Text style={styles.pageIndicator}>Page {page.page_number}</Text>
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
  playBtnText: { color: '#fff', fontSize: 12 },
  moodBadge: { alignItems: 'center', backgroundColor: '#fffcf5', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#f0eee6' },
  moodLabel: { fontFamily: 'WorkSans_500Medium', fontSize: 10, color: '#554240', marginTop: 2 },
});
