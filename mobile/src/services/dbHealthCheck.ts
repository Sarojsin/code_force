import { getDb } from '../db/connection';
import { sql } from 'drizzle-orm';
import { logger } from '../utils';
import * as Sentry from '@sentry/react-native';

export interface DbHealth {
  ok: boolean;
  version: number;
  tableCount: number;
  tables: string[];
  message?: string;
}

export async function checkDbHealth(): Promise<DbHealth> {
  try {
    const db = getDb();
    await db.run(sql`SELECT 1 AS ok`);
    const result = await db.all(sql`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `);
    const tables = (result as any[]).map((t: any) => t.name);
    return {
      ok: true,
      version: 1,
      tableCount: tables.length,
      tables,
      message: `Tables: ${tables.join(', ')}`,
    };
  } catch (error) {
    logger.error('DB health check failed', error);
    Sentry.captureException(error, { tags: { service: 'dbHealthCheck' } });
    return { ok: false, version: 0, tableCount: 0, tables: [], message: String(error) };
  }
}
