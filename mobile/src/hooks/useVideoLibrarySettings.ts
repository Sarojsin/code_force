import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'shecare.smart_recommendations';
const DEFAULT_ENABLED = true;

/**
 * Global master switch for the Smart Health Library "For You" feature.
 * Plain AsyncStorage (non-sensitive preference, no PII — frontend rule §2.13
 * only requires encrypted storage for tokens/keys). Default ON.
 */
export interface VideoLibrarySettings {
  smartRecommendationsEnabled: boolean;
  isLoaded: boolean;
  setSmartRecommendationsEnabled: (value: boolean) => void;
}

export function useVideoLibrarySettings(): VideoLibrarySettings {
  const [enabled, setEnabled] = useState<boolean>(DEFAULT_ENABLED);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw !== null) {
          try {
            setEnabled((JSON.parse(raw) as { enabled?: boolean }).enabled ?? DEFAULT_ENABLED);
          } catch {
            setEnabled(DEFAULT_ENABLED);
          }
        }
        setIsLoaded(true);
      })
      .catch(() => {
        if (mounted) setIsLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setSmartRecommendationsEnabled = useCallback((value: boolean) => {
    setEnabled(value);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: value })).catch(() => {});
  }, []);

  return {
    smartRecommendationsEnabled: enabled,
    isLoaded,
    setSmartRecommendationsEnabled,
  };
}