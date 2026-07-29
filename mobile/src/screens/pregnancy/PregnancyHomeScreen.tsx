import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from 'react-native-reanimated';

import { Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';

const BABY_SIZES = [
  { week: 4, fruit: 'Poppy seed', emoji: '🌱' },
  { week: 8, fruit: 'Raspberry', emoji: '🍓' },
  { week: 12, fruit: 'Plum', emoji: '🍑' },
  { week: 16, fruit: 'Avocado', emoji: '🥑' },
  { week: 20, fruit: 'Banana', emoji: '🍌' },
  { week: 24, fruit: 'Corn', emoji: '🌽' },
  { week: 28, fruit: 'Eggplant', emoji: '🍆' },
  { week: 32, fruit: 'Squash', emoji: '🎃' },
  { week: 36, fruit: 'Romaine lettuce', emoji: '🥬' },
  { week: 40, fruit: 'Watermelon', emoji: '🍉' },
];

function getBabySize(week: number): { fruit: string; emoji: string } {
  let closest = BABY_SIZES[0];
  for (const s of BABY_SIZES) {
    if (week >= s.week) closest = s;
  }
  return { fruit: closest.fruit, emoji: closest.emoji };
}

function getTrimester(week: number): number {
  if (week <= 13) return 1;
  if (week <= 26) return 2;
  return 3;
}

function getTrimesterInfo(t: number): string {
  switch (t) {
    case 1: return "Your baby is growing rapidly. Key organs are developing. Focus on folic acid and prenatal vitamins.";
    case 2: return "Energy returns! Baby movements become noticeable. Continue balanced nutrition and gentle exercise.";
    case 3: return "Final stretch. Baby is gaining weight and preparing for birth. Practice breathing and rest well.";
    default: return "";
  }
}

const QUICK_ACTIONS = [
  { icon: '🦶', label: 'Kick Counter', color: '#EDE9FE' },
  { icon: '📝', label: 'Log Symptoms', color: '#FCE7F3' },
  { icon: '📅', label: 'Checkups', color: '#D1FAE5' },
  { icon: '📚', label: 'Milestones', color: '#BFDBFE' },
];

function ActionCard({ icon, label, color }: { icon: string; label: string; color: string }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ width: '48%', marginBottom: 8 }, animStyle]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.95); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        style={[styles.actionCard, { backgroundColor: color, borderRadius: 16 }]}
      >
        <Txt style={{ fontSize: 28 }}>{icon}</Txt>
        <Txt variant="body" style={{ fontWeight: '600', marginTop: 8, color: '#1A1A2E' }}>{label}</Txt>
      </Pressable>
    </Animated.View>
  );
}

export function PregnancyHomeScreen() {
  const theme = useTheme();
  const [currentWeek, setCurrentWeek] = useState(14);
  const dueDate = new Date(2026, 1, 15);
  const trimester = getTrimester(currentWeek);
  const baby = getBabySize(currentWeek);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View style={styles.headerRow}>
          <View>
            <Txt style={{ fontSize: 12, color: theme.colors.textSoft, letterSpacing: 0.5 }}>You're pregnant 💗</Txt>
            <Txt style={styles.weekTitle}>Week {currentWeek}</Txt>
          </View>
          <View style={[styles.headerEmoji, { borderRadius: 26, backgroundColor: theme.colors.primaryLight }]}>
            <Txt style={{ fontSize: 24 }}>🤰</Txt>
          </View>
        </View>

        <LinearGradient
          colors={[theme.colors.primaryLight, theme.colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.heroCard, { borderRadius: 26 }]}
        >
          <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 100 }]}>
            <Txt style={{ color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>
              TRIMESTER {trimester}
            </Txt>
          </View>
          <Txt style={styles.heroTitle}>Baby is the size of a {baby.fruit} {baby.emoji}</Txt>
          <Txt style={styles.heroDesc}>
            {getTrimesterInfo(trimester)}
          </Txt>
        </LinearGradient>

        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map(a => (
            <ActionCard key={a.label} icon={a.icon} label={a.label} color={a.color} />
          ))}
        </View>

        <Card style={{ marginBottom: 16 }}>
          <Txt style={{ fontSize: 10, fontWeight: '800', color: theme.colors.textSoft, letterSpacing: 1.5 }}>WEEK PROGRESS</Txt>
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border, borderRadius: 100, marginTop: 12 }]}>
            <View style={[styles.progressFill, { width: `${(currentWeek / 40) * 100}%`, backgroundColor: theme.colors.primary, borderRadius: 100 }]} />
          </View>
          <Txt variant="caption" color="muted" style={{ textAlign: 'center', marginTop: 6 }}>
            {currentWeek} of 40 weeks
          </Txt>
          <View style={styles.weekNav}>
              <Pressable
                onPress={() => setCurrentWeek(w => Math.max(1, w - 1))}
                style={[styles.weekNavBtn, { borderColor: theme.colors.mauve, borderRadius: 12 }]}>
                <Txt variant="body" color="muted">← Prev week</Txt>
              </Pressable>
              <Pressable
                onPress={() => setCurrentWeek(w => Math.min(40, w + 1))}
                style={[styles.weekNavBtn, { borderColor: theme.colors.mauve, borderRadius: 12 }]}>
                <Txt variant="body" color="muted">Next week →</Txt>
              </Pressable>
            <Pressable
              onPress={() => setCurrentWeek(w => Math.min(40, w + 1))}
              style={[styles.weekNavBtn, { borderColor: '#D4A5B5', borderRadius: 12 }]}
            >
              <Txt variant="body" color="muted">Next week →</Txt>
            </Pressable>
          </View>
        </Card>

        <LinearGradient
          colors={[theme.colors.accentMuted, '#FCE7F3']}
          style={[styles.trimesterCard, { borderRadius: 20 }]}
        >
          <Txt variant="h3" style={{ color: theme.colors.accent }}>Trimester {trimester}</Txt>
          <Txt variant="body" color="secondary" style={{ marginTop: 8, lineHeight: 22 }}>
            {getTrimesterInfo(trimester)}
          </Txt>
          <Txt variant="caption" color="muted" style={{ marginTop: 12 }}>
            Due date: {format(dueDate, 'MMMM d, yyyy')}
          </Txt>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  weekTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: '#1A1A2E',
    marginTop: 4,
  },
  headerEmoji: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
  },
  heroDesc: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    marginTop: 8,
    lineHeight: 20,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionCard: {
    padding: 16,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  progressBar: {
    height: 8,
  },
  progressFill: {
    height: '100%',
  },
  weekNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  weekNavBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: 1,
  },
  trimesterCard: {
    padding: 20,
  },
});
