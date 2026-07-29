import React from 'react';
import { useSharedValue, useAnimatedStyle, withDelay, withSpring } from 'react-native-reanimated';

export function useStaggerEntrance(delayMs: number, index: number) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  React.useEffect(() => {
    const totalDelay = delayMs * index;
    opacity.value = withDelay(totalDelay, withSpring(1, { damping: 20 }));
    translateY.value = withDelay(totalDelay, withSpring(0, { damping: 20 }));
  }, [index, delayMs]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return animatedStyle;
}
