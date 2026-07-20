/**
 * App entry. Wires providers, navigator, and global UI overlays.
 * Rule §1.3: navigation state in Zustand, not in component state.
 * Rule §14.3: clear in-memory sensitive state on background.
 * Phase 5: offline sync + connectivity banner + background sync.
 */

import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, StatusBar, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Toast from 'react-native-toast-message';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
import { useWellnessHydration } from 'src/services/ml';
import { useOfflineStore } from 'src/stores/offlineStore';
import { navigate } from 'src/navigation/rootNavigation';
import { syncAll, setQueryClient } from 'src/services/sync';
import { initSyncBreadcrumbs } from 'src/services/sync/sentrySyncBreadcrumbs';
import { initSafetyQueueListener } from 'src/services/safetySyncQueue';

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
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
      timeInterval: 60000,
    });
    await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(loc.coords));
  } catch {}
}

export default function App() {
  useWellnessHydration();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const hydrate = useOfflineStore((s) => s.hydrate);

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
  }, []);

  useEffect(() => {
    const unsubNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        syncAll().catch((err) => logger.error('sync.on_reconnect', err));
      }
    });

    const sub = AppState.addEventListener('change', next => {
      if (appState.current.match(/active/) && next.match(/inactive|background/)) {
        logger.info('AppState.backgrounded');
      }
      if (next === 'active') {
        syncAll().catch((err) => logger.error('sync.on_foreground', err));
        updateLastKnownLocation();
      }
      appState.current = next;
    });

    return () => {
      unsubNet();
      sub.remove();
    };
  }, []);

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
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="default" />
        <ConnectivityBanner />
        <ErrorBoundary>
          <RootNavigator />
        </ErrorBoundary>
        <Toast />
      </View>
    </AppProviders>
  );
}
