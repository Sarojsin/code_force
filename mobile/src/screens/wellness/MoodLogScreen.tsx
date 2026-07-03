import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';

import { Button, Card, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { logger } from 'src/utils';
import { wellnessService } from 'src/services/api/wellness';
import type { WellnessStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<WellnessStackParamList, 'MoodLog'>;

const MOODS = [
  { emoji: '😊', label: 'Happy', color: '#D1FAE5' },
  { emoji: '😐', label: 'Neutral', color: '#FEF3C7' },
  { emoji: '😢', label: 'Sad', color: '#BFDBFE' },
  { emoji: '😠', label: 'Angry', color: '#FEE2E2' },
  { emoji: '😰', label: 'Anxious', color: '#EDE9FE' },
  { emoji: '😴', label: 'Tired', color: '#E5E7EB' },
  { emoji: '🥰', label: 'Loved', color: '#FCE7F3' },
  { emoji: '💪', label: 'Motivated', color: '#DCFCE7' },
];

export function MoodLogScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [notes, setNotes] = useState('');

  const mutation = useMutation({
    mutationFn: (data: { mood: string; intensity: number; notes?: string }) =>
      wellnessService.createMoodLog(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellness', 'mood'] });
      Toast.show({ type: 'success', text1: 'Mood logged!' });
      navigation.goBack();
    },
    onError: (err) => {
      logger.error('MoodLogScreen.save.failed', err);
      Toast.show({ type: 'error', text1: 'Failed to save mood' });
    },
  });

  const handleSave = () => {
    if (!selectedMood) return;
    mutation.mutate({ mood: selectedMood, intensity, notes: notes || undefined });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>How are you feeling?</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>Tap a mood to log it.</Txt>

        <View style={styles.grid}>
          {MOODS.map(m => {
            const isSelected = selectedMood === m.label;
            return (
              <Pressable
                key={m.label}
                onPress={() => setSelectedMood(m.label)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={m.label}
                style={[
                  styles.moodBtn,
                  {
                    backgroundColor: isSelected ? m.color : theme.colors.surface,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    borderRadius: theme.radius.lg,
                  },
                ]}
              >
                <Txt variant="h2">{m.emoji}</Txt>
                <Txt variant="caption" color="primary" style={{ marginTop: 4 }}>{m.label}</Txt>
              </Pressable>
            );
          })}
        </View>

        {selectedMood && (
          <Card style={{ marginTop: theme.spacing.xl }}>
            <Txt variant="bodySmall" color="secondary" style={{ marginBottom: theme.spacing.sm }}>Intensity: {intensity}</Txt>
            <View style={styles.sliderRow}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <Pressable
                  key={n}
                  onPress={() => setIntensity(n)}
                  accessibilityLabel={`Intensity ${n}`}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: n <= intensity ? theme.colors.primary : theme.colors.border,
                      width: n === intensity ? 32 : 20,
                      height: n === intensity ? 32 : 20,
                      borderRadius: 16,
                    },
                  ]}
                />
              ))}
            </View>

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add a note (optional)"
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.notesInput, { borderColor: theme.colors.border, color: theme.colors.textPrimary, borderRadius: theme.radius.md }]}
              accessibilityLabel="Mood note"
            />
          </Card>
        )}

        <View style={{ height: theme.spacing.xl }} />
        <Button
          label={mutation.isPending ? 'Saving...' : 'Save mood'}
          onPress={handleSave}
          disabled={!selectedMood || mutation.isPending}
          fullWidth
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  moodBtn: { width: '23%', alignItems: 'center', paddingVertical: 12, borderWidth: 1, marginBottom: 12, minHeight: 72, justifyContent: 'center' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dot: { alignItems: 'center', justifyContent: 'center' },
  notesInput: { borderWidth: 1, marginTop: 12, padding: 12, fontSize: 14, minHeight: 44 },
});
