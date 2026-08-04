import React, { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Text, Button } from 'src/components/ui';
import { MOOD_OPTIONS } from 'src/components/ui/MoodPicker';
import { PHASE_CONTENT } from 'src/constants/phaseContent';
import { palette } from 'src/theme';
import type { PhaseRange } from 'src/utils/cyclePhases';

const MOOD_EMOJI_MAP: Record<string, string> = Object.fromEntries(
  MOOD_OPTIONS.map((m) => [m.label, m.emoji]),
);

export interface PhaseDetailSheetProps {
  phaseKey: PhaseRange['key'];
  phaseStartDay: number | null;
  phaseEndDay: number | null;
  predictedCycleLength: number;
  cycleDay: number;
  todayMood: { mood: string; intensity: number } | null;
  cycleStats: { lengths: number[]; stdDev: number; irregularCount: number };
  onLogToday: () => void;
  onPreFill: (symptoms: string[]) => void;
}

function StarRow({ level, color }: { level: number; color: string }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <View
          key={s}
          style={[styles.star, { backgroundColor: s <= level ? color : color + '33' }]}
        />
      ))}
    </View>
  );
}

function computeProgress(
  cycleDay: number,
  phaseStartDay: number | null,
  phaseEndDay: number | null,
): { label: string; pct: number; sublabel: string } {
  if (phaseStartDay === null || phaseEndDay === null) {
    return { label: 'This phase is upcoming', pct: 0, sublabel: '' };
  }
  if (phaseStartDay === phaseEndDay) {
    return { label: 'Today is the peak day', pct: 100, sublabel: '' };
  }
  if (cycleDay < phaseStartDay) {
    return { label: 'This phase is upcoming', pct: 0, sublabel: '' };
  }
  if (cycleDay > phaseEndDay) {
    return { label: 'This phase is over', pct: 100, sublabel: '' };
  }
  const phaseLength = phaseEndDay - phaseStartDay + 1;
  const dayInPhase = cycleDay - phaseStartDay + 1;
  const pct = Math.round((dayInPhase / phaseLength) * 100);
  return {
    label: `Day ${dayInPhase} of ${phaseLength}`,
    pct,
    sublabel: `(${pct}% complete)`,
  };
}

export function PhaseDetailSheet({
  phaseKey,
  phaseStartDay,
  phaseEndDay,
  predictedCycleLength,
  cycleDay,
  todayMood,
  cycleStats,
  onLogToday,
  onPreFill,
}: PhaseDetailSheetProps) {
  const [tappedSigns, setTappedSigns] = useState<string[]>([]);

  const content = PHASE_CONTENT[phaseKey];
  if (!content) return null;

  const meta = {
    menstrual: { bg: '#FFE4EC', fg: '#B83058', emoji: '🩸', label: 'Menstrual' },
    follicular: { bg: '#FFF4E3', fg: '#A0621A', emoji: '🌱', label: 'Follicular' },
    fertile: { bg: '#F3E5F5', fg: '#7B1FA2', emoji: '💮', label: 'Fertile' },
    ovulation: { bg: '#E5F9F0', fg: '#1A6B45', emoji: '🌟', label: 'Ovulation' },
    luteal: { bg: '#EFE8FA', fg: '#5A35A0', emoji: '🌙', label: 'Luteal' },
  }[phaseKey];

  const toggleSign = (sign: string) => {
    setTappedSigns((prev) => {
      const next = prev.includes(sign) ? prev.filter((s) => s !== sign) : [...prev, sign];
      onPreFill(next);
      return next;
    });
  };

  const ovulationDay = predictedCycleLength - 14;
  const showIrregularNote = cycleStats.stdDev > 5 || cycleStats.irregularCount > 0;
  const progress = computeProgress(cycleDay, phaseStartDay, phaseEndDay);
  const dayRangeLabel =
    phaseStartDay !== null && phaseEndDay !== null
      ? `Day ${phaseStartDay}–${phaseEndDay} of ${predictedCycleLength}`
      : `Day 1–${predictedCycleLength} of ${predictedCycleLength}`;

  const moodEmoji = todayMood ? MOOD_EMOJI_MAP[todayMood.mood] ?? '😊' : null;
  const intensityDots = todayMood
    ? '●'.repeat(todayMood.intensity) + '○'.repeat(5 - todayMood.intensity)
    : null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[meta.bg, meta.fg + '33']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text variant="emoji" style={styles.heroEmoji}>{content.emoji}</Text>
        <Text variant="h2" style={styles.heroLabel}>{content.label}</Text>
        <Text variant="body" color="secondary" style={styles.heroRange}>
          {dayRangeLabel}
        </Text>
      </LinearGradient>

      <View style={styles.progressSection}>
        <Text variant="caption" color="muted" style={styles.progressLabel}>
          You are on {progress.label} of this phase {progress.sublabel}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress.pct}%`, backgroundColor: meta.fg }]} />
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="h3">Your Body Right Now</Text>

        <View style={styles.starRowContainer}>
          <View style={styles.starCol}>
            <Text variant="caption" color="muted">Typical Energy</Text>
            <StarRow level={content.typicalEnergy} color={meta.fg} />
          </View>
          <View style={styles.starCol}>
            <Text variant="caption" color="muted">Typical Mood</Text>
            <StarRow level={content.typicalMood} color={meta.fg} />
          </View>
        </View>

        <View>
          <Text variant="bodySmall" style={styles.subheading}>Mood Today</Text>
          {todayMood ? (
            <View style={styles.moodTodayRow}>
              <Text style={styles.moodEmoji}>{moodEmoji}</Text>
              <Text variant="body" style={styles.moodLabel}>{todayMood.mood}</Text>
              <Text variant="caption" color="muted" style={styles.moodIntensity}>
                Intensity {intensityDots}
              </Text>
            </View>
          ) : (
            <Pressable onPress={onLogToday} style={styles.moodLogPrompt}>
              <Text variant="body" color="secondary">—  </Text>
              <Text variant="body" style={{ color: meta.fg, fontWeight: '600' }}>Log it</Text>
            </Pressable>
          )}
        </View>

        {content.actionableSigns.length > 0 && (
          <View>
            <Text variant="bodySmall" style={styles.subheading}>Physical Signs to Check</Text>
            <View style={styles.chipRow}>
              {content.actionableSigns.map((sign) => {
                const selected = tappedSigns.includes(sign);
                return (
                  <Pressable
                    key={sign}
                    onPress={() => toggleSign(sign)}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? meta.fg : palette.gray100,
                        backgroundColor: selected ? meta.fg + '22' : 'transparent',
                      },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                  >
                    <Text variant="caption" style={{ color: selected ? meta.fg : palette.gray700 }}>
                      {selected ? '✓ ' : ''}{sign}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {content.infoSigns.length > 0 && (
          <View>
            <Text variant="bodySmall" style={styles.subheading}>What to Watch For</Text>
            {content.infoSigns.map((sign) => (
              <Text key={sign} variant="caption" color="secondary" style={styles.infoBullet}>
                • {sign}
              </Text>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text variant="h3">What You Can Do</Text>

        <View>
          <Text variant="bodySmall" style={styles.subheading}>🥗 Nutrition</Text>
          {content.nutrition.map((item) => (
            <Text key={item} variant="caption" color="secondary" style={styles.infoBullet}>
              • {item}
            </Text>
          ))}
        </View>

        <View>
          <Text variant="bodySmall" style={styles.subheading}>🏃 Exercise</Text>
          {content.exercise.map((item) => (
            <Text key={item} variant="caption" color="secondary" style={styles.infoBullet}>
              • {item}
            </Text>
          ))}
        </View>

        <View style={[styles.actionCallout, { backgroundColor: meta.bg + '66' }]}>
          <Text variant="bodySmall" style={{ fontWeight: '600' }}>💡 {content.action}</Text>
        </View>
      </View>

      {phaseKey === 'ovulation' && (
        <View style={styles.ovulationNote}>
          <Text variant="caption" color="secondary">
            Ovulation predicted around Day {ovulationDay} ({content.hormones[0]?.name} peak).
          </Text>
        </View>
      )}

      {showIrregularNote && (
        <View style={styles.irregularNote}>
          <Text variant="caption" style={{ color: palette.gray700 }}>
            Your last {cycleStats.lengths.length} cycles were {cycleStats.lengths.join(', ')} days.
            Because they vary by up to {cycleStats.stdDev} days, predicting ovulation is tricky —
            we recommend tracking cervical mucus or using ovulation tests for accuracy.
          </Text>
        </View>
      )}

      <Button
        label="Log today's symptoms for this phase"
        onPress={onLogToday}
        fullWidth
        size="lg"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  hero: { padding: 20, borderRadius: 20 },
  heroEmoji: { fontSize: 32 },
  heroLabel: { marginTop: 8 },
  heroRange: { marginTop: 4 },
  progressSection: { paddingHorizontal: 4 },
  progressLabel: { marginBottom: 6 },
  progressTrack: { height: 6, backgroundColor: palette.gray100, borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3 },
  section: { gap: 12 },
  starRowContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  starCol: { flex: 1 },
  starRow: { flexDirection: 'row', gap: 3 },
  star: { width: 14, height: 14, borderRadius: 3 },
  subheading: { fontWeight: '600', marginBottom: 6 },
  moodTodayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moodEmoji: { fontSize: 20 },
  moodLabel: { fontWeight: '600' },
  moodIntensity: { marginLeft: 4 },
  moodLogPrompt: { flexDirection: 'row', alignItems: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  infoBullet: { marginBottom: 2 },
  actionCallout: { padding: 12, borderRadius: 12 },
  ovulationNote: { backgroundColor: palette.accent50, padding: 12, borderRadius: 12 },
  irregularNote: { backgroundColor: palette.warning500 + '22', padding: 12, borderRadius: 12 },
});
