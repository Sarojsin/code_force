import React, { Component, ErrorInfo, ReactNode, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Pressable } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, { useAnimatedStyle, withSpring, withDelay, useSharedValue } from 'react-native-reanimated';
import { logger } from 'src/utils';

import { Button, FormField, PickerField, Text, ProgressDots, KeyboardAvoidingWrapper } from 'src/components/ui';
import { useTheme } from 'src/theme';

import { personalInfoSchema, PersonalInfoForm } from 'src/validation';
import { StackNavigationProp } from '@react-navigation/stack';
import { useOnboardingStore } from 'src/stores';
import type { OnboardingStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<OnboardingStackParamList, 'PersonalInfo'>;

const HEIGHT_OPTIONS = Array.from({ length: 201 }, (_, i) => ({ label: `${i + 50} cm`, value: i + 50 }));
const WEIGHT_OPTIONS = Array.from({ length: 281 }, (_, i) => ({ label: `${i + 20} kg`, value: i + 20 }));

const CONTRACEPTION_OPTIONS = ['None', 'Pill', 'IUD', 'Implant', 'Other'];

class ScreenErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('PersonalInfoScreen.crash', { message: error.message, stack: error.stack, componentStack: info.componentStack });
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function PersonalInfoScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const setPersonalInfo = useOnboardingStore((s) => s.setPersonalInfo);
  const age = useOnboardingStore((s) => s.age);
  const heightCm = useOnboardingStore((s) => s.heightCm);
  const weightKg = useOnboardingStore((s) => s.weightKg);
  const defaults = { age: age ?? undefined, heightCm: heightCm ?? undefined, weightKg: weightKg ?? undefined };
  const [contraception, setContraception] = React.useState<string | null>(null);

  const { control, handleSubmit, formState } = useForm<PersonalInfoForm>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: { age: defaults.age, heightCm: defaults.heightCm, weightKg: defaults.weightKg },
    mode: 'onBlur',
  });

  const onSubmit = (data: PersonalInfoForm) => {
    setPersonalInfo(data);
    navigation.navigate('Lifestyle');
  };

  const iconScale = useSharedValue(0);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  useEffect(() => { iconScale.value = withDelay(100, withSpring(1, { damping: 12 })); }, []);

  return (
    <ScreenErrorBoundary>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
        <KeyboardAvoidingWrapper contentContainerStyle={{ paddingBottom: 32 }}>
          <ProgressDots current={1} total={6} />
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Go back">
              <Text variant="body" color="primary">← Back</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              <Animated.View style={[styles.stepIcon, { backgroundColor: theme.colors.primary + '22', borderRadius: 30 }, iconStyle]}>
                <Text style={{ fontSize: 32 }}>👤</Text>
              </Animated.View>
              <View style={{ marginLeft: 12 }}>
                <Text variant="h2">About you</Text>
                <Text variant="body" color="secondary">Help us personalize your experience.</Text>
              </View>
            </View>
          </View>
          <View style={[styles.card, { backgroundColor: theme.colors.surface, borderRadius: 20, marginHorizontal: 24, padding: 20 }]}>
            <FormField control={control} name="age" label="Age" placeholder="e.g. 28" keyboardType="numeric" />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <PickerField control={control} name="heightCm" label="Height" items={HEIGHT_OPTIONS} />
              </View>
              <View style={{ flex: 1 }}>
                <PickerField control={control} name="weightKg" label="Weight" items={WEIGHT_OPTIONS} />
              </View>
            </View>
            <Text variant="body" color="muted" style={{ fontSize: 12, letterSpacing: 0.5, marginTop: 16, marginBottom: 8 }}>CONTRACEPTION</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CONTRACEPTION_OPTIONS.map((opt) => {
                const selected = contraception === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setContraception(opt)}
                    style={[
                      styles.contraceptionChip,
                      { borderRadius: 100 },
                      selected ? { backgroundColor: theme.colors.primary } : { backgroundColor: 'rgba(0,0,0,0.04)' },
                    ]}
                  >
                    <Text variant="body" style={{ color: selected ? '#fff' : theme.colors.textSoft, fontSize: 13 }}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.footer}>
            <Button label="Continue" onPress={handleSubmit(onSubmit)} disabled={!formState.isValid} fullWidth size="lg" />
          </View>
        </KeyboardAvoidingWrapper>
      </SafeAreaView>
    </ScreenErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  stepIcon: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  card: { marginBottom: 24 },
  footer: { paddingHorizontal: 24 },
  contraceptionChip: { paddingHorizontal: 14, paddingVertical: 8 },
});
