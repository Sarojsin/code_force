import { getDb } from '../../db/connection';
import { diaryPages } from '../../db/schema';
import type { DiaryPage } from '../../db/schema';
import { eq, and, asc, desc, like } from 'drizzle-orm';
import { BaseLocalService } from './BaseLocalService';

export class DiaryPageLocalService extends BaseLocalService<DiaryPage> {
  protected table = diaryPages;
  protected tableName = 'diary_pages';

  async getByDiary(diaryId: string): Promise<DiaryPage[]> {
    try {
      const db = getDb();
      return (await db
        .select()
        .from(diaryPages)
        .where(and(eq(diaryPages.diary_id, diaryId), eq(diaryPages.is_active, true)))
        .orderBy(asc(diaryPages.page_number))) as DiaryPage[];
    } catch (error) {
      this.handleError('getByDiary', error);
      return [];
    }
  }

  async getByDate(diaryId: string, date: string): Promise<DiaryPage | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(diaryPages)
        .where(
          and(
            eq(diaryPages.diary_id, diaryId),
            eq(diaryPages.page_date, date),
            eq(diaryPages.is_active, true),
          )
        )
        .limit(1);
      return (result as DiaryPage[])[0] ?? null;
    } catch (error) {
      this.handleError('getByDate', error);
      return null;
    }
  }

  async getByMonth(year: number, month: number): Promise<DiaryPage[]> {
    try {
      const db = getDb();
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      return (await db
        .select()
        .from(diaryPages)
        .where(
          and(
            eq(diaryPages.is_active, true),
            like(diaryPages.page_date, `${prefix}%`),
          )
        )
        .orderBy(desc(diaryPages.page_date))) as DiaryPage[];
    } catch (error) {
      this.handleError('getByMonth', error);
      return [];
    }
  }
}
