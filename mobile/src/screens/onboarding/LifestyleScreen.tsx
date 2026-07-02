import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Slider from '@react-native-community/slider';

import { Button, Text, ProgressDots } from 'src/components/ui';
import { useTheme, shadow } from 'src/theme';
import { lifestyleSchema, LifestyleForm } from 'src/validation';
import { useOnboardingStore } from 'src/stores';
import type { OnboardingStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<OnboardingStackParamList, 'Lifestyle'>;

const STYLES_LABELS = ['low', 'moderate', 'high'] as const;
const STRESS_LABELS = ['Low', 'Moderate', 'High'];
const EXERCISE_LABELS = ['Light', 'Moderate', 'Heavy'];
const DIET_LABELS = ['Balanced', 'Normal', 'Junk'];
const DIET_VALUES = ['balanced', 'normal', 'junk'] as const;

function ToggleGroup({ value, options, labels, onChange }: { value: string; options: readonly string[]; labels: string[]; onChange: (v: any) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.toggleRow}>
      {options.map((opt, i) => {
        const sel = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.toggle, { backgroundColor: sel ? theme.colors.primary : theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.md }]}
            onPress={() => onChange(opt)}
            accessibilityLabel={labels[i]}
            accessibilityRole="radio"
            accessibilityState={{ selected: sel }}
          >
            <Text variant="bodySmall" color={sel ? 'inverse' : 'primary'} align="center">{labels[i]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function LifestyleScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const setLifestyle = useOnboardingStore((s) => s.setLifestyle);
  const stressLevel = useOnboardingStore((s) => s.stressLevel);
  const exerciseFrequency = useOnboardingStore((s) => s.exerciseFrequency);
  const sleepHours = useOnboardingStore((s) => s.sleepHours);
  const diet = useOnboardingStore((s) => s.diet);
  const defaults = { stressLevel: stressLevel ?? undefined, exerciseFrequency: exerciseFrequency ?? undefined, sleepHours: sleepHours ?? undefined, diet: diet ?? undefined };

  const { control, handleSubmit, formState, watch } = useForm<LifestyleForm>({
    resolver: zodResolver(lifestyleSchema),
    defaultValues: defaults,
    mode: 'onChange',
  });
  const sleepValue = watch('sleepHours');

  const onSubmit = (data: LifestyleForm) => {
    setLifestyle(data);
    navigation.navigate('CurrentCycle');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ProgressDots current={2} total={6} />
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Go back">
              <Text variant="body" color="primary">← Back</Text>
            </TouchableOpacity>
            <Text variant="h2" style={{ marginTop: 8 }}>Your lifestyle</Text>
            <Text variant="body" color="secondary">These help us improve predictions.</Text>
          </View>

          <View style={[styles.card, shadow.lg, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, marginHorizontal: theme.spacing.lg, padding: theme.spacing.xl }]}>
            <Text variant="body" style={{ marginBottom: 8 }}>Stress level</Text>
            <Controller control={control} name="stressLevel" render={({ field: { onChange, value } }) => (
              <ToggleGroup value={value!} options={STYLES_LABELS} labels={STRESS_LABELS} onChange={onChange} />
            )} />

            <View style={{ height: 20 }} />

            <Text variant="body" style={{ marginBottom: 8 }}>Exercise frequency</Text>
            <Controller control={control} name="exerciseFrequency" render={({ field: { onChange, value } }) => (
              <ToggleGroup value={value!} options={STYLES_LABELS} labels={EXERCISE_LABELS} onChange={onChange} />
            )} />

            <View style={{ height: 20 }} />

            <Text variant="body" style={{ marginBottom: 8 }}>Sleep: <Text variant="body" color="primary" style={{ fontWeight: '600' }}>{sleepValue ?? 7} hours</Text></Text>
            <Controller control={control} name="sleepHours" render={({ field: { onChange, value } }) => (
              <View>
                <Slider
                  minimumValue={4}
                  maximumValue={12}
                  step={0.5}
                  value={value ?? 7}
                  onValueChange={onChange}
                  minimumTrackTintColor={theme.colors.primary}
                  maximumTrackTintColor={theme.colors.border}
                  thumbTintColor={theme.colors.primary}
                  style={{ height: 40 }}
                />
                <View style={styles.sliderLabels}>
                  {[4, 6, 8, 10, 12].map((h) => (
                    <Text key={h} variant="caption" color="muted">{h}h</Text>
                  ))}
                </View>
              </View>
            )} />

            <View style={{ height: 20 }} />

            <Text variant="body" style={{ marginBottom: 8 }}>Diet</Text>
            <Controller control={control} name="diet" render={({ field: { onChange, value } }) => (
              <ToggleGroup value={value!} options={DIET_VALUES} labels={DIET_LABELS} onChange={onChange} />
            )} />
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
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: { flex: 1, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
});