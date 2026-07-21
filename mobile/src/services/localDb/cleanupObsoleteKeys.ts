import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils';

const OBSOLETE_KEYS = [
  'shecare.cycle',
  'shecare.end_date_pending',
];

export async function cleanupObsoleteKeys(): Promise<void> {
  try {
    for (const key of OBSOLETE_KEYS) {
      await AsyncStorage.removeItem(key);
    }
    logger.info('Cleaned up obsolete AsyncStorage keys', { keys: OBSOLETE_KEYS });
  } catch (error) {
    logger.error('AsyncStorage cleanup failed', error);
  }
}
