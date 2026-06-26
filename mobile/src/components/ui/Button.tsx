/**
 * Button — variants per rule §4.1.
 * Atomic design atom.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, ActivityIndicator, PressableProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { useTheme } from 'src/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  style?: object;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sizeStyle = SIZE_STYLES[size];
  const variantStyle = variantStyles(theme, variant);

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      }}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: loading }}
      accessibilityLabel={label}
      style={[
        styles.base,
        sizeStyle,
        variantStyle.container,
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        animatedStyle,
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text.color as string} />
      ) : (
        <Text style={[theme.typography.button, variantStyle.text]}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    minHeight: 44, // rule §10.4
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.6 },
});

const SIZE_STYLES = StyleSheet.create({
  sm: { paddingHorizontal: 12, paddingVertical: 8, minHeight: 36 },
  md: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 44 },
  lg: { paddingHorizontal: 20, paddingVertical: 14, minHeight: 52 },
});

function variantStyles(theme: ReturnType<typeof useTheme>, variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return { container: { backgroundColor: theme.colors.primary }, text: { color: theme.colors.textInverse } };
    case 'secondary':
      return { container: { backgroundColor: theme.colors.primaryMuted }, text: { color: theme.colors.primary } };
    case 'outline':
      return {
        container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.primary },
        text: { color: theme.colors.primary },
      };
    case 'danger':
      return { container: { backgroundColor: theme.colors.danger }, text: { color: theme.colors.textInverse } };
  }
}
