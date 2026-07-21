import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDb } from './index';
import { logger } from '../../utils';

export async function migrateStoreDataToSqlite(): Promise<void> {
  try {
    const cycleData = await AsyncStorage.getItem('shecare.cycle');
    if (cycleData) {
      const parsed = JSON.parse(cycleData);
      if (parsed.state?.entries?.length > 0) {
        await localDb.cycle.upsertMany(parsed.state.entries);
      }
      await AsyncStorage.removeItem('shecare.cycle');
    }

    const endDateData = await AsyncStorage.getItem('shecare.end_date_pending');
    if (endDateData) {
      const parsed = JSON.parse(endDateData);
      if (parsed.state?.entry) {
        await localDb.cycle.upsert(parsed.state.entry);
      }
      await AsyncStorage.removeItem('shecare.end_date_pending');
    }

    logger.info('Migrated store data to SQLite');
  } catch (error) {
    logger.error('Store data migration failed', error);
  }
}
