import React, { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, Easing, withRepeat } from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PARTICLE_COUNT = 20;
const COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A8E6CF', '#FF8A5C', '#7C4DFF'];

interface ParticleProps {
  index: number;
  delay: number;
}

function Particle({ index, delay }: ParticleProps) {
  const startX = Math.random() * SCREEN_WIDTH;
  const color = COLORS[index % COLORS.length];
  const size = 6 + Math.random() * 10;

  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue('0deg');

  useEffect(() => {
    translateY.value = withDelay(delay, withTiming(SCREEN_HEIGHT + 50, { duration: 2500, easing: Easing.out(Easing.ease) }));
    translateX.value = withDelay(delay, withTiming((Math.random() - 0.5) * 200, { duration: 2500 }));
    opacity.value = withDelay(delay + 800, withTiming(0.3, { duration: 1700 }));
    rotate.value = withDelay(delay, withRepeat(withTiming('360deg', { duration: 1000 }), -1));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { translateX: translateX.value }, { rotate: rotate.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          left: startX,
        },
        style,
      ]}
    />
  );
}

export function CelebrationAnimation() {
  return (
    <View style={styles.container} pointerEvents="none">
      {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
        <Particle key={i} index={i} delay={i * 80} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  particle: { position: 'absolute', top: 0 },
});