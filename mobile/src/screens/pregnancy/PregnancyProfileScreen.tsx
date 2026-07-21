/**
 * PregnancyProfileScreen — view / edit due date, LMP, current week.
 */

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { Button, FormField, Card, KeyboardAvoidingWrapper, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { logger } from 'src/utils';
import type { PregnancyStackParamList } from 'src/navigation/types';
import { z } from 'zod';

type Nav = StackNavigationProp<PregnancyStackParamList, 'PregnancyProfile'>;

const profileSchema = z.object({
  dueDate: z.string().min(1, 'Due date is required'),
  lmp: z.string().min(1, 'LMP date is required'),
  notes: z.string().optional(),
});
type ProfileForm = z.infer<typeof profileSchema>;

function weeksBetween(d1: string, d2: string): number {
  const diff = new Date(d2).getTime() - new Date(d1).getTime();
  return Math.max(0, Math.floor(diff / (7 * 86400000)));
}

export function PregnancyProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [currentWeek, setCurrentWeek] = useState(0);

  const { control, handleSubmit, watch, formState } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { dueDate: '', lmp: '', notes: '' },
    mode: 'onBlur',
  });

  const lmpValue = watch('lmp');
  React.useEffect(() => {
    if (lmpValue && lmpValue.length === 10) {
      const weeks = weeksBetween(lmpValue, new Date().toISOString().slice(0, 10));
      setCurrentWeek(weeks);
    }
  }, [lmpValue]);

  const onSubmit = async (data: ProfileForm) => {
    try {
      logger.info('PregnancyProfileScreen.submit', data);
      navigation.goBack();
    } catch (err) {
      logger.error('PregnancyProfileScreen.submit.failed', err);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingWrapper contentContainerStyle={{ padding: theme.spacing.lg }}>
        <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>Pregnancy Profile</Txt>
        <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>Set your due date or last menstrual period.</Txt>

        {currentWeek > 0 && (
          <Card style={{ marginBottom: theme.spacing.lg }} accessibilityLabel={`You are in week ${currentWeek}`}>
            <Txt variant="display" color="primary" align="center">{currentWeek}</Txt>
            <Txt variant="body" color="secondary" align="center">Weeks pregnant</Txt>
            <Txt variant="caption" color="muted" align="center">Estimated based on LMP</Txt>
          </Card>
        )}

        <FormField control={control} name="dueDate" label="Due date" placeholder="YYYY-MM-DD" accessibilityLabel="Due date" />
        <View style={{ height: theme.spacing.md }} />
        <FormField control={control} name="lmp" label="Last menstrual period" placeholder="YYYY-MM-DD" accessibilityLabel="Last menstrual period date" />
        <View style={{ height: theme.spacing.md }} />
        <FormField control={control} name="notes" label="Notes (optional)" placeholder="Any additional notes..." accessibilityLabel="Pregnancy notes" />

        <View style={{ height: theme.spacing.xl }} />
        <Button label="Save profile" onPress={handleSubmit(onSubmit)} disabled={!formState.isValid} fullWidth />
      </KeyboardAvoidingWrapper>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
