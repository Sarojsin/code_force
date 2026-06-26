import React from 'react';
import { Dimensions, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { StackNavigationProp } from '@react-navigation/stack';

import { Button, FormField, Text as Txt } from 'src/components/ui';
import { useTheme, palette, shadow } from 'src/theme';
import { useLogin } from 'src/services/queries';
import { loginFormSchema, LoginForm } from 'src/validation';
import { useAuthStore } from 'src/stores/authStore';
import { logger } from 'src/utils';
import type { AuthStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<AuthStackParamList, 'Login'>;

const { width, height: screenHeight } = Dimensions.get('window');
const CURVE_HEIGHT = Math.min(width * 0.55, screenHeight * 0.35);

function DecorativeHeader() {
  const theme = useTheme();
  return (
    <View style={[styles.headerContainer, { height: CURVE_HEIGHT }]}>
      <Svg width={width} height={CURVE_HEIGHT} viewBox={`0 0 ${width} ${CURVE_HEIGHT}`}>
        <Defs>
          <LinearGradient id="headerGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={palette.primary500} stopOpacity="1" />
            <Stop offset="100%" stopColor={palette.accent500} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={CURVE_HEIGHT} fill="url(#headerGrad)" />
        <Path
          d={`M0,${CURVE_HEIGHT * 0.7} Q${width * 0.25},${CURVE_HEIGHT * 1.1} ${width * 0.5},${CURVE_HEIGHT * 0.85} T${width},${CURVE_HEIGHT * 0.6} L${width},${CURVE_HEIGHT} L0,${CURVE_HEIGHT} Z`}
          fill={theme.colors.background}
        />
      </Svg>
      {/* Brand icon — stylised flower */}
      <View style={styles.brandIcon}>
        <Svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          <Path d="M28 6C28 6 18 16 14 22C10 28 14 34 20 34S30 30 28 22C26 14 28 6 28 6Z" fill="white" opacity="0.25" />
          <Path d="M28 6C28 6 38 16 42 22C46 28 42 34 36 34S26 30 28 22C30 14 28 6 28 6Z" fill="white" opacity="0.25" />
          <Path d="M6 28C6 28 16 38 22 42C28 46 34 42 34 36S30 26 22 28C14 30 6 28 6 28Z" fill="white" opacity="0.2" />
          <Path d="M50 28C50 28 40 38 34 42C28 46 22 42 22 36S26 26 34 28C42 30 50 28 50 28Z" fill="white" opacity="0.2" />
          <Circle cx="28" cy="28" r="8" fill="white" />
        </Svg>
      </View>
      <View style={styles.headerText}>
        <Txt variant="display" color="inverse" align="center" style={{ fontSize: 30 }}>
          SheCare
        </Txt>
        <Txt variant="body" color="inverse" align="center" style={{ opacity: 0.85, marginTop: 4 }}>
          Your wellness journey starts here
        </Txt>
      </View>
    </View>
  );
}

export function LoginScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const setUser = useAuthStore((s) => s.setUser);
  const { control, handleSubmit, formState } = useForm<LoginForm>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });
  const login = useLogin();

  const onSubmit = async (data: LoginForm) => {
    try {
      const resp = await login.mutateAsync(data);
      setUser(resp.user);
    } catch (err) {
      logger.error('LoginScreen.login.failed', err);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <DecorativeHeader />

          <View style={[styles.card, shadow.lg, { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, marginHorizontal: theme.spacing.lg, padding: theme.spacing.xl, marginTop: -theme.spacing.xl }]}>
            <Txt variant="h2" style={{ marginBottom: theme.spacing.xs }}>
              Welcome back
            </Txt>
            <Txt variant="body" color="secondary" style={{ marginBottom: theme.spacing.xl }}>
              Sign in to continue
            </Txt>

            <FormField
              control={control}
              name="email"
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel="Email address"
            />

            <FormField
              control={control}
              name="password"
              label="Password"
              placeholder="Enter your password"
              secureTextEntry
              autoComplete="password"
              textContentType="password"
              accessibilityLabel="Password"
            />

            <Txt
              variant="bodySmall"
              color="muted"
              align="right"
              style={{ marginTop: 4, marginBottom: theme.spacing.lg }}
            >
              Forgot password?
            </Txt>

            <Button
              label="Sign in"
              onPress={handleSubmit(onSubmit)}
              loading={login.isPending}
              disabled={!formState.isValid}
              fullWidth
              size="lg"
            />

            {login.isError ? (
              <View style={[styles.errorBox, { backgroundColor: palette.danger500 + '12', borderRadius: theme.radius.md, marginTop: theme.spacing.md }]}>
                <Txt variant="bodySmall" color="danger" align="center">
                  Invalid email or password. Please try again.
                </Txt>
              </View>
            ) : null}

            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
              <Txt variant="caption" color="muted" style={{ marginHorizontal: theme.spacing.md }}>
                or
              </Txt>
              <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
            </View>

            <Txt variant="body" align="center">
              Don't have an account?{' '}
              <Txt
                variant="body"
                color="primary"
                onPress={() => navigation.navigate('Register')}
                style={{ fontWeight: '600' }}
              >
                Create one
              </Txt>
            </Txt>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  headerContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  brandIcon: { position: 'absolute', top: CURVE_HEIGHT * 0.18 },
  headerText: { position: 'absolute', top: CURVE_HEIGHT * 0.42 },
  card: { zIndex: 10 },
  errorBox: { paddingVertical: 10, paddingHorizontal: 12 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1 },
});
