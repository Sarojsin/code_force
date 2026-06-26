import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';

import { Button, Text, CelebrationAnimation, ProgressDots } from 'src/components/ui';
import { useTheme, palette } from 'src/theme';
import { useOnboardingStore } from 'src/stores';
import { submitOnboarding } from 'src/stores/onboardingStore';

export function CompleteScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const isSubmitting = useOnboardingStore((s) => s.isSubmitting);

  const handleComplete = async () => {
    await submitOnboarding();
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }),
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.primary500 }]}>
      <ProgressDots current={6} total={6} />
      <View style={styles.container}>
        <CelebrationAnimation />
        <Text variant="h1" color="inverse" align="center" style={styles.title}>
          You're all set!
        </Text>
        <Text variant="body" color="inverse" align="center" style={styles.subtitle}>
          Your dashboard is ready.{'\n'}We've backfilled your cycle history and computed your first prediction.
        </Text>
      </View>

      <View style={[styles.footer, { backgroundColor: theme.colors.background }]}>
        <Button
          label="Go to Dashboard"
          onPress={handleComplete}
          loading={isSubmitting}
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  title: { fontSize: 28, marginBottom: 12 },
  subtitle: { opacity: 0.85, lineHeight: 22 },
  footer: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
});