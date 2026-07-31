import { getNativeDb } from '../../db/connection';
import { logger } from '../../utils';

export interface FtsResult {
  id: string;
  rank: number;
}

export class DiarySearchLocalService {
  async search(query: string, limit = 50): Promise<FtsResult[]> {
    try {
      const db = getNativeDb();
      const sanitized = query.replace(/['"]/g, '');
      const sql = `
        SELECT rowid AS id, rank
        FROM diary_fts
        WHERE diary_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `;
      const results = db.getAllSync(sql, [sanitized, limit]) as FtsResult[];
      return results;
    } catch (error) {
      logger.error('DiarySearchLocalService.search failed', error);
      return [];
    }
  }

  async rebuildIndex(): Promise<void> {
    try {
      const db = getNativeDb();
      db.execSync('INSERT INTO diary_fts(diary_fts) VALUES(\'rebuild\')');
    } catch (error) {
      logger.error('DiarySearchLocalService.rebuildIndex failed', error);
    }
  }
}
