import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { drizzle, type AsyncRemoteCallback, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';

let dbInstance: SqliteRemoteDatabase | null = null;
let nativeDb: SQLiteDatabase | null = null;
let openPromise: Promise<SQLiteDatabase> | null = null;
let operationQueue: Promise<unknown> = Promise.resolve();

function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const next = operationQueue.then(task, task);
  operationQueue = next.catch(() => undefined);
  return next;
}

export async function getNativeDb(): Promise<SQLiteDatabase> {
  if (nativeDb) {
    return nativeDb;
  }
  if (!openPromise) {
    openPromise = openDatabaseAsync('shecare.db');
  }
  nativeDb = await openPromise;
  return nativeDb;
}

const remoteCallback: AsyncRemoteCallback = (sql, params, method) =>
  runExclusive(async () => {
    const db = await getNativeDb();
    if (method === 'run') {
      await db.runAsync(sql, params);
      return { rows: [] };
    }
    const statement = await db.prepareAsync(sql);
    try {
      const result = await statement.executeForRawResultAsync(params);
      if (method === 'get') {
        const row = await result.getFirstAsync();
        return { rows: row as never };
      }
      const rows = await result.getAllAsync();
      return { rows };
    } finally {
      await statement.finalizeAsync();
    }
  });

export function getDb(): SqliteRemoteDatabase {
  if (!dbInstance) {
    dbInstance = drizzle(remoteCallback);
  }
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (nativeDb) {
    try {
      await nativeDb.closeAsync();
    } catch {
      // ignore close errors
    }
  }
  dbInstance = null;
  nativeDb = null;
  openPromise = null;
}
