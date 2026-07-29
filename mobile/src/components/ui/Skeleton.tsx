import React, { useEffect } from 'react';
import { ViewStyle, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

import { useTheme } from 'src/theme';

export type SkeletonShape = 'text' | 'card' | 'circle' | 'pill';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  shape?: SkeletonShape;
  radius?: number;
  style?: ViewStyle;
}

const SHAPE_DEFAULTS: Record<SkeletonShape, { width: number; height: number; radius: number }> = {
  text: { width: 120, height: 14, radius: 8 },
  card: { width: 0, height: 120, radius: 22 },
  circle: { width: 48, height: 48, radius: 24 },
  pill: { width: 80, height: 28, radius: 14 },
};

export function Skeleton({
  width,
  height,
  shape = 'text',
  radius,
  style,
}: SkeletonProps) {
  const theme = useTheme();
  const defaults = SHAPE_DEFAULTS[shape];
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1100 }), -1, true);
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.55, 1]),
  }));

  const finalWidth = width ?? (shape === 'card' ? '100%' : defaults.width);
  const finalHeight = height ?? defaults.height;
  const finalRadius = radius ?? defaults.radius;

  return (
    <Animated.View
      accessibilityLabel="loading"
      style={[
        styles.base,
        {
          width: finalWidth as ViewStyle['width'],
          height: finalHeight,
          borderRadius: shape === 'circle' ? finalHeight / 2 : finalRadius,
          backgroundColor: theme.isDark ? theme.colors.border : '#E7EAF0',
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {},
});
