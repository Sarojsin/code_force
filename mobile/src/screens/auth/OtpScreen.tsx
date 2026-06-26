/**
 * OtpScreen — second step of OTP login.
 * On success, sets the user in the auth store which flips RootNavigator
 * from Auth stack to Main tabs.
 */

import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { Button, FormField, Text as Txt } from 'src/components/ui';
import { useTheme } from 'src/theme';
import { useVerifyOtp } from 'src/services/queries';
import { useAuthStore } from 'src/stores';
import { verifyOtpFormSchema, VerifyOtpForm } from 'src/validation';
import { logger } from 'src/utils';
import type { AuthStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<AuthStackParamList, 'Otp'>;
type Rt = RouteProp<AuthStackParamList, 'Otp'>;

export function OtpScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { phone, expiresIn, devCode } = route.params;

  const { control, handleSubmit, watch, formState } = useForm<VerifyOtpForm>({
    resolver: zodResolver(verifyOtpFormSchema),
    defaultValues: { phone, otp: '' },
    mode: 'onChange',
  });

  const verify = useVerifyOtp();
  const setUser = useAuthStore(s => s.setUser);
  const otpValue = watch('otp');

  // Resend timer
  const [secondsLeft, setSecondsLeft] = useState(expiresIn);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const onSubmit = async (data: VerifyOtpForm) => {
    try {
      const result = await verify.mutateAsync(data);
      setUser(result.user);
      // RootNavigator will flip automatically because user changed.
    } catch (err) {
      logger.error('OtpScreen.verify.failed', err);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={64}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { padding: theme.spacing.lg }]}
          keyboardShouldPersistTaps="handled"
        >
          <Txt variant="h1" style={{ marginBottom: theme.spacing.sm }}>
            Enter the code
          </Txt>
          <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>
            We sent a 6-digit code to {phone}. It expires in {secondsLeft}s.
          </Txt>

          {devCode ? (
            <View
              style={[
                styles.devBox,
                { backgroundColor: theme.colors.primaryMuted, borderRadius: theme.radius.md },
              ]}
            >
              <Txt variant="bodySmall" color="primary">
                Dev mode OTP: {devCode}
              </Txt>
            </View>
          ) : null}

          <FormField
            control={control}
            name="otp"
            label="One-time code"
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            accessibilityLabel="One-time code from SMS"
          />

          <View style={{ height: theme.spacing.lg }} />

          <Button
            label="Verify"
            onPress={handleSubmit(onSubmit)}
            loading={verify.isPending}
            disabled={!formState.isValid || otpValue.length < 4}
            fullWidth
          />

          <Button
            label={secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
            variant="outline"
            onPress={() => navigation.replace('Phone')}
            disabled={secondsLeft > 0}
            fullWidth
            style={{ marginTop: theme.spacing.md }}
          />

          {verify.isError ? (
            <Txt variant="bodySmall" color="danger" align="center" style={{ marginTop: theme.spacing.md }}>
              That code did not work. Please try again.
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
  devBox: { padding: 12, marginBottom: 16 },
});
