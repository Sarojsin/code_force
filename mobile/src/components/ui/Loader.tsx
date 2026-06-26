import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from 'src/theme';

export interface LoaderProps {
  fullScreen?: boolean;
  color?: string;
  size?: 'small' | 'large';
}

export function Loader({ fullScreen = false, color, size = 'large' }: LoaderProps) {
  const theme = useTheme();
  const indicatorColor = color ?? theme.colors.primary;

  if (!fullScreen) {
    return (
      <ActivityIndicator
        size={size}
        color={indicatorColor}
        accessibilityLabel="Loading"
        accessibilityRole="progressbar"
      />
    );
  }

  return (
    <View
      style={[styles.overlay, { backgroundColor: theme.colors.background + 'CC' }]}
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    >
      <ActivityIndicator size={size} color={indicatorColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
});
