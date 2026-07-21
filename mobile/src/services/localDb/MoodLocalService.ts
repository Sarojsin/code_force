import { getDb } from '../../db/connection';
import { moodLogs } from '../../db/schema';
import type { MoodLog } from '../../db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { BaseLocalService } from './BaseLocalService';

export class MoodLocalService extends BaseLocalService<MoodLog> {
  protected table = moodLogs;
  protected tableName = 'mood_logs';

  async getByDateRange(userId: string, startDate: string, endDate: string): Promise<MoodLog[]> {
    try {
      const db = getDb();
      return (await db
        .select()
        .from(moodLogs)
        .where(
          and(
            eq(moodLogs.user_id, userId),
            gte(moodLogs.logged_at, startDate),
            lte(moodLogs.logged_at, endDate),
            eq(moodLogs.is_active, true)
          )
        )
        .orderBy(desc(moodLogs.logged_at))) as MoodLog[];
    } catch (error) {
      this.handleError('getByDateRange', error);
      return [];
    }
  }

  async getAverageByMonth(userId: string, months = 3): Promise<{ month: string; avg_intensity: number }[]> {
    try {
      const db = getDb();
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      const rows = await db
        .select({
          month: sql`strftime('%Y-%m', ${moodLogs.logged_at})`.as('month'),
          avg_intensity: sql`ROUND(AVG(${moodLogs.intensity}), 1)`.as('avg_intensity'),
        })
        .from(moodLogs)
        .where(
          and(
            eq(moodLogs.user_id, userId),
            gte(moodLogs.logged_at, cutoff.toISOString()),
            eq(moodLogs.is_active, true)
          )
        )
        .groupBy(sql`strftime('%Y-%m', ${moodLogs.logged_at})`)
        .orderBy(sql`month`);
      return rows as { month: string; avg_intensity: number }[];
    } catch (error) {
      this.handleError('getAverageByMonth', error);
      return [];
    }
  }
}
