import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';

import { useTheme } from 'src/theme';
import { Text } from './Text';

export interface SymptomGridProps {
  selected: string[];
  onToggle: (symptom: string) => void;
  symptoms: string[];
  max?: number;
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
          <Pressable
            key={symptom}
            onPress={() => onToggle(symptom)}
            disabled={disabled}
            accessibilityLabel={`${symptom}${isSelected ? ', selected' : ''}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled }}
            style={[
              styles.chip,
              {
                borderRadius: theme.radius.pill,
                minHeight: theme.minTouchTarget,
                paddingHorizontal: theme.spacing.lg,
              },
              isSelected
                ? { backgroundColor: theme.colors.primary }
                : {
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  },
              disabled && !isSelected && { opacity: 0.4 },
            ]}
          >
            <Text
              variant="bodySmall"
              color={isSelected ? 'inverse' : 'primary'}
            >
              {symptom}
            </Text>
          </Pressable>
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
  },
});
