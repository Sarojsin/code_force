import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNativeDb, runExclusive } from '../../db/connection';
import { pruneLocalDb } from '../localDb/pruneLocalDb';
import { logger } from '../../utils';

const TASK_NAME = 'shecare-db-maintenance';

const LAST_RUN_KEY = 'shecare.db_maintenance.last_run';
const MIN_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MINIMUM_FETCH_INTERVAL_SECONDS = 30 * 24 * 60 * 60; // 2,592,000 s = 30 days

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const lastRunRaw = await AsyncStorage.getItem(LAST_RUN_KEY).catch(() => null);
    const lastRun = lastRunRaw ? new Date(lastRunRaw).getTime() : 0;
    if (Date.now() - lastRun < MIN_INTERVAL_MS) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    await pruneLocalDb();
    // VACUUM needs an exclusive lock — run it inside the same serialization
    // queue as the Drizzle proxy, otherwise a concurrent mood/journal upsert
    // can hit "database is locked" mid-statement.
    await runExclusive(async () => {
      await (await getNativeDb()).execAsync('VACUUM');
    });

    await AsyncStorage.setItem(LAST_RUN_KEY, new Date().toISOString()).catch(() => {});
    logger.info('db_maintenance.complete');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    logger.warn('db_maintenance.failed', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerDbMaintenance(): Promise<void> {
  try {
    await BackgroundFetch.registerTaskAsync(TASK_NAME, {
      minimumInterval: MINIMUM_FETCH_INTERVAL_SECONDS,
      stopOnTerminate: false,
      startOnBoot: true,
    });
    logger.info('db_maintenance.registered');
  } catch (err) {
    logger.warn('db_maintenance.register_failed', err);
  }
}
