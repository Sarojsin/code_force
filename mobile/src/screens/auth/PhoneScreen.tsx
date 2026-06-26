/**
 * PhoneScreen — first step of OTP login.
 * Form: react-hook-form + zod (rule §8.1).
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
import { useRequestOtp } from 'src/services/queries';
import { requestOtpFormSchema, RequestOtpForm } from 'src/validation';
import { logger } from 'src/utils';
import type { AuthStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<AuthStackParamList, 'Phone'>;

export function PhoneScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const { control, handleSubmit, formState } = useForm<RequestOtpForm>({
    resolver: zodResolver(requestOtpFormSchema),
    defaultValues: { phone: '' },
    mode: 'onBlur',
  });
  const requestOtp = useRequestOtp();

  const onSubmit = async (data: RequestOtpForm) => {
    try {
      const resp = await requestOtp.mutateAsync(data.phone);
      navigation.navigate('Otp', {
        phone: data.phone,
        expiresIn: resp.expires_in,
        devCode: resp.dev_code ?? null,
      });
    } catch (err) {
      logger.error('PhoneScreen.requestOtp.failed', err);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { padding: theme.spacing.lg }]}
          keyboardShouldPersistTaps="handled"
        >
          <Txt variant="display" style={{ marginBottom: theme.spacing.sm }}>
            Welcome to SheCare
          </Txt>
          <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>
            Enter your phone number to receive a one-time code.
          </Txt>

          <FormField
            control={control}
            name="phone"
            label="Phone number"
            placeholder="+14155552671"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            hint="Include the country code, e.g. +91 for India"
            accessibilityLabel="Phone number with country code"
          />

          <View style={{ height: theme.spacing.lg }} />

          <Button
            label="Send code"
            onPress={handleSubmit(onSubmit)}
            loading={requestOtp.isPending}
            disabled={!formState.isValid}
            fullWidth
          />

          {requestOtp.isError ? (
            <Txt variant="bodySmall" color="danger" align="center" style={{ marginTop: theme.spacing.md }}>
              We could not send your code. Please try again.
            </Txt>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center' },
});
