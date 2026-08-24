/**
 * EditHealthScreen — update health/lifestyle fields (age, height, weight, stress, exercise, sleep, diet).
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { z } from 'zod';

import { Button, FormField, PickerField, KeyboardAvoidingWrapper, Text as Txt, ScreenSkeleton } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useOnboardingProfile, useUpdateLifestyle } from 'src/services/queries/onboarding';
import { logger } from 'src/utils';
import type { ProfileStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<ProfileStackParamList, 'EditHealth'>;

const healthSchema = z.object({
  age: z.coerce.number().min(13, 'Must be 13+').max(120),
  heightCm: z.coerce.number().min(50, 'Too low').max(250, 'Too high'),
  weightKg: z.coerce.number().min(20, 'Too low').max(300, 'Too high'),
  stressLevel: z.enum(['low', 'moderate', 'high']),
  exerciseFrequency: z.enum(['low', 'moderate', 'high']),
  sleepHours: z.coerce.number().min(0).max(24),
  diet: z.enum(['balanced', 'normal', 'junk']),
});
type HealthForm = z.infer<typeof healthSchema>;

const STRESS_ITEMS = [
  { label: 'Low', value: 'low' },
  { label: 'Moderate', value: 'moderate' },
  { label: 'High', value: 'high' },
];

const EXERCISE_ITEMS = [
  { label: 'Low (rarely)', value: 'low' },
  { label: 'Moderate (2-4x/week)', value: 'moderate' },
  { label: 'High (5x+/week)', value: 'high' },
];

const DIET_ITEMS = [
  { label: 'Balanced', value: 'balanced' },
  { label: 'Normal', value: 'normal' },
  { label: 'Junk / processed', value: 'junk' },
];

export function EditHealthScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();

  const { data, isPending } = useOnboardingProfile();
  const updateLifestyle = useUpdateLifestyle();

  const { control, handleSubmit, formState, reset } = useForm<HealthForm>({
    resolver: zodResolver(healthSchema),
    defaultValues: {
      age: 25,
      heightCm: 165,
      weightKg: 60,
      stressLevel: 'moderate',
      exerciseFrequency: 'moderate',
      sleepHours: 7,
      diet: 'balanced',
    },
    mode: 'onBlur',
  });

  useEffect(() => {
    if (!data) return;
    reset({
      age: data.age,
      heightCm: data.height_cm,
      weightKg: data.weight_kg,
      stressLevel: data.stress_level,
      exerciseFrequency: data.exercise_frequency,
      sleepHours: data.sleep_hours,
      diet: data.diet,
    });
  }, [data, reset]);

  const onSubmit = async (values: HealthForm) => {
    try {
      await updateLifestyle.mutateAsync({
        age: values.age,
        height_cm: values.heightCm,
        weight_kg: values.weightKg,
        stress_level: values.stressLevel,
        exercise_frequency: values.exerciseFrequency,
        sleep_hours: values.sleepHours,
        diet: values.diet,
      });
      navigation.goBack();
    } catch (err) {
      logger.error('EditHealthScreen.submit.failed', err);
    }
  };

  if (isPending) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <ScreenSkeleton variant="editor" count={3} label="Loading your health info…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingWrapper contentContainerStyle={{ padding: theme.spacing.lg }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Txt variant="bodySmall" color="secondary" style={{ marginBottom: theme.spacing.lg }}>
            Update your health info. Changes affect cycle prediction accuracy.
          </Txt>

          <FormField control={control} name="age" label="Age" keyboardType="numeric" accessibilityLabel="Age" />
          <View style={{ height: theme.spacing.sm }} />
          <FormField control={control} name="heightCm" label="Height (cm)" keyboardType="numeric" accessibilityLabel="Height" />
          <View style={{ height: theme.spacing.sm }} />
          <FormField control={control} name="weightKg" label="Weight (kg)" keyboardType="numeric" accessibilityLabel="Weight" />
          <View style={{ height: theme.spacing.sm }} />
          <FormField control={control} name="sleepHours" label="Sleep hours per night" keyboardType="numeric" accessibilityLabel="Sleep hours" />

          <View style={{ height: theme.spacing.md }} />
          <PickerField control={control} name="stressLevel" label="Stress level" items={STRESS_ITEMS} />
          <PickerField control={control} name="exerciseFrequency" label="Exercise frequency" items={EXERCISE_ITEMS} />
          <PickerField control={control} name="diet" label="Diet quality" items={DIET_ITEMS} />

          <View style={{ height: theme.spacing.xl }} />
          <Button
            label="Save changes"
            onPress={handleSubmit(onSubmit)}
            disabled={!formState.isValid || updateLifestyle.isPending}
            loading={updateLifestyle.isPending}
            fullWidth
          />
          <View style={{ height: theme.spacing.lg }} />
        </ScrollView>
      </KeyboardAvoidingWrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
