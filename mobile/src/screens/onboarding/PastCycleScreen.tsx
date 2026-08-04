import React, { useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, TextInput } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, withSpring, withDelay, useSharedValue } from 'react-native-reanimated';

import { Button, DatePickerField, FormField, Text, ProgressDots, KeyboardAvoidingWrapper } from 'src/components/ui';
import { useTheme, palette, shadow } from 'src/theme';
import { pastCycleSchema, PastCycleForm } from 'src/validation';
import { useOnboardingStore } from 'src/stores';
import type { OnboardingStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<OnboardingStackParamList, 'PastCycle1'>;
type Route = RouteProp<OnboardingStackParamList, 'PastCycle1'>;

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

const CYCLE_NUM_MAP: Record<string, number> = { PastCycle1: 1, PastCycle2: 2, PastCycle3: 3 };
const NEXT_MAP: Record<string, any> = { PastCycle1: 'PastCycle2', PastCycle2: 'PastCycle3', PastCycle3: 'Complete' };
const PREV_MAP: Record<string, any> = { PastCycle1: 'CurrentCycle', PastCycle2: 'PastCycle1', PastCycle3: 'PastCycle2' };

const PAST_EMOJIS = ['🌺', '🌻', '🌷'];

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(b).getTime() - new Date(a).getTime());
  return Math.round(ms / 86_400_000);
}

export function PastCycleScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const addPastCycle = useOnboardingStore((s) => s.addPastCycle);
  const currentCycleStart = useOnboardingStore((s) => s.currentCycleStart);
  const pastCycles = useOnboardingStore((s) => s.pastCycles);

  const cycleNum = CYCLE_NUM_MAP[route.name] || 1;
  const nextScreen = NEXT_MAP[route.name] || 'Complete';
  const prevScreen = PREV_MAP[route.name] || 'CurrentCycle';

  const periodLengthRef = useRef<TextInput>(null);

  const { control, handleSubmit, formState, setValue, watch } = useForm<PastCycleForm>({
    resolver: zodResolver(pastCycleSchema),
    defaultValues: { cycleStart: '', periodLength: undefined, symptoms: [] },
    mode: 'onBlur',
  });

  const selectedSymptoms = watch('symptoms');
  const thisCycleStart = watch('cycleStart');

  const gapDays = (() => {
    if (!thisCycleStart) return null;
    if (cycleNum === 1 && currentCycleStart) return daysBetween(thisCycleStart, currentCycleStart);
    if (cycleNum === 2 && pastCycles[0]) return daysBetween(thisCycleStart, pastCycles[0].cycle_start);
    if (cycleNum === 3 && pastCycles[1]) return daysBetween(thisCycleStart, pastCycles[1].cycle_start);
    return null;
  })();

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
      period_length: data.periodLength,
      symptoms: data.symptoms,
    });
    navigation.navigate(nextScreen as any);
  };

  const headerScale = useSharedValue(0);
  const headerStyle = useAnimatedStyle(() => ({ transform: [{ scale: headerScale.value }] }));
  React.useEffect(() => {
    headerScale.value = withDelay(100, withSpring(1, { damping: 12 }));
  }, [headerScale]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={[palette.accent500, palette.primary700, palette.primary500]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGrad}
      >
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.navigate(prevScreen as any)} accessibilityLabel="Go back" style={styles.backBtn}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <ProgressDots current={2 + cycleNum} total={6} color="rgba(255,255,255,0.5)" activeColor="#fff" />
          <Animated.View style={[styles.headerIcon, headerStyle]}>
            <Text style={styles.headerEmoji}>{PAST_EMOJIS[cycleNum - 1] || '🌺'}</Text>
          </Animated.View>
          <Text variant="h1" color="inverse" align="center" style={styles.headerTitle}>
            Previous period — {cycleNum} of 3
          </Text>
          <Text variant="body" color="inverse" align="center" style={styles.headerSub}>
            {cycleNum === 1
              ? "Remember your last period before this one? It makes predictions smarter."
              : cycleNum === 2
              ? "One more if you remember — or skip ahead!"
              : "Last one! Even rough guesses help a lot."}
          </Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingWrapper contentContainerStyle={styles.scrollContent}>
        <View style={[styles.card, shadow.soft, { backgroundColor: theme.colors.surface }]}>
          <DatePickerField control={control} name="cycleStart" label="📅 When did your period start?" maximumDate={new Date()} />

          {gapDays !== null && (
            <View style={styles.gapBadge}>
              <Text variant="caption" color="accent" style={styles.gapText}>
                📅 ~{gapDays} days until your next period
              </Text>
            </View>
          )}

          <View style={styles.infoBanner}>
            <Text variant="bodySmall" style={styles.infoBannerText}>
              💡 Don't remember the exact dates?{'\n'}
              It's okay! Just pick the closest dates you can remember.{'\n\n'}
              Our system will automatically refine and correct your cycle patterns over time.
              You don't have to be perfect right now.
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <FormField inputRef={periodLengthRef} control={control} name="periodLength" label="💧 Period length" placeholder="e.g. 5" keyboardType="numeric" returnKeyType="done" />
            <Text variant="caption" color="muted" style={styles.helper}>
              How many days you bled
            </Text>
          </View>
        </View>

        <View style={[styles.card, shadow.soft, { backgroundColor: theme.colors.surface }]}>
          <Text variant="h3" style={styles.symptomTitle}>Any symptoms?</Text>
          <Text variant="caption" color="muted" style={styles.symptomSub}>
            Optional — tap to select
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
          <Button
            label={cycleNum === 3 ? '✨ Complete' : 'Continue'}
            onPress={handleSubmit(onSubmit)}
            disabled={!formState.isValid}
            fullWidth
            size="lg"
          />
          {cycleNum < 3 && (
            <TouchableOpacity
              onPress={() => navigation.navigate(nextScreen as any)}
              style={styles.skipBtn}
              accessibilityLabel="Skip this cycle"
            >
              <Text variant="bodySmall" color="muted" align="center">
                Skip — I don't remember
              </Text>
            </TouchableOpacity>
          )}
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
  headerTitle: { fontSize: 20, marginBottom: 6 },
  headerSub: { opacity: 0.85, lineHeight: 20, paddingHorizontal: 8 },
  scrollContent: { paddingTop: 20, paddingBottom: 32 },
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 20,
  },
  fieldGroup: { marginBottom: 4 },
  helper: {
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  gapBadge: {
    backgroundColor: palette.accent50,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  gapText: {
    fontWeight: '600',
  },
  infoBanner: {
    backgroundColor: palette.accent50,
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
  },
  infoBannerText: {
    lineHeight: 20,
    color: palette.gray700,
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
    borderRadius: 24,
  },
  symptomChipActive: {
    backgroundColor: palette.accent100,
    borderColor: palette.accent500,
  },
  symptomChipInactive: {
    backgroundColor: 'transparent',
    borderColor: palette.gray100,
  },
  symptomEmoji: { fontSize: 14 },
  symptomLabel: { marginLeft: 4 },
  footer: { paddingHorizontal: 20, marginTop: 4 },
  skipBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
