/**
 * ChangePasswordScreen — password change form.
 */

import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { Button, FormField, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { logger } from 'src/utils';
import type { ProfileStackParamList } from 'src/navigation/types';
import { z } from 'zod';

type Nav = StackNavigationProp<ProfileStackParamList, 'ChangePassword'>;

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Password must be at least 6 characters'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'Passwords must match',
  path: ['confirmPassword'],
});
type PasswordForm = z.infer<typeof passwordSchema>;

export function ChangePasswordScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { control, handleSubmit, formState } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    mode: 'onBlur',
  });

  const onSubmit = async (_data: PasswordForm) => {
    try {
      logger.info('ChangePasswordScreen.submit');
      navigation.goBack();
    } catch (err) {
      logger.error('ChangePasswordScreen.submit.failed', err);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { padding: theme.spacing.lg }]} keyboardShouldPersistTaps="handled">
          <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>Change Password</Txt>
          <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>Enter your current and new password.</Txt>

          <FormField control={control} name="currentPassword" label="Current password" placeholder="Enter current password" secureTextEntry accessibilityLabel="Current password" />
          <View style={{ height: theme.spacing.md }} />
          <FormField control={control} name="newPassword" label="New password" placeholder="At least 8 characters" secureTextEntry accessibilityLabel="New password" />
          <View style={{ height: theme.spacing.md }} />
          <FormField control={control} name="confirmPassword" label="Confirm new password" placeholder="Re-enter new password" secureTextEntry accessibilityLabel="Confirm new password" />

          <View style={{ height: theme.spacing.xl }} />
          <Button label="Update password" onPress={handleSubmit(onSubmit)} disabled={!formState.isValid} fullWidth />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
});
