import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';

interface StreakBadgeProps {
  metricType: string;
  count: number;
  icon: string;
}

export const StreakBadge = React.memo(function StreakBadge({
  metricType,
  count,
  icon,
}: StreakBadgeProps) {
  const theme = useTheme();
  if (count === 0) return null;

  return (
    <View
      style={[styles.badge, { backgroundColor: theme.colors.primaryMuted }]}
      accessibilityLabel={`${metricType} streak: ${count} days`}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.count, { color: theme.colors.primary }]}>
        {count}
      </Text>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>
        {metricType}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  icon: { fontSize: 14, marginRight: 4 },
  count: { fontSize: 14, fontWeight: '700', marginRight: 4 },
  label: { fontSize: 12 },
});
