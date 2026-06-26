import React from 'react';
import { View, StyleSheet } from 'react-native';

import { Text } from './Text';
import { useTheme } from 'src/theme';

export interface ProgressDotsProps {
  current: number;
  total: number;
}

export function ProgressDots({ current, total }: ProgressDotsProps) {
  const theme = useTheme();
  return (
    <View style={styles.container} accessibilityLabel={`Step ${current} of ${total}`}>
      <Text variant="caption" color="muted">{current}/{total}</Text>
      <View style={styles.dots}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < current ? theme.colors.primary : theme.colors.border,
                width: i < current ? 20 : 8,
                borderRadius: 4,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 24 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { height: 8 },
});