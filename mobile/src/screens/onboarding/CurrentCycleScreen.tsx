import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { Button, DatePickerField, FormField, Text, ProgressDots } from 'src/components/ui';
import { useTheme, shadow } from 'src/theme';
import { currentCycleSchema, CurrentCycleForm } from 'src/validation';
import { useOnboardingStore } from 'src/stores';
import type { OnboardingStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<OnboardingStackParamList, 'CurrentCycle'>;

const SYMPTOM_OPTIONS = [
  'Cramps', 'Bloating', 'Headache', 'Fatigue', 'Acne',
  'Mood swings', 'Back pain', 'Nausea', 'Breast tenderness', 'Insomnia',
];

export function CurrentCycleScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const setCurrentCycle = useOnboardingStore((s) => s.setCurrentCycle);
  const currentCycleStart = useOnboardingStore((s) => s.currentCycleStart);
  const currentCycleLength = useOnboardingStore((s) => s.currentCycleLength);
  const currentPeriodLength = useOnboardingStore((s) => s.currentPeriodLength);
  const currentSymptoms = useOnboardingStore((s) => s.currentSymptoms);
  const defaults = { currentCycleStart: currentCycleStart ?? '', currentCycleLength: currentCycleLength ?? undefined, currentPeriodLength: currentPeriodLength ?? undefined, currentSymptoms: currentSymptoms };

  const { control, handleSubmit, formState, setValue, watch } = useForm<CurrentCycleForm>({
    resolver: zodResolver(currentCycleSchema),
    defaultValues: {
      cycleStartDate: defaults.currentCycleStart,
      cycleLength: defaults.currentCycleLength,
      periodLength: defaults.currentPeriodLength,
      symptoms: defaults.currentSymptoms,
    },
    mode: 'onChange',
  });

  const selectedSymptoms = watch('symptoms');

  const toggleSymptom = (s: string) => {
    const current = selectedSymptoms || [];
    if (current.includes(s)) {
      setValue('symptoms', current.filter((x) => x !== s), { shouldValidate: true });
    } else {
      setValue('symptoms', [...current, s], { shouldValidate: true });
    }
  };

  const onSubmit = (data: CurrentCycleForm) => {
    setCurrentCycle({
      currentCycleStart: data.cycleStartDate,
      currentCycleLength: data.cycleLength,
      currentPeriodLength: data.periodLength,
      currentSymptoms: data.symptoms,
    });
    navigation.navigate('PastCycle1');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ProgressDots current={3} total={6} />
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Go back">
              <Text variant="body" color="primary">← Back</Text>
            </TouchableOpacity>
            <Text variant="h2" style={{ marginTop: 8 }}>Current cycle</Text>
            <Text variant="body" color="secondary">Tell us about your last period.</Text>
          </View>

          <View style={[styles.card, shadow.lg, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, marginHorizontal: theme.spacing.lg, padding: theme.spacing.xl }]}>
            <DatePickerField control={control} name="cycleStartDate" label="Period start date" maximumDate={new Date()} />
            <FormField control={control} name="cycleLength" label="Cycle length (days)" placeholder="e.g. 28" keyboardType="numeric" />
            <FormField control={control} name="periodLength" label="Period length (days)" placeholder="e.g. 5" keyboardType="numeric" />

            <Text variant="body" style={{ marginTop: 16, marginBottom: 8 }}>Symptoms (tap to select)</Text>
            <View style={styles.symptomGrid}>
              {SYMPTOM_OPTIONS.map((s) => {
                const sel = (selectedSymptoms || []).includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.symptomChip, { backgroundColor: sel ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}
                    onPress={() => toggleSymptom(s)}
                    accessibilityLabel={`Symptom: ${s}, ${sel ? 'selected' : 'not selected'}`}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: sel }}
                  >
                    <Text variant="caption" color={sel ? 'inverse' : 'primary'}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.footer}>
            <Button label="Continue" onPress={handleSubmit(onSubmit)} disabled={!formState.isValid} fullWidth size="lg" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  card: { marginBottom: 24 },
  footer: { paddingHorizontal: 24 },
  symptomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symptomChip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
});