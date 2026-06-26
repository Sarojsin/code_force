import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { StackNavigationProp } from '@react-navigation/stack';

import { Button, Text, ProgressDots } from 'src/components/ui';
import { useTheme, palette } from 'src/theme';
import type { OnboardingStackParamList } from 'src/navigation/types';

type Nav = StackNavigationProp<OnboardingStackParamList, 'Welcome'>;

const { width } = Dimensions.get('window');

function FlowerIcon() {
  return (
    <Svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <Circle cx="36" cy="36" r="10" fill="white" />
      <Path d="M36 12C36 12 24 24 20 32S24 44 30 44 38 38 36 32 36 12 36 12Z" fill="white" opacity="0.3" />
      <Path d="M36 12C36 12 48 24 52 32S48 44 42 44 34 38 36 32 36 12 36 12Z" fill="white" opacity="0.3" />
      <Path d="M12 36C12 36 24 48 32 52S44 48 44 42 38 34 32 36 12 36 12 36Z" fill="white" opacity="0.25" />
      <Path d="M60 36C60 36 48 48 40 52S28 48 28 42 34 34 40 36 60 36 60 36Z" fill="white" opacity="0.25" />
    </Svg>
  );
}

export function WelcomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.container, { backgroundColor: palette.primary500 }]}>
        <Svg width={width} height={340} viewBox={`0 0 ${width} 340`} style={styles.bg}>
          <Defs>
            <LinearGradient id="welcomeGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={palette.primary500} />
              <Stop offset="100%" stopColor={palette.accent500} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={width} height={340} fill="url(#welcomeGrad)" />
          <Path
            d={`M0,280 Q${width * 0.3},340 ${width * 0.5},300 T${width},280 L${width},340 L0,340 Z`}
            fill={theme.colors.background}
          />
        </Svg>

        <View style={styles.content}>
          <ProgressDots current={0} total={6} />
          <View style={styles.hero}>
            <FlowerIcon />
            <Text variant="display" color="inverse" align="center" style={styles.title}>
              Welcome to SheCare
            </Text>
            <Text variant="body" color="inverse" align="center" style={styles.subtitle}>
              Your personal wellness companion.{'\n'}Privacy-first. Offline-ready. Designed for you.
            </Text>
          </View>
        </View>

        <View style={[styles.footer, { backgroundColor: theme.colors.background }]}>
          <Button
            label="Get started"
            onPress={() => navigation.navigate('PersonalInfo')}
            fullWidth
            size="lg"
          />
          <Text variant="caption" color="muted" align="center" style={styles.privacy}>
            Your data is encrypted end-to-end. We never share your health information.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  bg: { position: 'absolute', top: 0 },
  content: { flex: 1 },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  title: { marginTop: 24, fontSize: 28 },
  subtitle: { marginTop: 12, opacity: 0.85, lineHeight: 22 },
  footer: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  privacy: { marginTop: 16, opacity: 0.6 },
});