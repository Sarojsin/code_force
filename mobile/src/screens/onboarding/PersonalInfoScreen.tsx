import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { Button, FormField, PickerField, Text, ProgressDots } from 'src/components/ui';
import { useTheme, shadow } from 'src/theme';
import { personalInfoSchema, PersonalInfoForm } from 'src/validation';
import { useOnboardingStore } from 'src/stores';
import type { OnboardingStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<OnboardingStackParamList, 'PersonalInfo'>;

const HEIGHT_OPTIONS = Array.from({ length: 201 }, (_, i) => ({ label: `${i + 50} cm`, value: i + 50 }));
const WEIGHT_OPTIONS = Array.from({ length: 281 }, (_, i) => ({ label: `${i + 20} kg`, value: i + 20 }));

export function PersonalInfoScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const setPersonalInfo = useOnboardingStore((s) => s.setPersonalInfo);
  const age = useOnboardingStore((s) => s.age);
  const heightCm = useOnboardingStore((s) => s.heightCm);
  const weightKg = useOnboardingStore((s) => s.weightKg);
  const defaults = { age: age ?? undefined, heightCm: heightCm ?? undefined, weightKg: weightKg ?? undefined };

  const { control, handleSubmit, formState } = useForm<PersonalInfoForm>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: { age: defaults.age as any, heightCm: defaults.heightCm as any, weightKg: defaults.weightKg as any },
    mode: 'onBlur',
  });

  const onSubmit = (data: PersonalInfoForm) => {
    setPersonalInfo(data);
    navigation.navigate('Lifestyle');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ProgressDots current={1} total={6} />
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Go back">
              <Text variant="body" color="primary">← Back</Text>
            </TouchableOpacity>
            <Text variant="h2" style={{ marginTop: 8 }}>About you</Text>
            <Text variant="body" color="secondary">Help us personalize your experience.</Text>
          </View>
          <View style={[styles.card, shadow.lg, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, marginHorizontal: theme.spacing.lg, padding: theme.spacing.xl }]}>
            <FormField control={control} name="age" label="Age" placeholder="e.g. 28" keyboardType="numeric" />
            <PickerField control={control} name="heightCm" label="Height" items={HEIGHT_OPTIONS} />
            <PickerField control={control} name="weightKg" label="Weight" items={WEIGHT_OPTIONS} />
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
});