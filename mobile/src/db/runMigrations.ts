/**
 * Async migration runner for React Native.
 *
 * Replaces drizzle's `useMigrations` (which needs node:fs) with a runner that
 * executes the bundled migrations object against the async sqlite-proxy db.
 * Mirrors `SQLiteSyncDialect.migrate` so the `__drizzle_migrations` tracking
 * table stays compatible with existing installs.
 */

import { sql } from 'drizzle-orm';
import migrations from './migrations/migrations';
import { getDb, withTransaction } from './connection';

const MIGRATION_TABLE = '__drizzle_migrations';

function statementHash(sqlText: string): string {
  let hash = 0;
  for (let i = 0; i < sqlText.length; i++) {
    hash = (hash * 31 + sqlText.charCodeAt(i)) % Number.MAX_SAFE_INTEGER;
  }
  return hash.toString(36);
}

export async function runMigrations(): Promise<void> {
  const db = getDb();
  const migrationTable = sql.raw(`"${MIGRATION_TABLE}"`);
  await db.run(
    sql`CREATE TABLE IF NOT EXISTS ${migrationTable} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
  );

  const lastRows = await db.values(
    sql`SELECT id, hash, created_at FROM ${migrationTable} ORDER BY created_at DESC LIMIT 1`,
  );
  const lastCreatedAt = Number(lastRows[0]?.[2] ?? 0);

  for (const entry of migrations.journal.entries) {
    const key = `m${entry.idx.toString().padStart(4, '0')}`;
    const migrationSql = migrations.migrations[key];
    if (!migrationSql) {
      throw new Error(`Missing migration SQL for ${entry.tag}`);
    }
    if (Number(lastCreatedAt) >= entry.when) {
      continue;
    }

    const statements = migrationSql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
      .filter((statement) => statement.length > 0);

    // A migration's statements + the tracking insert must apply atomically.
    // withTransaction holds one queue turn so no other write can interleave
    // (Phase D.1.1 — migrations are raw SQL, params-free).
    await withTransaction(async (nativeDb) => {
      for (const statement of statements) {
        await nativeDb.execAsync(statement);
      }
      await nativeDb.runAsync(
        `INSERT INTO "${MIGRATION_TABLE}" ("hash", "created_at") VALUES (?, ?)`,
        [statementHash(migrationSql), entry.when],
      );
    });
  }
}
