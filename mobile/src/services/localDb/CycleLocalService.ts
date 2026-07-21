import { getDb } from '../../db/connection';
import { cycleEntries } from '../../db/schema';
import type { CycleEntry } from '../../db/schema';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { BaseLocalService } from './BaseLocalService';

export class CycleLocalService extends BaseLocalService<CycleEntry> {
  protected table = cycleEntries;
  protected tableName = 'cycle_entries';

  async getHistory(
    userId: string,
    options?: { limit?: number; offset?: number; months?: number }
  ): Promise<CycleEntry[]> {
    try {
      const db = getDb();
      const conditions = [eq(cycleEntries.user_id, userId), eq(cycleEntries.is_active, true)];
      if (options?.months) {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - options.months);
        conditions.push(gte(cycleEntries.period_start_date, cutoff.toISOString().split('T')[0]));
      }
      return (await db
        .select()
        .from(cycleEntries)
        .where(and(...conditions))
        .orderBy(desc(cycleEntries.period_start_date))
        .limit(options?.limit ?? 50)
        .offset(options?.offset ?? 0)) as CycleEntry[];
    } catch (error) {
      this.handleError('getHistory', error);
      return [];
    }
  }

  async getByDateRange(userId: string, startDate: string, endDate: string): Promise<CycleEntry[]> {
    try {
      const db = getDb();
      return (await db
        .select()
        .from(cycleEntries)
        .where(
          and(
            eq(cycleEntries.user_id, userId),
            eq(cycleEntries.is_active, true),
            gte(cycleEntries.period_start_date, startDate),
            sql`(${cycleEntries.period_end_date} IS NULL OR ${cycleEntries.period_end_date} <= ${endDate})`
          )
        )
        .orderBy(desc(cycleEntries.period_start_date))) as CycleEntry[];
    } catch (error) {
      this.handleError('getByDateRange', error);
      return [];
    }
  }

  async getLatest(userId: string): Promise<CycleEntry | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(cycleEntries)
        .where(and(eq(cycleEntries.user_id, userId), eq(cycleEntries.is_active, true)))
        .orderBy(desc(cycleEntries.period_start_date))
        .limit(1);
      return (result as CycleEntry[])[0] ?? null;
    } catch (error) {
      this.handleError('getLatest', error);
      return null;
    }
  }
}
