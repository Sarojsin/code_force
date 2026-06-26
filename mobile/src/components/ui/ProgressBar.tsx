import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { useTheme } from 'src/theme';

export interface ProgressBarProps {
  progress: number;
  color?: string;
  height?: number;
  animated?: boolean;
}

export function ProgressBar({ progress, color, height = 6, animated = true }: ProgressBarProps) {
  const theme = useTheme();
  const widthVal = useSharedValue(0);
  const clampedProgress = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    widthVal.value = animated
      ? withTiming(clampedProgress, { duration: 400 })
      : clampedProgress;
  }, [clampedProgress, animated, widthVal]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${widthVal.value * 100}%`,
  }));

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: theme.colors.border,
          borderRadius: height / 2,
          height,
        },
      ]}
      accessibilityLabel={`Progress: ${Math.round(clampedProgress * 100)}%`}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clampedProgress * 100) }}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: color ?? theme.colors.primary,
            borderRadius: height / 2,
            height,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0 },
});
