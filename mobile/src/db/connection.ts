import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

let dbInstance: ReturnType<typeof drizzle> | null = null;
let nativeDb: SQLiteDatabase | null = null;

export function getDb(): ReturnType<typeof drizzle> {
  if (!dbInstance) {
    nativeDb = openDatabaseSync('shecare.db');
    dbInstance = drizzle(nativeDb);
  }
  return dbInstance;
}

export function getNativeDb(): SQLiteDatabase {
  if (!nativeDb) {
    nativeDb = openDatabaseSync('shecare.db');
    dbInstance = drizzle(nativeDb);
  }
  return nativeDb;
}

export function closeDb(): void {
  if (nativeDb) {
    try {
      nativeDb.closeAsync();
    } catch {
      // ignore close errors
    }
  }
  dbInstance = null;
  nativeDb = null;
}
