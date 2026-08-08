import { getDb } from '../../db/connection';
import { diaryMedia } from '../../db/schema';
import { inArray } from 'drizzle-orm';

export async function resolveDiaryMediaUris(mediaIds: Array<string | null | undefined>): Promise<Record<string, string>> {
  const ids = [...new Set(mediaIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return {};
  try {
    const db = getDb();
    const rows = await db.select().from(diaryMedia).where(inArray(diaryMedia.id, ids));
    const map: Record<string, string> = {};
    for (const row of rows) {
      if (row.local_file_path) map[row.id] = row.local_file_path;
    }
    return map;
  } catch {
    return {};
  }
}
