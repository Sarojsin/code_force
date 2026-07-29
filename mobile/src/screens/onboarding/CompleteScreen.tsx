import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, withSpring, withDelay, withRepeat, withTiming, useSharedValue } from 'react-native-reanimated';

import { Button, Text, ProgressDots } from 'src/components/ui';
import { useTheme, palette } from 'src/theme';
import { useOnboardingStore } from 'src/stores';
import { submitOnboarding } from 'src/stores/onboardingStore';
import { LinearGradient } from 'expo-linear-gradient';

const CHECK_ITEMS = [
  '✓ Cycle tracking ready',
  '✓ AI insights activated',
  '✓ Safety features enabled',
  '✓ Wellness journal open',
];

function CheckCard({ text, delay }: { text: string; delay: number }) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(-20);
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }));
  useEffect(() => {
    opacity.value = withDelay(delay, withSpring(1, { damping: 20 }));
    translateX.value = withDelay(delay, withSpring(0, { damping: 20 }));
  }, [delay]);
  return (
    <Animated.View style={[styles.checkCard, { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12 }, animStyle]}>
      <Text variant="body" style={{ color: '#fff', fontWeight: '600' }}>{text}</Text>
    </Animated.View>
  );
}

export function CompleteScreen() {
  const theme = useTheme();
  const isSubmitting = useOnboardingStore((s) => s.isSubmitting);

  const handleComplete = async () => {
    await submitOnboarding();
  };

  const breatheScale = useSharedValue(1);
  useEffect(() => {
    breatheScale.value = withRepeat(
      withTiming(1.08, { duration: 2000 }),
      -1, true,
    );
  }, []);

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breatheScale.value }],
  }));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <LinearGradient
          colors={[palette.primary500, palette.accent500]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ProgressDots current={6} total={6} />

        <View style={styles.content}>
          <Animated.View style={[styles.iconCircle, breatheStyle]}>
            <LinearGradient
              colors={[theme.colors.primary, '#CE93D8', '#81C784']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 55 }]}
            />
            <Text style={{ fontSize: 40 }}>✨</Text>
          </Animated.View>
          <Text variant="h1" color="inverse" align="center" style={styles.title}>
            You're all set!
          </Text>
          <Text variant="body" color="inverse" align="center" style={styles.subtitle}>
            Your dashboard is ready.{'\n'}We've backfilled your cycle history and computed your first prediction.
          </Text>

          <View style={styles.checkSection}>
            {CHECK_ITEMS.map((item, i) => (
              <CheckCard key={item} text={item} delay={400 + i * 150} />
            ))}
          </View>
        </View>

        <View style={[styles.footer, { backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
          <Button
            label="Enter SheCare ✨"
            onPress={handleComplete}
            loading={isSubmitting}
            fullWidth
            size="lg"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#FF6B8A',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  title: { fontSize: 28, marginBottom: 12 },
  subtitle: { opacity: 0.85, lineHeight: 22 },
  checkSection: { width: '100%', gap: 8, marginTop: 24 },
  checkCard: { padding: 14 },
  footer: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16 },
});
