import { getNativeDb, runExclusive } from '../../db/connection';
import { logger } from '../../utils';

export interface FtsResult {
  id: string;
  rank: number;
}

export class DiarySearchLocalService {
  async search(query: string, limit = 50): Promise<FtsResult[]> {
    try {
      return await runExclusive(async () => {
        const db = await getNativeDb();
        const sanitized = query.replace(/['"]/g, '');
        const sql = `
        SELECT rowid AS id, rank
        FROM diary_fts
        WHERE diary_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `;
        const results = await db.getAllAsync<FtsResult>(sql, [sanitized, limit]);
        return results;
      });
    } catch (error) {
      logger.error('DiarySearchLocalService.search failed', error);
      return [];
    }
  }

  async rebuildIndex(): Promise<void> {
    try {
      await runExclusive(async () => {
        const db = await getNativeDb();
        await db.execAsync('INSERT INTO diary_fts(diary_fts) VALUES(\'rebuild\')');
      });
    } catch (error) {
      logger.error('DiarySearchLocalService.rebuildIndex failed', error);
    }
  }
}
