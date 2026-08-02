import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { format } from 'date-fns';

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
    <BottomSheet visible={visible} onClose={onClose} title={format(date, 'EEEE, MMMM d, yyyy')}>
      <View style={styles.content}>
        <View style={[styles.phaseRow, { backgroundColor: phase.color + '22', borderRadius: theme.radius.md }]}>
          <Text style={styles.phaseEmoji}>{phase.emoji}</Text>
          <View style={styles.phaseTextWrap}>
            <Text variant="body" style={styles.phaseTitle}>{phase.label}</Text>
            <Text variant="caption" color="muted">{phase.description}</Text>
          </View>
        </View>

        <View style={styles.flagRow}>
          <Button
            label={`🩸  Start Period`}
            size="md"
            onPress={() => onFlagStart(date)}
            style={styles.flagBtn}
          />
          <Button
            label={`✅  End Period`}
            size="md"
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
  phaseRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  phaseEmoji: { fontSize: 20 },
  phaseTextWrap: { flex: 1, marginLeft: 10 },
  phaseTitle: { fontWeight: '600' },
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
