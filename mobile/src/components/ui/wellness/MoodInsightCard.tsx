import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import type { CurrentCycleState } from 'src/hooks/useCurrentCycleState';

interface MoodInsightCardProps {
  cycleState: CurrentCycleState;
  insight: string | null;
}

export function MoodInsightCard({ cycleState, insight }: MoodInsightCardProps) {
  const theme = useTheme();

  if (!insight) {
    return null;
  }

  const gradientColors: [string, string] = cycleState.hasCycleData
    ? [cycleState.phaseBg ?? `${theme.colors.primaryMuted}55`, `${theme.colors.primaryMuted}33`]
    : [theme.colors.surface, theme.colors.surface];

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
       style={[styles.card, styles.cardBorder, { borderColor: theme.colors.border }]}
     >
      <View style={styles.header}>
        <Txt style={styles.emoji}>{cycleState.phaseEmoji ?? '🤖'}
        </Txt>
        <Txt variant="bodySmall" style={[styles.heading, { color: cycleState.phaseAccent ?? theme.colors.primary }]}>
          {cycleState.hasCycleData ? `${cycleState.phaseLabel} Insight` : 'Wellness Insight'}
        </Txt>
      </View>
      <Txt variant="body" style={styles.insightText} color="secondary">
        {insight}
      </Txt>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heading: {
    fontWeight: '600',
    marginLeft: 6,
  },
  emoji: {
    fontSize: 16,
  },
  insightText: {
    marginTop: 6,
    lineHeight: 20,
  },
  cardBorder: {
    borderWidth: 1,
  },
});
