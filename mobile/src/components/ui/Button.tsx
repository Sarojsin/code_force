import React from 'react';
import { View, Pressable, StyleSheet, Text, ActivityIndicator, PressableProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from 'src/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
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
  const vStyle = variantStyles(theme, variant);
  const isDisabled = disabled || loading;

  const needsGradient = variant === 'primary' && !isDisabled;

  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 12 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 12 });
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: loading }}
      accessibilityLabel={label}
      style={[
        styles.base,
        sizeStyle,
        !needsGradient && vStyle.container,
        variant === 'primary' && !isDisabled && theme.shadow.primary,
        fullWidth && styles.fullWidth,
        isDisabled && variant !== 'primary' && styles.disabled,
        isDisabled && variant === 'primary' && styles.disabledPrimary,
        animatedStyle,
        { overflow: 'hidden' },
        style,
      ]}
      {...rest}
    >
      {needsGradient && (
        <LinearGradient
          colors={['#FF6B8A', '#D4507A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {isDisabled && variant === 'primary' && (
        <View style={[StyleSheet.absoluteFill, styles.disabledPrimaryBg]} />
      )}
      {loading ? (
        <ActivityIndicator size="small" color={vStyle.text.color as string} />
      ) : (
        <Text style={[theme.typography.button, { letterSpacing: 0.16 }, vStyle.text]}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    minHeight: 44,
  },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.6 },
  disabledPrimary: {
    backgroundColor: 'rgba(160,120,136,0.25)',
    borderRadius: 16,
  },
  disabledPrimaryBg: {
    backgroundColor: 'rgba(160,120,136,0.25)',
    borderRadius: 16,
  },
});

const SIZE_STYLES = StyleSheet.create({
  sm: { paddingHorizontal: 12, paddingVertical: 8, minHeight: 44 },
  md: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 44 },
  lg: { paddingHorizontal: 20, paddingVertical: 14, minHeight: 52 },
});

function variantStyles(theme: ReturnType<typeof useTheme>, variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return { container: null, text: { color: theme.colors.textInverse } };
    case 'secondary':
      return { container: { backgroundColor: theme.colors.primaryMuted }, text: { color: theme.colors.primary } };
    case 'outline':
      return {
        container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.primary },
        text: { color: theme.colors.primary },
      };
    case 'danger':
      return { container: { backgroundColor: theme.colors.danger }, text: { color: theme.colors.textInverse } };
    case 'ghost':
      return {
        container: {
          backgroundColor: 'rgba(255,255,255,0.6)',
          borderWidth: 1.5,
          borderColor: '#F7C5CC',
        },
        text: { color: '#FF6B8A' },
      };
  }
}
