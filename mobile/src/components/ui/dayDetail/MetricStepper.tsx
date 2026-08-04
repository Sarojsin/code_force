import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from 'src/theme';
import { Text } from '../Text';

interface MetricStepperProps {
  label: string;
  icon: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (val: number) => string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MetricStepper({
  label,
  icon,
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  formatValue,
}: MetricStepperProps) {
  const theme = useTheme();
  const display = formatValue ? formatValue(value) : `${value}`;

  const decrement = () => onChange(Math.max(min, value - step));
  const increment = () => onChange(Math.min(max, value + step));

  return (
    <View>
      <View style={styles.header}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
        <Text variant="body" style={{ fontWeight: '600', flex: 1 }}>{label}</Text>
        <Text variant="h3" style={{ color: theme.colors.primaryDeep }}>{display}</Text>
      </View>
      <View style={styles.controls}>
        <StepperBtn label={`Decrease ${label}`} onPress={decrement} theme={theme} disabled={value <= min} />
        <StepperBtn label={`Increase ${label}`} onPress={increment} theme={theme} disabled={value >= max} isPlus />
      </View>
    </View>
  );
}

function StepperBtn({
  label,
  onPress,
  theme,
  disabled,
  isPlus,
}: {
  label: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
  disabled?: boolean;
  isPlus?: boolean;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.9, { damping: 12 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[
        styles.btn,
        anim,
        {
          backgroundColor: isPlus ? theme.colors.primaryDeep : theme.colors.surface,
          borderWidth: isPlus ? 0 : 1,
          borderColor: theme.colors.border,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Text style={{ fontSize: 18, fontWeight: '600', color: isPlus ? '#FFFFFF' : theme.colors.textStrong }}>
        {isPlus ? '+' : '−'}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  controls: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  btn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
