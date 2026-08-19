import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { drizzle, type AsyncRemoteCallback, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';

let dbInstance: SqliteRemoteDatabase | null = null;
let nativeDb: SQLiteDatabase | null = null;
let openPromise: Promise<SQLiteDatabase> | null = null;
let operationQueue: Promise<unknown> = Promise.resolve();

/** Serialized task runner for SQLite operations. All raw native-db access
 *  (including Drizzle ORM via remoteCallback) is funneled through this queue
 *  to prevent concurrent-write lock conflicts. Exposed so non-Drizzle callers
 *  (e.g., pruneLocalDb) can also participate in the serialization. */
export function runExclusive<T>(task: () => Promise<T>): Promise<T> {
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
  const db = await openPromise;
  if (!nativeDb) {
    // WAL mode (single writer + concurrent readers) and a busy_timeout so a
    // queued write waits up to 5s instead of failing instantly with
    // SQLITE_BUSY ("database is locked") — e.g. when a raw-native caller
    // (VACUUM, FTS rebuild, session purge) overlaps the Drizzle proxy queue.
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync('PRAGMA busy_timeout = 5000;');
    nativeDb = db;
  }
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
      // The statement may already be invalid if the DB was torn down
      // concurrently (logout/session reset). Guard so a rejected
      // finalizeAsync does not surface as ERR_INTERNAL_SQLITE_ERROR.
      try {
        await statement.finalizeAsync();
      } catch {
        // statement handle already invalidated — safe to ignore
      }
    }
  });

export function getDb(): SqliteRemoteDatabase {
  if (!dbInstance) {
    dbInstance = drizzle(remoteCallback);
  }
  return dbInstance;
}

/**
 * Run `fn` inside a single SQLite transaction (BEGIN IMMEDIATE ... COMMIT) that
 * holds ONE `runExclusive` queue turn, so no other queued writer can interleave
 * between statements. `fn` receives the raw native db and MUST use the native
 * API (`runAsync`/`execAsync`) directly — do NOT call drizzle `db.*` inside,
 * because drizzle statements re-enter `runExclusive` and would deadlock the
 * queue. Build SQL outside the callback via drizzle's `.toSQL()` and execute
 * it here.
 */
export async function withTransaction<T>(fn: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  return runExclusive(async () => {
    const db = await getNativeDb();
    await db.execAsync('BEGIN IMMEDIATE');
    try {
      const result = await fn(db);
      await db.execAsync('COMMIT');
      return result;
    } catch (error) {
      try {
        await db.execAsync('ROLLBACK');
      } catch {
        // connection torn down during rollback — ignore
      }
      throw error;
    }
  });
}

export async function closeDb(): Promise<void> {
  // Run through the same serialized queue that owns every native statement, so
  // an in-flight query/transaction (e.g. DayMasterLocalService.replaceAll)
  // completes BEFORE the connection is closed. Otherwise a queued statement's
  // finalizeAsync is rejected against the torn-down DB.
  await runExclusive(async () => {
    dbInstance = null;
    const db = nativeDb;
    nativeDb = null;
    openPromise = null;
    if (db) {
      try {
        await db.closeAsync();
      } catch {
        // ignore close errors
      }
    }
  });
}
