/**
 * SplashScreen — Aurora Gradient per UI_UX Splash_Screen spec.
 * Animated gradient background, glowing glass circle logo, loading dots.
 * Shown while auth state is determined.
 */

import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
import Svg, { Path, Circle as SvgCircle, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

import { Text } from 'src/components/ui';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const LOGO_SIZE = Math.min(SCREEN_WIDTH * 0.5, 200);
const PADDING_X = (SCREEN_WIDTH - LOGO_SIZE) / 2;

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  // Aurora background animation
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.linear }),
      -1,
      true,
    );
  }, []);

  const bgAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value * -20 }],
  }));

  // Logo pulse animation
  const logoScale = useSharedValue(1);
  const logoOpacity = useSharedValue(0.8);

  useEffect(() => {
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    logoOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  const logoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  // Auto finish after minimum display time
  useEffect(() => {
    const timer = setTimeout(onFinish, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Loading dots animation
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);
  const dot4 = useSharedValue(0.3);
  const dot5 = useSharedValue(0.3);
  const dots = [dot1, dot2, dot3, dot4, dot5];

  useEffect(() => {
    dots.forEach((dot) => {
      dot.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.ease }),
          withTiming(0.3, { duration: 400, easing: Easing.ease }),
        ),
        -1,
        true,
      );
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Aurora gradient background */}
      <Animated.View style={[styles.aurora, bgAnimStyle]}>
        <Svg width={SCREEN_WIDTH + 40} height={SCREEN_HEIGHT} viewBox={`0 0 ${SCREEN_WIDTH + 40} ${SCREEN_HEIGHT}`}>
          <Defs>
            <LinearGradient id="aurora1" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#FF5C8A" stopOpacity="0.6" />
              <Stop offset="25%" stopColor="#9B7BFF" stopOpacity="0.5" />
              <Stop offset="50%" stopColor="#FFB7C8" stopOpacity="0.4" />
              <Stop offset="75%" stopColor="#E8D5FF" stopOpacity="0.5" />
              <Stop offset="100%" stopColor="#FFD5B8" stopOpacity="0.4" />
            </LinearGradient>
            <LinearGradient id="aurora2" x1="1" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#FFD5B8" stopOpacity="0.3" />
              <Stop offset="50%" stopColor="#E8D5FF" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#FF5C8A" stopOpacity="0.5" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={SCREEN_WIDTH + 40} height={SCREEN_HEIGHT} fill="url(#aurora1)" />
          <Rect x="20" y="0" width={SCREEN_WIDTH + 20} height={SCREEN_HEIGHT} fill="url(#aurora2)" opacity="0.6" />
        </Svg>
      </Animated.View>

      {/* Glowing glass circle with logo */}
      <Animated.View style={[styles.glassCircle, logoAnimStyle]}>
        <View style={[styles.glassInner, { width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: LOGO_SIZE / 2 }]}>
          <Svg width={LOGO_SIZE * 0.4} height={LOGO_SIZE * 0.4} viewBox="0 0 56 56" fill="none">
            <Path d="M28 6C28 6 18 16 14 22C10 28 14 34 20 34S30 30 28 22C26 14 28 6 28 6Z" fill="white" opacity="0.9" />
            <Path d="M28 6C28 6 38 16 42 22C46 28 42 34 36 34S26 30 28 22C30 14 28 6 28 6Z" fill="white" opacity="0.9" />
            <Path d="M6 28C6 28 16 38 22 42C28 46 34 42 34 36S30 26 22 28C14 30 6 28 6 28Z" fill="white" opacity="0.7" />
            <Path d="M50 28C50 28 40 38 34 42C28 46 22 42 22 36S26 26 34 28C42 30 50 28 50 28Z" fill="white" opacity="0.7" />
            <SvgCircle cx="28" cy="28" r="8" fill="white" />
          </Svg>
        </View>
      </Animated.View>

      {/* App name */}
      <View style={styles.brandArea}>
        <Text variant="display" style={{ color: '#fff', fontSize: 32, textAlign: 'center' }}>SheCare</Text>
        <Text variant="body" style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 4 }}>Your wellness journey</Text>
      </View>

      {/* Loading dots */}
      <View style={styles.dotsContainer}>
        {dots.map((dot, i) => {
          const dotStyle = useAnimatedStyle(() => ({ opacity: dot.value }));
          return (
            <Animated.View key={i} style={[styles.dot, dotStyle]} />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF5C8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aurora: {
    ...StyleSheet.absoluteFill,
  },
  glassCircle: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.2,
    left: PADDING_X,
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 15,
  },
  glassInner: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  brandArea: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.2 + LOGO_SIZE + 30,
    alignItems: 'center',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT * 0.12,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
});
