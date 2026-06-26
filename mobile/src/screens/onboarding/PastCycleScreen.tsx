import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { Button, DatePickerField, FormField, Text, ProgressDots } from 'src/components/ui';
import { useTheme, shadow } from 'src/theme';
import { pastCycleSchema, PastCycleForm } from 'src/validation';
import { useOnboardingStore } from 'src/stores';
import type { OnboardingStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<OnboardingStackParamList, 'PastCycle1'>;
type Route = RouteProp<OnboardingStackParamList, 'PastCycle1'>;

const SYMPTOM_OPTIONS = [
  'Cramps', 'Bloating', 'Headache', 'Fatigue', 'Acne',
  'Mood swings', 'Back pain', 'Nausea', 'Breast tenderness', 'Insomnia',
];

const CYCLE_NUM_MAP: Record<string, number> = { PastCycle1: 1, PastCycle2: 2, PastCycle3: 3 };
const NEXT_MAP: Record<string, any> = { PastCycle1: 'PastCycle2', PastCycle2: 'PastCycle3', PastCycle3: 'Complete' };
const PREV_MAP: Record<string, any> = { PastCycle1: 'CurrentCycle', PastCycle2: 'PastCycle1', PastCycle3: 'PastCycle2' };

export function PastCycleScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const addPastCycle = useOnboardingStore((s) => s.addPastCycle);

  const cycleNum = CYCLE_NUM_MAP[route.name] || 1;
  const nextScreen = NEXT_MAP[route.name] || 'Complete';
  const prevScreen = PREV_MAP[route.name] || 'CurrentCycle';

  const { control, handleSubmit, formState, setValue, watch } = useForm<PastCycleForm>({
    resolver: zodResolver(pastCycleSchema),
    defaultValues: { cycleStart: '', cycleLength: undefined as any, periodLength: undefined as any, symptoms: [] },
    mode: 'onBlur',
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

  const onSubmit = (data: PastCycleForm) => {
    addPastCycle({
      cycle_start: data.cycleStart,
      cycle_length: data.cycleLength,
      period_length: data.periodLength,
      symptoms: data.symptoms,
    });
    navigation.navigate(nextScreen as any);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ProgressDots current={3 + cycleNum} total={6} />
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.navigate(prevScreen as any)} accessibilityLabel="Go back">
              <Text variant="body" color="primary">← Back</Text>
            </TouchableOpacity>
            <Text variant="h2" style={{ marginTop: 8 }}>Past cycle {cycleNum} of 3</Text>
            <Text variant="body" color="secondary">Optional — helps improve accuracy.</Text>
          </View>

          <View style={[styles.card, shadow.lg, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, marginHorizontal: theme.spacing.lg, padding: theme.spacing.xl }]}>
            <DatePickerField control={control} name="cycleStart" label="Start date" maximumDate={new Date()} />
            <FormField control={control} name="cycleLength" label="Cycle length (days)" placeholder="e.g. 28" keyboardType="numeric" />
            <FormField control={control} name="periodLength" label="Period length (days)" placeholder="e.g. 5" keyboardType="numeric" />

            <Text variant="body" style={{ marginTop: 16, marginBottom: 8 }}>Symptoms</Text>
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
            <Button
              label={cycleNum === 3 ? 'Complete' : 'Continue'}
              onPress={handleSubmit(onSubmit)}
              disabled={!formState.isValid}
              fullWidth
              size="lg"
            />
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