import { eq } from 'drizzle-orm';
import { getDb } from '../../db/connection';
import { featureFlags } from '../../db/schema';
import type { FeatureFlag } from '../../db/schema';
import { logger } from '../../utils';
import * as Sentry from '@sentry/react-native';

export class FeatureFlagLocalService {
  async getAll(): Promise<FeatureFlag[]> {
    try {
      const db = getDb();
      return (await db.select().from(featureFlags)) as FeatureFlag[];
    } catch (error) {
      this.handleError('getAll', error);
      return [];
    }
  }

  async getByKey(key: string): Promise<FeatureFlag | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(featureFlags)
        .where(eq(featureFlags.key, key))
        .limit(1);
      return (result as FeatureFlag[])[0] ?? null;
    } catch (error) {
      this.handleError('getByKey', error);
      return null;
    }
  }

  async upsert(record: FeatureFlag): Promise<void> {
    try {
      const db = getDb();
      await db
        .insert(featureFlags)
        .values({ ...record, synced_at: new Date().toISOString() })
        .onConflictDoUpdate({
          target: featureFlags.key,
          set: { ...record, synced_at: new Date().toISOString() },
        });
    } catch (error) {
      this.handleError('upsert', error);
    }
  }

  async upsertMany(records: FeatureFlag[]): Promise<void> {
    if (records.length === 0) return;
    try {
      const db = getDb();
      for (const record of records) {
        await db
          .insert(featureFlags)
          .values({ ...record, synced_at: new Date().toISOString() })
          .onConflictDoUpdate({
            target: featureFlags.key,
            set: { ...record, synced_at: new Date().toISOString() },
          });
      }
    } catch (error) {
      this.handleError('upsertMany', error);
    }
  }

  private handleError(method: string, error: unknown): void {
    logger.error('feature_flags.' + method + ' failed', error);
    Sentry.captureException(error, {
      tags: { service: 'FeatureFlagLocalService', method },
    });
  }
}
