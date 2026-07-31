import { getDb } from '../../db/connection';
import { diaries } from '../../db/schema';
import type { Diary } from '../../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { BaseLocalService } from './BaseLocalService';

export class DiaryLocalService extends BaseLocalService<Diary> {
  protected table = diaries;
  protected tableName = 'diaries';

  async getByUser(userId: string): Promise<Diary[]> {
    try {
      const db = getDb();
      return (await db
        .select()
        .from(diaries)
        .where(and(eq(diaries.user_id, userId), eq(diaries.is_active, true)))
        .orderBy(desc(diaries.updated_at))) as Diary[];
    } catch (error) {
      this.handleError('getByUser', error);
      return [];
    }
  }
}
