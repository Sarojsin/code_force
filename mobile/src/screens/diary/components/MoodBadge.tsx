import { View, Text, StyleSheet } from 'react-native';

const MOOD_MAP: Record<string, { emoji: string; color: string; bg: string }> = {
  happy: { emoji: '☀️', color: '#7a532a', bg: '#ffca98' },
  grateful: { emoji: '✨', color: '#5e1914', bg: '#f5e0d0' },
  calm: { emoji: '🌿', color: '#2d4632', bg: '#d4e0cf' },
  sad: { emoji: '🌧️', color: '#2a4a6b', bg: '#d0e0eb' },
  anxious: { emoji: '🌀', color: '#623f18', bg: '#efe0c0' },
  excited: { emoji: '🎉', color: '#5e1914', bg: '#ffdad5' },
  loved: { emoji: '❤️', color: '#5e1914', bg: '#f5d5d5' },
  tired: { emoji: '🌙', color: '#3e2723', bg: '#e4dbd5' },
};

const UNKNOWN = { emoji: '💭', color: '#554240', bg: '#f0eee6' };

interface MoodBadgeProps {
  mood: string;
}

export function MoodBadge({ mood }: MoodBadgeProps) {
  const m = MOOD_MAP[mood.toLowerCase()] ?? UNKNOWN;
  return (
    <View style={[styles.badge, { backgroundColor: m.bg }]}>
      <Text style={styles.emoji}>{m.emoji}</Text>
      <Text style={[styles.label, { color: m.color }]}>{mood}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emoji: { fontSize: 14 },
  label: {
    fontFamily: 'WorkSans_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
