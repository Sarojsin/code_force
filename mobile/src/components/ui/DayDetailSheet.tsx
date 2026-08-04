import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from 'src/theme';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Card } from './Card';
import { MoodPicker } from './MoodPicker';
import { SymptomGrid } from './SymptomGrid';
import { Text } from './Text';
import type { CycleEntry } from 'src/services/api';

export interface DayPhase {
  emoji: string;
  label: string;
  color: string;
  description: string;
}

export interface DayDetailSheetProps {
  visible: boolean;
  date: Date;
  phase: DayPhase;
  coveringEntry: CycleEntry | null;
  onClose: () => void;
  onFlagStart: (date: Date) => void;
  onFlagEnd: (date: Date) => void;
  symptoms: string[];
  onToggleSymptom: (symptom: string) => void;
  mood: string | null;
  onSelectMood: (mood: string) => void;
  noteText: string;
  onChangeNote: (text: string) => void;
  onDone: () => void;
  doneLoading?: boolean;
}

const SYMPTOM_OPTIONS = ['Cramps', 'Bloating', 'Headache', 'Fatigue', 'Nausea', 'Backache', 'Breast tenderness', 'Acne'];

function SectionCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Card variant="glass" style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIconWrap, { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.md }]}>
          <Text style={styles.sectionIcon}>{icon}</Text>
        </View>
        <Text variant="body" style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </Card>
  );
}

export function DayDetailSheet({
  visible,
  date,
  phase,
  coveringEntry,
  onClose,
  onFlagStart,
  onFlagEnd,
  symptoms,
  onToggleSymptom,
  mood,
  onSelectMood,
  noteText,
  onChangeNote,
  onDone,
  doneLoading,
}: DayDetailSheetProps) {
  const theme = useTheme();
  const canLogSymptoms = coveringEntry != null;
  const hasInput = mood != null || symptoms.length > 0 || noteText.trim().length > 0;

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.content}>
        <LinearGradient
          colors={['#FF6B8A', '#D4507A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, theme.shadow.primary]}
        >
          <Text style={styles.heroDate}>{format(date, 'EEEE, MMMM d')}</Text>
          <View style={styles.heroPhaseRow}>
            <Text variant="emoji" style={styles.heroPhaseEmoji}>{phase.emoji}</Text>
            <Text style={styles.heroPhaseLabel}>{phase.label}</Text>
          </View>
          <Text style={styles.heroPhaseDesc}>{phase.description}</Text>
        </LinearGradient>

        <View style={styles.flagRow}>
          <Button
            label={`🩸  Start Period`}
            size="lg"
            onPress={() => onFlagStart(date)}
            style={styles.flagBtn}
          />
          <Button
            label={`✅  End Period`}
            size="lg"
            variant="outline"
            onPress={() => onFlagEnd(date)}
            style={styles.flagBtn}
          />
        </View>

        {canLogSymptoms ? (
          <SectionCard icon="🤍" title="Symptoms">
            <SymptomGrid selected={symptoms} onToggle={onToggleSymptom} symptoms={SYMPTOM_OPTIONS} />
          </SectionCard>
        ) : (
          <Card variant="glass" style={styles.sectionCard}>
            <Text variant="caption" color="muted" style={styles.hint}>
              Symptoms can only be logged on days within a logged period.
            </Text>
          </Card>
        )}

        <SectionCard icon="💫" title="How was your mood?">
          <MoodPicker selected={mood} onSelect={onSelectMood} />
        </SectionCard>

        <SectionCard icon="📝" title="Add a note">
          <TextInput
            value={noteText}
            onChangeText={onChangeNote}
            placeholder="Write a note for this day..."
            placeholderTextColor={theme.colors.textMuted}
            multiline
            accessibilityLabel="Note for this day"
            style={[
              styles.noteInput,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                color: theme.colors.textPrimary,
                borderRadius: theme.radius.lg,
              },
            ]}
          />
        </SectionCard>

        <Button
          label="Done"
          onPress={onDone}
          disabled={!hasInput}
          loading={doneLoading}
          fullWidth
          size="lg"
          style={styles.doneBtn}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  hero: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 24,
  },
  heroDate: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    fontFamily: 'Playfair Display',
    color: '#FFFFFF',
  },
  heroPhaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  heroPhaseEmoji: { fontSize: 18 },
  heroPhaseLabel: { fontSize: 15, fontWeight: '700', letterSpacing: 0.4, color: '#FFFFFF' },
  heroPhaseDesc: { fontSize: 13, lineHeight: 18, marginTop: 6, color: 'rgba(255,255,255,0.92)' },
  flagRow: { flexDirection: 'row', gap: 10 },
  flagBtn: { flex: 1 },
  sectionCard: {
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontWeight: '600' },
  hint: { opacity: 0.8 },
  noteInput: {
    borderWidth: 1.5,
    padding: 14,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  doneBtn: { marginTop: 4 },
});
