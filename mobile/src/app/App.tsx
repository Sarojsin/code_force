/**
 * App entry. Wires providers, navigator, and global UI overlays.
 * Rule §1.3: navigation state in Zustand, not in component state.
 * Rule §14.3: clear in-memory sensitive state on background.
 * Phase 2: SQLite migrations run before UI renders.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, AppStateStatus, InteractionManager, StatusBar, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runMigrations } from '../db/runMigrations';

import { AppProviders, queryClient } from './providers';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
import { RootNavigator } from 'src/navigation';
import { ConnectivityBanner } from 'src/components/ui/ConnectivityBanner';
import { ErrorBoundary } from 'src/components/ui/ErrorBoundary';
import { logger } from 'src/utils';
import { useOfflineStore } from 'src/stores/offlineStore';
import { navigate } from 'src/navigation/rootNavigation';
import { syncAll, setQueryClient } from 'src/services/sync';
import { registerDbMaintenance } from 'src/services/sync/dbMaintenance';
import { initSyncBreadcrumbs } from 'src/services/sync/sentrySyncBreadcrumbs';
import { initSafetyQueueListener } from 'src/services/safetySyncQueue';
import { pruneLocalDb } from 'src/services/localDb/pruneLocalDb';
import { backfillSqliteIfNeeded } from 'src/services/localDb/backfillSqlite';
import { migrateStoreDataToSqlite } from 'src/services/localDb/migrateStoreDataToSqlite';
import { cleanupObsoleteKeys } from 'src/services/localDb/cleanupObsoleteKeys';

const LAST_LOCATION_KEY = 'shecare.last_known_location';

const BACKGROUND_SYNC_TASK = 'shecare-background-sync';

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    await syncAll();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    logger.error('background_sync.failed', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

async function updateLastKnownLocation(): Promise<void> {
  try {
    const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      if (status !== 'undetermined' || !canAskAgain) return;
      const req = await Location.requestForegroundPermissionsAsync();
      if (req.status !== 'granted') return;
    }
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
      timeInterval: 60000,
    });
    await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(loc.coords));
  } catch {}
}

function MigrationGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const cleaned = useRef(false);

  useEffect(() => {
    let cancelled = false;
    runMigrations()
      .then(() => {
        if (!cancelled) setStatus('success');
      })
      .catch((err: unknown) => {
        logger.error('SQLite migration failed', err);
        if (!cancelled) setStatus('error');
        Toast.show({ type: 'error', text1: 'Local storage unavailable — offline features may be limited.' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status === 'success' && !cleaned.current) {
      cleaned.current = true;
      AsyncStorage.removeItem('REACT_QUERY_OFFLINE_CACHE').catch(() => {});
      InteractionManager.runAfterInteractions(async () => {
        await pruneLocalDb();
        migrateStoreDataToSqlite().then(() => {
          cleanupObsoleteKeys();
        });
        backfillSqliteIfNeeded();
      });
    }
  }, [status]);

  if (status !== 'pending') {
    return <>{children}</>;
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12 }}>Preparing your data...</Text>
    </View>
  );
}

export default function App() {
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const hydrate = useOfflineStore((s) => s.hydrate);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSyncAll = useRef(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncAll().catch((err) => logger.error('sync.debounced_failed', err));
    }, 300);
  }).current;

  useEffect(() => {
    setQueryClient(queryClient);
    void hydrate();
    initSyncBreadcrumbs();
    const unsubSafety = initSafetyQueueListener();
    return () => { if (unsubSafety) unsubSafety(); };
  }, [hydrate]);

  useEffect(() => {
    BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    }).catch((err) => logger.warn('background_fetch.register_failed', err));
    registerDbMaintenance();
  }, []);

  useEffect(() => {
    const unsubNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        debouncedSyncAll();
      }
    });

    const sub = AppState.addEventListener('change', next => {
      if (appState.current.match(/active/) && next.match(/inactive|background/)) {
        logger.info('AppState.backgrounded');
      }
      if (next === 'active') {
        debouncedSyncAll();
        updateLastKnownLocation();
      }
      appState.current = next;
    });

    return () => {
      unsubNet();
      sub.remove();
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [debouncedSyncAll]);

  useEffect(() => {
    updateLastKnownLocation();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.type === 'checkin') {
        navigate('Main', { screen: 'Calendar', params: { screen: 'CycleDashboard' } });
      } else if (data?.type === 'mark-end-date') {
        navigate('Main', { screen: 'Calendar', params: { screen: 'CycleDashboard', params: { markEndDate: true } } });
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <AppProviders>
      <MigrationGate>
        <View style={{ flex: 1 }}>
          <StatusBar barStyle="default" />
          <ConnectivityBanner />
          <ErrorBoundary>
            <RootNavigator />
          </ErrorBoundary>
          <Toast />
        </View>
      </MigrationGate>
    </AppProviders>
  );
}
