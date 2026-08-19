import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Text, useColorScheme } from 'react-native';

import { EncryptedStorage } from 'src/services/storage';
import { prefetchAppData } from 'src/services/queries/prefetch';
import { useAuthStore } from 'src/stores/authStore';

const PREWARM_KEYS = [
  'shecare.user',
  'shecare.onboarding.completed',
  'user_preferences',
  'shecare.session_analytics_id',
] as const;

const PREWARM_TIMEOUT_MS = 500;

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const prewarm = async () => {
      const timeoutPromise = new Promise<void>((resolve) =>
        setTimeout(resolve, PREWARM_TIMEOUT_MS),
      );

      const prewarmPromise = (async () => {
        // Parallel pre-warm: read all keys in a single batch
        await Promise.allSettled(
          PREWARM_KEYS.map((key) => EncryptedStorage.getItem(key)),
        );
        // Fire-and-forget query pre-warm for the first Home paint. Never
        // blocks `ready` — TTI must not wait on the network.
        const storedUser = await EncryptedStorage.getItem('shecare.user');
        const userId = (() => {
          try {
            const parsed = storedUser ? JSON.parse(storedUser) : null;
            return parsed?.id ?? parsed?.user?.id ?? null;
          } catch {
            return null;
          }
        })();
        prefetchAppData(userId ?? useAuthStore.getState().user?.id ?? null).catch(() => {});
      })();

      await Promise.race([prewarmPromise, timeoutPromise]);

      // Give the UI a moment to settle
      if (!cancelled) {
        readyTimerRef.current = setTimeout(() => setReady(true), 150);
      }
    };

    prewarm();

    return () => {
      cancelled = true;
      if (readyTimerRef.current) {
        clearTimeout(readyTimerRef.current);
        readyTimerRef.current = null;
      }
    };
  }, []);

  if (!ready) {
    return (
      <View style={[styles.container, isDark ? styles.containerDark : styles.containerLight]}>
        <ActivityIndicator size="large" color={isDark ? '#FFB3C6' : '#FF6B8A'} />
        <Text style={[styles.label, isDark ? styles.labelDark : styles.labelLight]}>
          Preparing your space…
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerLight: { backgroundColor: '#FFFFFF' },
  containerDark: { backgroundColor: '#1A1D26' },
  label: {
    marginTop: 12,
    fontSize: 14,
  },
  labelLight: { color: '#7B8194' },
  labelDark: { color: '#C7CCD6' },
});
