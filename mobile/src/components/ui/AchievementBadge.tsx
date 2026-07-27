import React from 'react';
import { Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '../../theme';
import type { Achievement } from '../../services/companion/AchievementEngine';

interface AchievementBadgeProps {
  achievement: Achievement;
  unlocked: boolean;
  onPress?: () => void;
}

export const AchievementBadge = React.memo(function AchievementBadge({
  achievement,
  unlocked,
  onPress,
}: AchievementBadgeProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.badge,
        {
          backgroundColor: unlocked
            ? theme.colors.primaryMuted
            : theme.colors.surface,
          opacity: unlocked ? 1 : 0.5,
        },
      ]}
      accessibilityLabel={`${achievement.name}: ${achievement.description}. ${unlocked ? 'Unlocked' : 'Locked'}`}
      accessibilityRole="image"
    >
      <Text style={styles.icon}>{achievement.icon || '\u{1F3C6}'}</Text>
      <Text
        style={[
          styles.name,
          { color: unlocked ? theme.colors.primary : theme.colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {achievement.name}
      </Text>
      <Text
        style={[styles.description, { color: theme.colors.textSecondary }]}
        numberOfLines={2}
      >
        {achievement.description}
      </Text>
      {unlocked && <Text style={styles.check}>{'\u2705'}</Text>}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    minHeight: 60,
  },
  icon: { fontSize: 24, marginRight: 10 },
  name: { fontSize: 14, fontWeight: '600', flex: 1 },
  description: { fontSize: 12, width: '100%', marginTop: 4 },
  check: { fontSize: 16, marginLeft: 4 },
});
