import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useTheme } from 'src/theme';
import { useNetworkStatus } from 'src/services/sync';

export function ConnectivityBanner() {
  const { isConnected } = useNetworkStatus();
  const theme = useTheme();

  if (isConnected) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      style={[styles.banner, { backgroundColor: theme.colors.warning }]}
      accessibilityRole="alert"
      accessibilityLabel="You are offline. Changes will sync when you reconnect."
    >
      <Text style={[styles.text, { color: theme.colors.textInverse }]}>
        You're offline — changes saved locally
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
