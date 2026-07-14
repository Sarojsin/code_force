/**
 * Provider tree.
 * Rule §2.2: QueryClientProvider wraps everything (server state).
 * Rule §2.1: ThemeProvider, GestureHandlerRootView, SafeAreaProvider wrap
 * navigation so screens can rely on them being present.
 *
 * Phase 1b: persistQueryClient with AsyncStorage for offline cache survival.
 */

import React, { ReactNode } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemeProvider } from 'src/theme';

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'REACT_QUERY_OFFLINE_CACHE',
  throttleTime: 1000,
});

const CACHE_BUSTER = 'v1';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        const status = error?.response?.status;
        if (status === 401 || status === 404) return false;
        return failureCount < 2;
      },
      staleTime: 5 * 60_000,
      gcTime: 24 * 60 * 60_000,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 0,
      networkMode: 'offlineFirst',
    },
  },
});

persistQueryClient({
  queryClient,
  persister: asyncStoragePersister,
  maxAge: 7 * 24 * 60 * 60_000,
  buster: CACHE_BUSTER,
});

export { queryClient };

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1, overflow: Platform.OS === 'web' ? ('auto' as any) : 'hidden' }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>{children}</ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
