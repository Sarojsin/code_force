/**
 * LogPeriodScreen — log period start/end dates, flow, symptoms, mood, energy.
 */

import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Button, FormField, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useCreateCycleEntry } from 'src/services/queries';
import type { CycleStackParamList } from 'src/navigation/types';
import { z } from 'zod';

type Nav = StackNavigationProp<CycleStackParamList, 'LogPeriod'>;

const symptoms = ['Cramps', 'Bloating', 'Headache', 'Fatigue', 'Nausea', 'Backache', 'Breast tenderness', 'Acne'];
const moods = ['Happy', 'Sad', 'Irritable', 'Anxious', 'Calm', 'Tired', 'Energetic', 'Emotional'];
const flowLevels = ['Light', 'Medium', 'Heavy', 'Very Heavy'] as const;

const logPeriodSchema = z.object({
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  notes: z.string().optional(),
});
type LogPeriodForm = z.infer<typeof logPeriodSchema>;

export function LogPeriodScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { control, handleSubmit, formState } = useForm<LogPeriodForm>({
    resolver: zodResolver(logPeriodSchema),
    defaultValues: { startDate: new Date().toISOString().slice(0, 10), notes: '' },
    mode: 'onBlur',
  });
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [energyLevel, setEnergyLevel] = useState(5);
  const { mutate: createEntry, isPending } = useCreateCycleEntry();

  const toggleChip = (item: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const onSubmit = async (data: LogPeriodForm) => {
    createEntry({
      period_start_date: data.startDate,
      period_end_date: data.endDate || undefined,
      flow_intensity: selectedFlow,
      symptoms: selectedSymptoms,
      mood_tags: selectedMoods,
      energy_level: energyLevel,
      notes: data.notes,
    }, {
      onSuccess: () => navigation.goBack(),
      onError: () => {},
    });
  };

  const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => {
    const scale = useSharedValue(1);
    const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
    return (
      <Animated.View style={animStyle}>
        <Pressable
          onPressIn={() => { scale.value = withSpring(0.94); }}
          onPressOut={() => { scale.value = withSpring(1); }}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={label}
          style={[
            styles.chip,
            {
              backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
              borderColor: selected ? theme.colors.primary : theme.colors.border,
              borderRadius: theme.radius.pill,
            },
          ]}
        >
          <Txt variant="bodySmall" color={selected ? 'inverse' : 'primary'}>{label}</Txt>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { padding: theme.spacing.lg }]} keyboardShouldPersistTaps="handled">
          <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>Log Period</Txt>
          <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>Track your cycle details.</Txt>

          <FormField control={control} name="startDate" label="Start date" placeholder="YYYY-MM-DD" accessibilityLabel="Period start date" />
          <View style={{ height: theme.spacing.md }} />
          <FormField control={control} name="endDate" label="End date (optional)" placeholder="YYYY-MM-DD" accessibilityLabel="Period end date" />

          <Txt variant="bodySmall" color="secondary" style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm }}>Flow intensity</Txt>
          <View style={styles.chipRow}>
            {flowLevels.map(f => (
              <Chip key={f} label={f} selected={selectedFlow === f} onPress={() => setSelectedFlow(f)} />
            ))}
          </View>

          <Txt variant="bodySmall" color="secondary" style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm }}>Symptoms</Txt>
          <View style={styles.chipRow}>
            {symptoms.map(s => (
              <Chip key={s} label={s} selected={selectedSymptoms.includes(s)} onPress={() => toggleChip(s, selectedSymptoms, setSelectedSymptoms)} />
            ))}
          </View>

          <Txt variant="bodySmall" color="secondary" style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm }}>Mood tags</Txt>
          <View style={styles.chipRow}>
            {moods.map(m => (
              <Chip key={m} label={m} selected={selectedMoods.includes(m)} onPress={() => toggleChip(m, selectedMoods, setSelectedMoods)} />
            ))}
          </View>

          <Txt variant="bodySmall" color="secondary" style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm }}>Energy level: {energyLevel}</Txt>
          <View style={styles.sliderRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <Pressable
                key={n}
                onPress={() => setEnergyLevel(n)}
                accessibilityLabel={`Energy level ${n}`}
                style={[
                  styles.dot,
                  {
                    backgroundColor: n <= energyLevel ? theme.colors.primary : theme.colors.border,
                    width: n === energyLevel ? 32 : 24,
                    height: n === energyLevel ? 32 : 24,
                    borderRadius: 16,
                  },
                ]}
              />
            ))}
          </View>

          <View style={{ height: theme.spacing.lg }} />
          <Button label={isPending ? 'Saving...' : 'Save period log'} onPress={handleSubmit(onSubmit)} disabled={!formState.isValid || isPending} fullWidth />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, minHeight: 44, justifyContent: 'center' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  dot: { alignItems: 'center', justifyContent: 'center' },
});
