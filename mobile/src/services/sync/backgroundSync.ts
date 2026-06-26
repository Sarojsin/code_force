import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { api } from 'src/services/api/client';
import { logger } from 'src/utils';
import { pullServerData } from './syncEngine';

const TASK_NAME = 'shecare-background-sync';

const MINIMUM_FETCH_INTERVAL_SECONDS = 15 * 24 * 60 * 60; // 1,296,000 s = 15 days

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    logger.info('[Background] Bi-weekly housekeeping sync started');

    const versionResp = await api.get('/cycle/models/status');
    const version = versionResp?.data?.data?.current_version ?? versionResp?.data?.current_version ?? null;
    logger.info('[Background] Current model version', { version });

    await pullServerData();

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    logger.error('[Background] sync failed', err);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: MINIMUM_FETCH_INTERVAL_SECONDS,
      stopOnTerminate: false,
      startOnBoot: true,
    });
    logger.info('[Background] Registered with 15-day interval');
  } catch (err) {
    logger.warn('[Background] Register failed', err);
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(TASK_NAME);
  } catch {}
}
