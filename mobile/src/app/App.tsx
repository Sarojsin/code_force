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
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { AppProviders, queryClient } from './providers';
import { RootNavigator } from 'src/navigation';
import { ConnectivityBanner } from 'src/components/ui/ConnectivityBanner';
import { logger } from 'src/utils';
import { useWellnessHydration } from 'src/services/ml';
import { useOfflineStore } from 'src/stores/offlineStore';
import { navigate } from 'src/navigation/rootNavigation';
import { syncAll, setQueryClient } from 'src/services/sync';

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

export default function App() {
  useWellnessHydration();
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const hydrate = useOfflineStore((s) => s.hydrate);

  useEffect(() => {
    setQueryClient(queryClient);
    void hydrate();
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
      }
      appState.current = next;
    });

    return () => {
      unsubNet();
      sub.remove();
    };
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.type === 'checkin') {
        navigate('Main', { screen: 'Calendar', params: { screen: 'CycleDashboard' } });
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <AppProviders>
      <View style={{ flex: 1 }}>
        <StatusBar barStyle="default" />
        <ConnectivityBanner />
        <RootNavigator />
        <Toast />
      </View>
    </AppProviders>
  );
}
