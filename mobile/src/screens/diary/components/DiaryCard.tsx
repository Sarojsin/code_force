import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { Diary } from '../../../db/schema';

const COVER_COLORS: Record<string, string> = {
  primary: '#410403',
  secondary: '#7d562d',
  tertiary: '#0f2115',
};

const SPINE_COLORS: Record<string, string> = {
  primary: '#5e1914',
  secondary: '#623f18',
  tertiary: '#1a2e1d',
};

interface DiaryCardProps {
  diary: Diary;
  onPress: () => void;
}

export function DiaryCard({ diary, onPress }: DiaryCardProps) {
  const coverBg = COVER_COLORS[diary.cover_color] ?? COVER_COLORS.primary;
  const spineBg = SPINE_COLORS[diary.cover_color] ?? SPINE_COLORS.primary;

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: coverBg }]} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.spine, { backgroundColor: spineBg }]} />
      <Text style={styles.icon}>📖</Text>
      <Text style={styles.title}>{diary.title}</Text>
      <View style={styles.meta}>
        <Text style={styles.metaText}>{diary.page_count} Pages Preserved</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { height: 320, width: '48%', borderRadius: 24, overflow: 'hidden', padding: 24, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 10, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 8, marginBottom: 16 },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 12 },
  icon: { fontSize: 32, marginBottom: 16, opacity: 0.8 },
  title: { fontFamily: 'LibreCaslonText_700Bold', fontSize: 24, color: '#d4af37', textAlign: 'center', textShadowColor: 'rgba(255,255,255,0.2)', textShadowOffset: { width: 0.5, height: 0.5 }, textShadowRadius: 1 },
  meta: { position: 'absolute', bottom: 16 },
  metaText: { fontFamily: 'WorkSans_600SemiBold', fontSize: 12, letterSpacing: 1, color: '#e17e72', opacity: 0.8 },
});
