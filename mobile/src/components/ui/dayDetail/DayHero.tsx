import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { useTheme } from 'src/theme';
import { Text } from '../Text';
import type { DayPhase } from 'src/utils/cyclePhases';

interface DayHeroProps {
  date: Date;
  phase: DayPhase;
  cycleDay?: number;
  loggedToday?: boolean;
}

export function DayHero({ date, phase, cycleDay, loggedToday }: DayHeroProps) {
  const theme = useTheme();
  return (
    <LinearGradient
      colors={[theme.colors.primaryDeep, theme.colors.primary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { borderRadius: theme.radius.sheet }]}
    >
      <Text style={[styles.date, { fontFamily: theme.typography.dayTitle.fontFamily }]}>
        {format(date, 'EEEE, MMMM d')}
      </Text>
      <View style={styles.phaseRow}>
        <Text style={styles.phaseEmoji}>{phase.emoji}</Text>
        <Text style={styles.phaseLabel}>{phase.label}</Text>
      </View>
      <Text style={styles.desc}>{phase.description}</Text>
      <View style={styles.bottomRow}>
        {cycleDay != null && cycleDay > 0 && (
          <Text style={styles.cycleDay}>Cycle Day {cycleDay}</Text>
        )}
        {loggedToday && (
          <View style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
            <Text style={styles.pillText}>✓ Logged today</Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingVertical: 24 },
  date: { fontSize: 28, fontWeight: '800', lineHeight: 34, color: '#FFFFFF' },
  phaseRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  phaseEmoji: { fontSize: 18 },
  phaseLabel: { fontSize: 16, fontWeight: '700', letterSpacing: 0.4, color: '#FFFFFF' },
  desc: { fontSize: 13, lineHeight: 18, marginTop: 6, color: 'rgba(255,255,255,0.92)' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  cycleDay: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100 },
  pillText: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
});
