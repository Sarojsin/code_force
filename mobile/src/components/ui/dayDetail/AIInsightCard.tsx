import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from 'src/theme';
import { Text } from '../Text';

interface AIInsightCardProps {
  insight: string | null;
}

export function AIInsightCard({ insight }: AIInsightCardProps) {
  const theme = useTheme();
  if (!insight) return null;
  return (
    <LinearGradient
      colors={[theme.colors.accentMuted, theme.colors.accentLight]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderRadius: theme.radius.cardLg }]}
    >
      <View style={styles.header}>
        <Text style={{ fontSize: 18 }}>✨</Text>
        <Text variant="body" style={{ fontWeight: '700', color: theme.colors.accent }}>AI Insight</Text>
      </View>
      <Text variant="bodySmall" color="secondary" style={{ marginTop: 6 }}>{insight}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
