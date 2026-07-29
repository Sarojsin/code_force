import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { useTheme } from 'src/theme';
import { Text } from './Text';

export interface SymptomGridProps {
  selected: string[];
  onToggle: (symptom: string) => void;
  symptoms: string[];
  max?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function SymptomChip({
  symptom,
  isSelected,
  disabled,
  onPress,
  theme,
}: {
  symptom: string;
  isSelected: boolean;
  disabled: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={() => { scale.value = withSpring(0.95, { damping: 12 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 12 }); }}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={`${symptom}${isSelected ? ', selected' : ''}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected, disabled }}
      style={[
        styles.chip,
        animatedStyle,
        isSelected
          ? {
              backgroundColor: '#FF6B8A',
              ...theme.shadow.chip,
            }
          : {
              backgroundColor: 'rgba(255,255,255,0.75)',
              borderWidth: 1.5,
              borderColor: '#FF6B8A44',
            },
        disabled && !isSelected && { opacity: 0.4 },
      ]}
    >
      <Text
        variant="chip"
        style={{ color: isSelected ? '#FFFFFF' : '#2D1B26' }}
      >
        {symptom}
      </Text>
    </AnimatedPressable>
  );
}

export function SymptomGrid({ selected, onToggle, symptoms, max }: SymptomGridProps) {
  const theme = useTheme();
  const atLimit = max !== undefined && selected.length >= max;

  return (
    <View style={styles.grid} accessibilityLabel="Symptom selector" accessibilityRole="list">
      {symptoms.map((symptom) => {
        const isSelected = selected.includes(symptom);
        const disabled = !isSelected && atLimit;

        return (
          <SymptomChip
            key={symptom}
            symptom={symptom}
            isSelected={isSelected}
            disabled={disabled}
            onPress={() => onToggle(symptom)}
            theme={theme}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
    paddingHorizontal: 13,
    paddingVertical: 5,
    minHeight: 44,
  },
});
