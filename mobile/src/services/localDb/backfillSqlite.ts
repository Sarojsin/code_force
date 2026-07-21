import { queryClient } from '../../app/providers';
import { localDb } from './index';
import { logger } from '../../utils';
import * as Sentry from '@sentry/react-native';

const BACKFILLED_KEY = 'shecare.sqlite.backfilled';

export async function backfillSqliteIfNeeded(): Promise<void> {
  try {
    const { getItemAsync, setItemAsync } = await import('expo-secure-store');
    const alreadyBackfilled = await getItemAsync(BACKFILLED_KEY);
    if (alreadyBackfilled === 'true') return;

    const cacheKeys = [
      ['cycle', 'entries'],
      ['wellness', 'journal'],
      ['wellness', 'moodLogs'],
      ['safety', 'contacts'],
      ['safety', 'sosHistory'],
      ['family', 'links'],
      ['pregnancy', 'profile'],
      ['pregnancy', 'milestones'],
    ] as const;

    const backfillMap: Record<string, (records: any[]) => Promise<void>> = {
      cycle: (records) => localDb.cycle.upsertMany(records),
      journal: (records) => localDb.journal.upsertMany(records),
      moodLogs: (records) => localDb.mood.upsertMany(records),
      contacts: (records) => localDb.emergencyContact.upsertMany(records),
      sosHistory: (records) => localDb.sosAlert.upsertMany(records),
      links: (records) => localDb.familyLink.upsertMany(records),
      profile: (records) => localDb.pregnancyProfile.upsertMany(records),
      milestones: (records) => localDb.pregnancyMilestone.upsertMany(records),
    };

    let totalRecords = 0;
    for (const [scope, key] of cacheKeys) {
      const data = queryClient.getQueryData([scope, key]);
      if (Array.isArray(data) && data.length > 0) {
        const backfill = backfillMap[key];
        if (backfill) {
          await backfill(data);
          totalRecords += data.length;
        }
      }
    }

    await setItemAsync(BACKFILLED_KEY, 'true');
    logger.info('SQLite backfill complete', { records: totalRecords });
  } catch (error) {
    logger.error('SQLite backfill failed', error);
  }
}
