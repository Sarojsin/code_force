import { getDb } from '../../db/connection';
import { diaryMedia } from '../../db/schema';
import type { DiaryMedia } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { BaseLocalService } from './BaseLocalService';

export class DiaryMediaLocalService extends BaseLocalService<DiaryMedia> {
  protected table = diaryMedia;
  protected tableName = 'diary_media';

  async getPendingUploads(userId: string): Promise<DiaryMedia[]> {
    try {
      const db = getDb();
      return (await db
        .select()
        .from(diaryMedia)
        .where(
          and(
            eq(diaryMedia.user_id, userId),
            eq(diaryMedia.upload_status, 'local'),
            eq(diaryMedia.is_active, true),
          )
        )) as DiaryMedia[];
    } catch (error) {
      this.handleError('getPendingUploads', error);
      return [];
    }
  }

  async markUploaded(id: string, s3Key: string): Promise<void> {
    try {
      const db = getDb();
      await db
        .update(diaryMedia)
        .set({ upload_status: 'synced', s3_key: s3Key, synced_at: new Date().toISOString() })
        .where(eq(diaryMedia.id, id));
    } catch (error) {
      this.handleError('markUploaded', error);
    }
  }
}
