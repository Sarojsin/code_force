import React, { ReactNode } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay } from 'react-native-reanimated';

interface AnimatedSectionProps {
  children: ReactNode;
  delay: number;
  style?: any;
}

export const AnimatedSection = React.memo(function AnimatedSection({ children, delay, style }: AnimatedSectionProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);
  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
  React.useEffect(() => {
    opacity.value = withDelay(delay, withSpring(1, { damping: 20, stiffness: 150 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 20, stiffness: 150 }));
  }, [delay]);
  return <Animated.View style={[animStyle, style]}>{children}</Animated.View>;
});
