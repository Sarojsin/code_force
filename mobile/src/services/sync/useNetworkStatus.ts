import { useEffect, useState, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  connectionType: string | null;
}

export function useNetworkStatus(): NetworkStatus {
  // E2E_TEST_OFFLINE launch arg overrides network status for deterministic E2E testing.
  // Set via device.launchApp({ launchArgs: { E2E_TEST_OFFLINE: 'true' } }) in e2e tests.
  const e2eOffline = __DEV__ && (globalThis as any).E2E_TEST_OFFLINE === 'true';
  const isE2eOverride = __DEV__ && typeof (globalThis as any).E2E_TEST_OFFLINE !== 'undefined';

  const [status, setStatus] = useState<NetworkStatus>(() => ({
    isConnected: isE2eOverride ? !e2eOffline : true,
    connectionType: isE2eOverride ? 'cellular' : null,
  }));

  const handleChange = useCallback((state: NetInfoState) => {
    if (!isE2eOverride) {
      setStatus({
        isConnected: state.isConnected ?? false,
        connectionType: state.type,
      });
    }
  }, [isE2eOverride]);

  useEffect(() => {
    if (isE2eOverride) return;
    const unsub = NetInfo.addEventListener(handleChange);
    return () => unsub();
  }, [isE2eOverride, handleChange]);

  return status;
}
