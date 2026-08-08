import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from 'src/theme';
import type { SafetyTier } from 'src/utils/symptomSafety';
import { Text } from '../Text';

interface AIInsightCardProps {
  /** Safety tier — only `maintenance` / `motivation` render a card this PR. */
  tier: SafetyTier;
  /** Motivational copy from `dayInsights` (null for `seek_care` / `recommendation`). */
  text: string | null;
}

const TIER_HEADER: Partial<Record<SafetyTier, string>> = {
  maintenance: 'Keep tracking',
  motivation: 'You today',
};

export function AIInsightCard({ tier, text }: AIInsightCardProps) {
  const theme = useTheme();
  if (!text) return null;
  const header = TIER_HEADER[tier] ?? 'AI Insight';
  return (
    <LinearGradient
      colors={
        tier === 'motivation'
          ? [theme.colors.accentMuted, theme.colors.accentLight]
          : [theme.colors.primaryMuted, theme.colors.primaryLight]
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderRadius: theme.radius.cardLg }]}
    >
      <View style={styles.header}>
        <Text style={{ fontSize: 18 }}>{tier === 'motivation' ? '✨' : '📈'}</Text>
        <Text variant="body" style={{ fontWeight: '700', color: theme.colors.textStrong }}>
          {header}
        </Text>
      </View>
      <Text variant="bodySmall" color="secondary" style={{ marginTop: 6 }}>
        {text}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
