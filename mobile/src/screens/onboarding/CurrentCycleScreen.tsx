import React, { useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withSpring, withDelay, useSharedValue } from 'react-native-reanimated';

import { Button, DatePickerField, FormField, Text, ProgressDots, KeyboardAvoidingWrapper } from 'src/components/ui';
import { useTheme, palette, shadow } from 'src/theme';
import { currentCycleSchema, CurrentCycleForm } from 'src/validation';
import { useOnboardingStore } from 'src/stores';
import type { OnboardingStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<OnboardingStackParamList, 'CurrentCycle'>;

const SYMPTOM_OPTIONS = [
  { emoji: '😣', label: 'Cramps' },
  { emoji: '🫧', label: 'Bloating' },
  { emoji: '🤕', label: 'Headache' },
  { emoji: '😴', label: 'Fatigue' },
  { emoji: '😖', label: 'Acne' },
  { emoji: '🎭', label: 'Mood swings' },
  { emoji: 'BACK', label: 'Back pain' },
  { emoji: '🤢', label: 'Nausea' },
  { emoji: '🫠', label: 'Breast tenderness' },
  { emoji: '🌙', label: 'Insomnia' },
];

export function CurrentCycleScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const setCurrentCycle = useOnboardingStore((s) => s.setCurrentCycle);
  const periodLengthRef = useRef<TextInput>(null);
  const currentCycleStart = useOnboardingStore((s) => s.currentCycleStart);
  const currentPeriodLength = useOnboardingStore((s) => s.currentPeriodLength);
  const currentSymptoms = useOnboardingStore((s) => s.currentSymptoms);
  const defaults = { currentCycleStart: currentCycleStart ?? '', currentPeriodLength: currentPeriodLength ?? undefined, currentSymptoms: currentSymptoms };

  const { control, handleSubmit, formState, setValue, watch } = useForm<CurrentCycleForm>({
    resolver: zodResolver(currentCycleSchema),
    defaultValues: {
      cycleStartDate: defaults.currentCycleStart,
      periodLength: defaults.currentPeriodLength,
      symptoms: defaults.currentSymptoms,
    },
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

  const onSubmit = (data: CurrentCycleForm) => {
    setCurrentCycle({
      currentCycleStart: data.cycleStartDate,
      currentPeriodLength: data.periodLength,
      currentSymptoms: data.symptoms,
    });
    navigation.navigate('PastCycle1');
  };

  const headerScale = useSharedValue(0);
  const headerStyle = useAnimatedStyle(() => ({ transform: [{ scale: headerScale.value }] }));
  React.useEffect(() => {
    headerScale.value = withDelay(100, withSpring(1, { damping: 12 }));
  }, [headerScale]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={[palette.primary500, palette.primary700, palette.accent500]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGrad}
      >
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Go back" style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <ProgressDots current={3} total={6} color="rgba(255,255,255,0.5)" activeColor="#fff" />
          <Animated.View style={[styles.headerIcon, headerStyle]}>
            <Text style={styles.headerEmoji}>🌸</Text>
          </Animated.View>
          <Text variant="h1" color="inverse" align="center" style={styles.headerTitle}>
            Your most recent period
          </Text>
          <Text variant="body" color="inverse" align="center" style={styles.headerSub}>
            When did it start? This helps us predict your next one.
          </Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, shadow.soft, { backgroundColor: theme.colors.surface }]}>
          <DatePickerField control={control} name="cycleStartDate" label="📅 Period start date" maximumDate={new Date()} />

          <View style={styles.ongoingNote}>
            <Text variant="caption" color="accent" style={styles.ongoingText}>
              Ongoing 🔄 — we'll calculate this when your next period starts
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <FormField inputRef={periodLengthRef} control={control} name="periodLength" label="💧 Period length" placeholder="e.g. 5" keyboardType="numeric" returnKeyType="done" />
            <Text variant="caption" color="muted" style={styles.helper}>
              How many days you actually bled (e.g. 5 days)
            </Text>
          </View>
        </View>

        <View style={[styles.card, shadow.soft, { backgroundColor: theme.colors.surface }]}>
          <Text variant="h3" style={styles.symptomTitle}>Any symptoms?</Text>
          <Text variant="caption" color="muted" style={styles.symptomSub}>
            Tap to select — helps us understand how you feel
          </Text>
          <View style={styles.symptomGrid}>
            {SYMPTOM_OPTIONS.map((s) => {
              const sel = (selectedSymptoms || []).includes(s.label);
              return (
                <TouchableOpacity
                  key={s.label}
                  style={[
                    styles.symptomChip,
                    sel ? styles.symptomChipActive : styles.symptomChipInactive,
                  ]}
                  onPress={() => toggleSymptom(s.label)}
                  accessibilityLabel={`Symptom: ${s.label}, ${sel ? 'selected' : 'not selected'}`}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: sel }}
                >
                   <Text variant="emoji">{s.emoji}</Text>
                  <Text variant="caption" color={sel ? 'primary' : 'secondary'} style={styles.symptomLabel}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.footer}>
          <Button label="Continue" onPress={handleSubmit(onSubmit)} disabled={!formState.isValid} fullWidth size="lg" />
        </View>
      </KeyboardAvoidingWrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerGrad: {
    paddingTop: 8,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerInner: { paddingHorizontal: 24, alignItems: 'center' },
  backBtn: {
    position: 'absolute',
    left: 24,
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { color: '#fff', fontSize: 18 },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerEmoji: { fontSize: 36 },
  headerTitle: { fontSize: 22, marginBottom: 6 },
  headerSub: { opacity: 0.85, lineHeight: 20, paddingHorizontal: 16 },
  scrollContent: { paddingTop: 20, paddingBottom: 32 },
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 20,
  },
  fieldGroup: { marginBottom: 4 },
  ongoingNote: {
    backgroundColor: palette.accent50,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  ongoingText: {
    fontWeight: '600',
  },
  helper: {
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  symptomTitle: { marginBottom: 2 },
  symptomSub: { marginBottom: 12 },
  symptomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  symptomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderRadius: 999,
  },
  symptomChipActive: {
    backgroundColor: palette.primary100,
    borderColor: palette.primary500,
  },
  symptomChipInactive: {
    backgroundColor: 'transparent',
    borderColor: palette.gray100,
  },
  symptomEmoji: { fontSize: 14 },
  symptomLabel: { marginLeft: 4 },
  footer: { paddingHorizontal: 20, marginTop: 4 },
});
