import { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

export function usePressScale(scaleTo = 0.96) {
  const scale = useSharedValue(1);

  const onPressIn = () => {
    scale.value = withSpring(scaleTo, { damping: 12, stiffness: 200 });
  };

  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { animatedStyle, onPressIn, onPressOut };
}
