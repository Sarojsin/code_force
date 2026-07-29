import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

export interface ProgressDotsProps {
  current: number;
  total: number;
}

export function ProgressDots({ current, total }: ProgressDotsProps) {
  return (
    <View style={styles.container} accessibilityLabel={`Step ${current} of ${total}`}>
      <View style={styles.dots}>
        {Array.from({ length: total }, (_, i) => (
          <Dot key={i} isActive={i < current} />
        ))}
      </View>
    </View>
  );
}

function Dot({ isActive }: { isActive: boolean }) {
  const animStyle = useAnimatedStyle(() => ({
    width: withSpring(isActive ? 24 : 8, { damping: 15 }),
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        animStyle,
        { backgroundColor: isActive ? '#FF6B8A' : 'rgba(247,197,204,0.53)' },
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
