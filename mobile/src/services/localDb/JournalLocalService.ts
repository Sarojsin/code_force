import { getDb } from '../../db/connection';
import { journalEntries } from '../../db/schema';
import type { JournalEntry } from '../../db/schema';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { BaseLocalService } from './BaseLocalService';

export class JournalLocalService extends BaseLocalService<JournalEntry> {
  protected table = journalEntries;
  protected tableName = 'journal_entries';

  async getRecent(userId: string, limit: number = 20): Promise<JournalEntry[]> {
    try {
      const db = getDb();
      return (await db
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.user_id, userId), eq(journalEntries.is_active, true)))
        .orderBy(desc(journalEntries.entry_date))
        .limit(limit)) as JournalEntry[];
    } catch (error) {
      this.handleError('getRecent', error);
      return [];
    }
  }

  async getByDate(userId: string, date: string): Promise<JournalEntry | null> {
    try {
      const db = getDb();
      const result = await db
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.user_id, userId),
            eq(journalEntries.entry_date, date),
            eq(journalEntries.is_active, true)
          )
        )
        .limit(1);
      return (result as JournalEntry[])[0] ?? null;
    } catch (error) {
      this.handleError('getByDate', error);
      return null;
    }
  }

  async getByMoodTags(userId: string, moodTags: string[], limit = 20): Promise<JournalEntry[]> {
    try {
      const db = getDb();
      const conditions = [eq(journalEntries.user_id, userId), eq(journalEntries.is_active, true)];
      const likes = moodTags.map(tag => sql`${journalEntries.mood} LIKE ${'%' + tag + '%'}`);
      return (await db
        .select()
        .from(journalEntries)
        .where(and(...conditions, ...likes))
        .orderBy(desc(journalEntries.entry_date))
        .limit(limit)) as JournalEntry[];
    } catch (error) {
      this.handleError('getByMoodTags', error);
      return [];
    }
  }
}
