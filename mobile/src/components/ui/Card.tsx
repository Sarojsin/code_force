import React, { ReactNode } from 'react';
import { StyleSheet, View, ViewProps, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { useTheme } from 'src/theme';

export type CardVariant = 'standard' | 'hero' | 'glass' | 'flat';

export interface CardProps extends ViewProps {
  children: ReactNode;
  padded?: boolean;
  variant?: CardVariant;
  elevated?: boolean;
  onPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({ children, padded = true, variant = 'standard', onPress, style, ...rest }: CardProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const cardVariantStyle = CARD_VARIANTS[variant];

  const cardStyle = [
    cardVariantStyle(theme).base,
    padded && { padding: theme.spacing.lg },
    onPress && animatedStyle,
    style,
  ];

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.96); }}
        onPressOut={() => { scale.value = withSpring(1); }}
        style={cardStyle}
        accessibilityRole="button"
        {...(rest as any)}
      >
        {variant === 'glass' ? (
          <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
        ) : null}
        {children}
      </AnimatedPressable>
    );
  }

  if (variant === 'glass') {
    return (
      <View style={cardStyle} {...rest}>
        <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
        {children}
      </View>
    );
  }

  return (
    <View style={cardStyle} {...rest}>
      {children}
    </View>
  );
}

const CARD_VARIANTS: Record<CardVariant, (theme: ReturnType<typeof useTheme>) => any> = {
  standard: (theme) => ({
    base: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 16,
      ...theme.shadow.md,
    },
  }),
  hero: (theme) => ({
    base: {
      backgroundColor: 'transparent',
      borderRadius: 26,
      ...theme.shadow.hero,
    },
  }),
  glass: (theme) => ({
    base: {
      backgroundColor: 'rgba(255,248,240,0.72)',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.9)',
      overflow: 'hidden',
      ...theme.shadow.soft,
    },
  }),
  flat: (theme) => ({
    base: {
      backgroundColor: theme.colors.surface,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: 'rgba(247,197,204,0.27)',
    },
  }),
};
