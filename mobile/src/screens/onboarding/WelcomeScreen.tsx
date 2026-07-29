import React from 'react';
import { Dimensions, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import type { StackNavigationProp } from '@react-navigation/stack';
import Animated, { useAnimatedStyle, withSpring, withDelay, useSharedValue } from 'react-native-reanimated';

import { Button, Text, ProgressDots } from 'src/components/ui';
import { useTheme, palette } from 'src/theme';
import type { OnboardingStackParamList } from 'src/navigation/types';
import { LinearGradient } from 'expo-linear-gradient';

type Nav = StackNavigationProp<OnboardingStackParamList, 'Welcome'>;

const { width } = Dimensions.get('window');

const FEATURES = [
  { icon: '🔒', title: 'Encrypted & private', desc: 'Your data never leaves your device without your consent.' },
  { icon: '🤖', title: 'AI-powered predictions', desc: 'Learns your unique cycle patterns over time.' },
  { icon: '🆘', title: 'Emergency SOS', desc: 'One tap alerts your emergency contacts with your location.' },
  { icon: '🌿', title: 'Holistic wellness', desc: 'Cycle, mood, sleep, and nutrition — all in one place.' },
];

function FeatureCard({ icon, title, desc, delay }: { icon: string; title: string; desc: string; delay: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  React.useEffect(() => {
    opacity.value = withDelay(delay, withSpring(1, { damping: 20 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 20 }));
  }, [delay]);
  return (
    <Animated.View style={[styles.featureCard, { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16 }, animStyle]}>
      <Text style={{ fontSize: 24, marginRight: 12 }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text variant="body" style={{ color: '#fff', fontWeight: '600' }}>{title}</Text>
        <Text variant="caption" style={{ color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{desc}</Text>
      </View>
    </Animated.View>
  );
}

export function WelcomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();

  const iconScale = useSharedValue(0);
  const iconAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  React.useEffect(() => {
    iconScale.value = withDelay(100, withSpring(1, { damping: 12 }));
  }, []);

  const titleOpacity = useSharedValue(0);
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  React.useEffect(() => {
    titleOpacity.value = withDelay(300, withSpring(1));
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <LinearGradient
          colors={[palette.primary500, palette.accent500]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 0 }]}
        />
        <Svg width={width} height={200} viewBox={`0 0 ${width} 200`} style={styles.bgCurve}>
          <Path
            d={`M0,160 Q${width * 0.3},200 ${width * 0.5},170 T${width},160 L${width},200 L0,200 Z`}
            fill={theme.colors.background}
          />
        </Svg>

        <View style={styles.content}>
          <ProgressDots current={0} total={6} />
          <View style={styles.hero}>
            <Animated.View style={[styles.iconContainer, { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 50 }, iconAnimatedStyle]}>
              <Text style={{ fontSize: 42 }}>🌸</Text>
            </Animated.View>
            <Animated.View style={titleStyle}>
              <Text variant="display" color="inverse" align="center" style={styles.title}>
                Welcome to SheCare
              </Text>
              <Text variant="body" color="inverse" align="center" style={styles.subtitle}>
                Your personal wellness companion.{'\n'}Privacy-first. Offline-ready. Designed for you.
              </Text>
            </Animated.View>
          </View>
        </View>

        <View style={[styles.featuresSection, { backgroundColor: 'transparent', paddingHorizontal: 24 }]}>
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} icon={f.icon} title={f.title} desc={f.desc} delay={400 + i * 100} />
          ))}
        </View>

        <View style={[styles.footer, { backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
          <Button label="🌸 Get Started" onPress={() => navigation.navigate('PersonalInfo')} fullWidth size="lg" />
          <Pressable onPress={() => {}} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text variant="body" color="muted">
              Already have an account? <Text variant="body" color="primary" style={{ fontWeight: '700' }}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  bgCurve: { position: 'absolute', bottom: 0 },
  content: { flex: 1, paddingTop: 16 },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconContainer: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  title: { marginTop: 8, fontSize: 28 },
  subtitle: { marginTop: 12, opacity: 0.85, lineHeight: 22 },
  featuresSection: { paddingBottom: 16, gap: 8 },
  featureCard: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  footer: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 20 },
});
