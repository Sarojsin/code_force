import React, { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text } from 'src/components/ui';
import { useTheme } from 'src/theme';

import { EmptyCycleCardProps } from './types';

function EmptyCycleCardBase({ onLogPeriod }: EmptyCycleCardProps) {
  const theme = useTheme();
  return (
    <LinearGradient
      colors={[theme.colors.primary + '22', theme.colors.surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.emptyCard, { borderColor: theme.colors.primary + '30' }]}
    >
      <Text style={styles.emptyEmoji}>🌱</Text>
      <Text variant="h2" style={styles.emptyTitle}>Start tracking your first cycle</Text>
      <Text variant="body" color="muted" style={styles.emptySubtitle}>
        Log your first period to unlock personalized cycle predictions and phase insights.
      </Text>
      <Pressable
        onPress={onLogPeriod}
        accessibilityLabel="Log your first period"
        accessibilityRole="button"
        style={[styles.ctaButton, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg }]}
      >
        <Text style={styles.ctaButtonText}>Log Period</Text>
      </Pressable>
    </LinearGradient>
  );
}

export const EmptyCycleCard = memo(EmptyCycleCardBase);

const styles = StyleSheet.create({
  emptyCard: {
    minHeight: 240,
    padding: 24,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  ctaButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default EmptyCycleCard;