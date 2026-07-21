/**
 * PregnancyDailyLogScreen — log symptoms, cravings, mood for today.
 */

import React, { useState } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Button, FormField, KeyboardAvoidingWrapper, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { logger } from 'src/utils';
import type { PregnancyStackParamList } from 'src/navigation/types';
import { z } from 'zod';

type Nav = StackNavigationProp<PregnancyStackParamList, 'PregnancyDailyLog'>;

const symptomsList = ['Nausea', 'Fatigue', 'Back pain', 'Swelling', 'Heartburn', 'Headache', 'Cravings', 'Braxton Hicks', 'Insomnia', 'Shortness of breath'];
const cravingsList = ['Sweet', 'Salty', 'Sour', 'Spicy', 'Fruits', 'Dairy', 'None'] as const;
const moodList = ['Excited', 'Anxious', 'Tired', 'Happy', 'Overwhelmed', 'Calm', 'Emotional', 'Nauseated'];

const logSchema = z.object({
  weight: z.string().optional(),
  bloodPressure: z.string().optional(),
  notes: z.string().optional(),
});
type LogForm = z.infer<typeof logSchema>;

export function PregnancyDailyLogScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { control, handleSubmit } = useForm<LogForm>({
    resolver: zodResolver(logSchema),
    defaultValues: { notes: '' },
    mode: 'onBlur',
  });
  const [selectedSymptoms, setSymptoms] = useState<string[]>([]);
  const [selectedCravings, setCravings] = useState<string[]>([]);
  const [selectedMoods, setMoods] = useState<string[]>([]);

  const toggleItem = (item: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
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
              backgroundColor: selected ? theme.colors.accent : theme.colors.surface,
              borderColor: selected ? theme.colors.accent : theme.colors.border,
              borderRadius: theme.radius.pill,
            },
          ]}
        >
          <Txt variant="bodySmall" color={selected ? 'inverse' : 'primary'}>{label}</Txt>
        </Pressable>
      </Animated.View>
    );
  };

  const onSubmit = async (data: LogForm) => {
    try {
      logger.info('PregnancyDailyLogScreen.submit', { ...data, selectedSymptoms, selectedCravings, selectedMoods });
      navigation.goBack();
    } catch (err) {
      logger.error('PregnancyDailyLogScreen.submit.failed', err);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingWrapper contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>Daily Log</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>Track how you are feeling today.</Txt>

        <FormField control={control} name="weight" label="Weight (kg, optional)" placeholder="e.g. 65.5" keyboardType="decimal-pad" accessibilityLabel="Weight in kilograms" />
        <FormField control={control} name="bloodPressure" label="Blood pressure (optional)" placeholder="e.g. 120/80" accessibilityLabel="Blood pressure reading" />

        <Txt variant="bodySmall" color="secondary" style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm }}>Symptoms</Txt>
        <View style={styles.chipRow}>{symptomsList.map(s => <Chip key={s} label={s} selected={selectedSymptoms.includes(s)} onPress={() => toggleItem(s, selectedSymptoms, setSymptoms)} />)}</View>

        <Txt variant="bodySmall" color="secondary" style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm }}>Cravings</Txt>
        <View style={styles.chipRow}>{cravingsList.map(c => <Chip key={c} label={c} selected={selectedCravings.includes(c)} onPress={() => toggleItem(c, selectedCravings, setCravings)} />)}</View>

        <Txt variant="bodySmall" color="secondary" style={{ marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm }}>Mood</Txt>
        <View style={styles.chipRow}>{moodList.map(m => <Chip key={m} label={m} selected={selectedMoods.includes(m)} onPress={() => toggleItem(m, selectedMoods, setMoods)} />)}</View>

        <FormField control={control} name="notes" label="Additional notes" placeholder="How was your day?" accessibilityLabel="Daily log notes" />

        <View style={{ height: theme.spacing.xl }} />
        <Button label="Save daily log" onPress={handleSubmit(onSubmit)} fullWidth />
      </KeyboardAvoidingWrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, minHeight: 44, justifyContent: 'center' },
});
