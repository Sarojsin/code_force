import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import type { MoodLog } from 'src/services/api';

export const MOOD_EMOJI_MAP: Record<string, string> = {
  Happy: '😊',
  Calm: '😌',
  Sad: '😢',
  Angry: '😠',
  Anxious: '😰',
  Tired: '😴',
  Loved: '🥰',
  Motivated: '💪',
  Radiant: '✨',
  Neutral: '😐',
  Stressed: '😫',
  Energized: '⚡',
};

interface MoodPillListProps {
  moodLogs: MoodLog[];
  phaseAccent: string;
  onPressMood?: (mood: string) => void;
}

export function MoodPillList({ moodLogs, phaseAccent, onPressMood }: MoodPillListProps) {
  const theme = useTheme();
  const last7 = moodLogs.slice(-7);

  if (last7.length === 0) {
    return null;
  }

  // Aggregate by mood label
  const moodCounts: Record<string, number> = {};
  last7.forEach((log) => {
    moodCounts[log.mood] = (moodCounts[log.mood] ?? 0) + 1;
  });

  const pills = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);

  return (
    <View style={styles.container}>
      {pills.map(([mood, count]) => {
        const emoji = MOOD_EMOJI_MAP[mood] ?? '😊';
        const avgIntensity = last7.filter((m) => m.mood === mood).reduce((s, m) => s + m.intensity, 0) / count;
        const dotCount = Math.min(5, Math.max(1, Math.round(avgIntensity / 2)));

        return (
          <Pressable
            key={mood}
            onPress={() => onPressMood?.(mood)}
            style={[
              styles.pill,
              {
                backgroundColor: `${phaseAccent}22`,
                borderColor: `${phaseAccent}44`,
                borderRadius: theme.radius.pill,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${mood}, ${count} times`}
          >
            <Txt variant="emoji" style={styles.pillEmoji}>{emoji}</Txt>
            <Txt variant="bodySmall" style={styles.pillMood}>
              {mood} {count}x
            </Txt>
            <View style={styles.dots}>
              {[...Array(5)].map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    { backgroundColor: i < dotCount ? phaseAccent : theme.colors.border }]}
                />
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
    marginLeft: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  pillEmoji: {
    fontSize: 16,
  },
  pillMood: {
    marginLeft: 6,
    fontWeight: '600',
  },
});
