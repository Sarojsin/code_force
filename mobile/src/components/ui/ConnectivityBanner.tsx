import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useTheme } from 'src/theme';
import { useNetworkStatus } from 'src/services/sync';
import { useOfflineStore } from 'src/stores/offlineStore';

export function ConnectivityBanner() {
  const { isConnected } = useNetworkStatus();
  const pendingCount = useOfflineStore((s) => s.operations.length);
  const theme = useTheme();
  const [visible, setVisible] = useState(!isConnected);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isConnected) {
      timerRef.current = setTimeout(() => setVisible(false), 500);
    } else {
      setVisible(true);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isConnected]);

  if (!visible) return null;

  const message = pendingCount > 0
    ? `You're offline — ${pendingCount} ${pendingCount === 1 ? 'change' : 'changes'} will sync when connected`
    : "You're offline — your data will sync when you reconnect";

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      style={[styles.banner, { backgroundColor: theme.colors.warning }]}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <Text style={[styles.text, { color: theme.colors.textInverse }]}>
        {message}
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
