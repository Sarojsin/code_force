import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

export interface ProgressDotsProps {
  current: number;
  total: number;
  activeColor?: string;
  color?: string;
}

export function ProgressDots({ current, total, activeColor = '#FF6B8A', color = 'rgba(247,197,204,0.53)' }: ProgressDotsProps) {
  return (
    <View style={styles.container} accessibilityLabel={`Step ${current} of ${total}`}>
      <View style={styles.dots}>
        {Array.from({ length: total }, (_, i) => (
          <Dot key={i} isActive={i < current} activeColor={activeColor} color={color} />
        ))}
      </View>
    </View>
  );
}

function Dot({ isActive, activeColor, color }: { isActive: boolean; activeColor: string; color: string }) {
  const animStyle = useAnimatedStyle(() => ({
    width: withSpring(isActive ? 24 : 8, { damping: 15 }),
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        animStyle,
        { backgroundColor: isActive ? activeColor : color },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { height: 8, borderRadius: 4 },
});
