import { getDb } from '../../db/connection';
import { diaryPageObjects } from '../../db/schema';
import type { DiaryPageObject } from '../../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { BaseLocalService } from './BaseLocalService';

export class DiaryPageObjectLocalService extends BaseLocalService<DiaryPageObject> {
  protected table = diaryPageObjects;
  protected tableName = 'diary_page_objects';

  async getByPage(pageId: string): Promise<DiaryPageObject[]> {
    try {
      const db = getDb();
      return (await db
        .select()
        .from(diaryPageObjects)
        .where(and(eq(diaryPageObjects.page_id, pageId), eq(diaryPageObjects.is_active, true)))
        .orderBy(asc(diaryPageObjects.z_index))) as DiaryPageObject[];
    } catch (error) {
      this.handleError('getByPage', error);
      return [];
    }
  }
}
