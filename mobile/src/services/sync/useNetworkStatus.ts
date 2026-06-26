import { useEffect, useState, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export interface NetworkStatus {
  isConnected: boolean;
  connectionType: string | null;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    connectionType: null,
  });

  const handleChange = useCallback((state: NetInfoState) => {
    setStatus({
      isConnected: state.isConnected ?? false,
      connectionType: state.type,
    });
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(handleChange);
    return () => unsub();
  }, [handleChange]);

  return status;
}
