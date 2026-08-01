import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { format } from 'date-fns';

import { useTheme } from 'src/theme';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
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
  onSaveSymptoms: () => void;
  symptomsLoading?: boolean;
  mood: string | null;
  onSelectMood: (mood: string) => void;
  onSaveMood: () => void;
  moodLoading?: boolean;
  noteText: string;
  onChangeNote: (text: string) => void;
  onSaveNote: () => void;
  noteLoading?: boolean;
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
  onSaveSymptoms,
  symptomsLoading,
  mood,
  onSelectMood,
  onSaveMood,
  moodLoading,
  noteText,
  onChangeNote,
  onSaveNote,
  noteLoading,
}: DayDetailSheetProps) {
  const theme = useTheme();
  const canLogSymptoms = coveringEntry != null;

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
          <View style={styles.section}>
            <Text variant="bodySmall" color="secondary" style={styles.sectionLabel}>
              Symptoms
            </Text>
            <SymptomGrid selected={symptoms} onToggle={onToggleSymptom} symptoms={['Cramps', 'Bloating', 'Headache', 'Fatigue', 'Nausea', 'Backache', 'Breast tenderness', 'Acne']} />
            <Button label="Save symptoms" onPress={onSaveSymptoms} loading={symptomsLoading} fullWidth size="md" style={{ marginTop: theme.spacing.sm }} />
          </View>
        ) : (
          <Text variant="caption" color="muted" style={styles.hint}>
            Symptoms can only be logged on days within a logged period.
          </Text>
        )}

        <View style={styles.section}>
          <Text variant="bodySmall" color="secondary" style={styles.sectionLabel}>
            How was your mood?
          </Text>
          <MoodPicker selected={mood} onSelect={onSelectMood} />
          <Button label="Save mood" onPress={onSaveMood} disabled={!mood} loading={moodLoading} fullWidth size="md" style={{ marginTop: theme.spacing.sm }} />
        </View>

        <View style={styles.section}>
          <Text variant="bodySmall" color="secondary" style={styles.sectionLabel}>
            Add a note
          </Text>
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
          <Button label="Save note" onPress={onSaveNote} disabled={!noteText.trim()} loading={noteLoading} fullWidth size="md" style={{ marginTop: theme.spacing.sm }} />
        </View>
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
  section: { gap: 4 },
  sectionLabel: { marginBottom: 8 },
  hint: { opacity: 0.8 },
  noteInput: {
    borderWidth: 1.5,
    padding: 14,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
