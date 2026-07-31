import { eq } from 'drizzle-orm';
import { getDb } from '../../db/connection';
import { diaryAssets } from '../../db/schema';
import { logger } from '../../utils';
import * as Sentry from '@sentry/react-native';

export class DiaryAssetLocalService {
  async getInstallStatus(userId: string): Promise<{ status: string; version: string | null } | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(diaryAssets)
        .where(eq(diaryAssets.user_id, userId))
        .limit(1);
      const row = result[0] as any;
      if (!row) return null;
      return { status: row.install_status ?? 'none', version: row.asset_version ?? null };
    } catch (error) {
      this.handleReadError(error);
      return null;
    }
  }

  async updateInstallStatus(userId: string, status: string, version?: string): Promise<void> {
    try {
      const db = getDb();
      const values: Record<string, any> = {
        id: `diary_${userId}`,
        user_id: userId,
        install_status: status,
      };
      if (version) values.asset_version = version;
      if (status === 'ready') values.installed_at = new Date().toISOString();
      await db
        .insert(diaryAssets)
        .values(values as any)
        .onConflictDoUpdate({
          target: diaryAssets.id,
          set: values,
        });
    } catch (error) {
      this.handleWriteError(error);
    }
  }

  private handleReadError(error: unknown): void {
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('no such table')) {
      logger.warn('DiaryAsset table not yet migrated — suppress error');
      return;
    }
    logger.error(`DiaryAssetLocalService.getInstallStatus failed`, error);
    Sentry.captureException(error, {
      tags: { service: 'DiaryAssetLocalService', method: 'getInstallStatus' },
    });
  }

  private handleWriteError(error: unknown): void {
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('no such table')) {
      logger.warn('DiaryAsset table not yet migrated — suppress error');
      return;
    }
    logger.error(`DiaryAssetLocalService.updateInstallStatus failed`, error);
    Sentry.captureException(error, {
      tags: { service: 'DiaryAssetLocalService', method: 'updateInstallStatus' },
    });
  }
}

export const diaryAssetLocalService = new DiaryAssetLocalService();
