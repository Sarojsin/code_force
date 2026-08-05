import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import type { CurrentCycleState } from 'src/hooks/useCurrentCycleState';

interface PhaseAwareHeroProps {
  cycleState: CurrentCycleState;
  onStartTracking: () => void;
}

export function PhaseAwareHero({ cycleState, onStartTracking }: PhaseAwareHeroProps) {
  const theme = useTheme();

  if (!cycleState.hasCycleData) {
    return (
      <LinearGradient
        colors={[theme.colors.primaryMuted, theme.colors.accentMuted]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { borderRadius: theme.radius.cardLg }]}
      >
        <View style={styles.heroContent}>
          <Txt variant="emoji" style={styles.emojiLarge}>🌙</Txt>
          <Txt variant="h2" style={styles.heroTitle} color="primary">
            Welcome to Wellness
          </Txt>
          <Txt variant="body" color="secondary" style={styles.heroDesc}>
            Track your cycle to see phase-aware wellness insights.
          </Txt>
          <Pressable
            onPress={onStartTracking}
            style={[styles.trackBtn, { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill }]}
            accessibilityRole="button"
            accessibilityLabel="Start tracking cycle"
          >
            <Txt variant="body" style={styles.trackBtnText}>Start Tracking</Txt>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  const { phaseEmoji, phaseLabel, phaseDesc, cycleDay, predictedCycleLength } = cycleState;

  return (
    <LinearGradient
      colors={[`${cycleState.phaseBg ?? theme.colors.primaryMuted}55`, theme.colors.surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
       style={[styles.hero, styles.heroWithBorder, { borderRadius: theme.radius.cardLg, borderColor: theme.colors.border }]}
    >
      <View style={styles.heroContent}>
          <Txt variant="emoji" style={styles.emojiPhase}>{phaseEmoji}</Txt>
          <Txt variant="h2" style={styles.heroTitle} color="primary">
            {phaseLabel} Phase
          </Txt>
          <Txt variant="bodySmall" color="secondary">
            Day {cycleDay ?? '?'} of {predictedCycleLength ?? '...'}
          </Txt>
          <Txt variant="caption" color="muted" style={styles.heroDescItalic}>
            {phaseDesc}
          </Txt>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 24,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroWithBorder: {
    borderWidth: 1,
  },
  heroContent: {
    alignItems: 'center',
  },
  emojiLarge: {
    fontSize: 32,
  },
  emojiPhase: {
    fontSize: 36,
  },
  heroTitle: {
    marginTop: 8,
    marginBottom: 4,
  },
  heroDesc: {
    marginBottom: 12,
    textAlign: 'center',
  },
  heroDescItalic: {
    marginTop: 6,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  trackBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  trackBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
});
