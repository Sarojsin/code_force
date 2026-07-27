import React, { useMemo } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

interface HealthMetricCardProps {
  icon: string;
  label: string;
  value: string;
  target: string;
  logged: boolean;
  streak: number;
  onPress: () => void;
}

export const HealthMetricCard = React.memo(function HealthMetricCard({
  icon,
  label,
  value,
  target,
  logged,
  streak,
  onPress,
}: HealthMetricCardProps) {
  const theme = useTheme();

  const progress = useMemo(() => {
    const val = parseFloat(value) || 0;
    const tgt = parseFloat(target) || 1;
    return Math.min(val / tgt, 1);
  }, [value, target]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: logged
            ? theme.colors.primaryMuted
            : theme.colors.surface,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
      accessibilityLabel={`${label}: ${value} of ${target} target. ${logged ? 'Logged' : 'Not logged'}. Streak: ${streak} days. Tap to log.`}
      accessibilityRole="button"
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.label, { color: theme.colors.textPrimary }]}>{label}</Text>
      <Text style={[styles.value, { color: theme.colors.primary }]}>
        {value}
      </Text>
      <Text style={[styles.target, { color: theme.colors.textMuted }]}>
        Target: {target}
      </Text>
      <View style={styles.progressBg}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${progress * 100}%`,
              backgroundColor: logged
                ? theme.colors.primary
                : theme.colors.textMuted,
            },
          ]}
        />
      </View>
      {streak > 0 && (
        <View style={styles.streakRow}>
          <Text style={styles.fire}>{'\u{1F525}'}</Text>
          <Text style={[styles.streakText, { color: theme.colors.accent }]}>
            {streak} day{streak > 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: '48%',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    minHeight: 140,
  },
  icon: { fontSize: 28, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  value: { fontSize: 18, fontWeight: '700' },
  target: { fontSize: 11, marginBottom: 8 },
  progressBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e0e0e0',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  fire: { fontSize: 12, marginRight: 2 },
  streakText: { fontSize: 11, fontWeight: '600' },
});
