const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = process.argv[2];
const migrationsDir = 'src/db/migrations';

const db = new Database(dbPath, { readonly: false });
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const journal = JSON.parse(fs.readFileSync(path.join(migrationsDir, 'meta/_journal.json'), 'utf8'));

const out = [];
for (const e of journal.entries) {
  const sqlFile = fs.readdirSync(migrationsDir).find((f) => f.startsWith(String(e.idx).padStart(4, '0') + '_'));
  const sql = fs.readFileSync(path.join(migrationsDir, sqlFile), 'utf8');
  const queries = sql.split('--> statement-breakpoint');
  out.push({ sql: queries, bps: e.breakpoints, folderMillis: e.when, hash: '' });
}

const migrationsTable = '__drizzle_migrations';
db.exec(`CREATE TABLE IF NOT EXISTS "${migrationsTable}" (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric)`);
const row = db.prepare(`SELECT id, hash, created_at FROM "${migrationsTable}" ORDER BY created_at DESC LIMIT 1`).get();
const lastDbMigration = row ? row.created_at : undefined;
console.log('lastDbMigration =', lastDbMigration);

db.exec('BEGIN');
let crashed = null;
try {
  for (const migration of out) {
    if (!lastDbMigration || Number(lastDbMigration) < migration.folderMillis) {
      console.log(`>> applying migration folderMillis=${migration.folderMillis}, ${migration.sql.length} chunks`);
      for (let i = 0; i < migration.sql.length; i++) {
        const stmt = migration.sql[i];
        const preview = stmt.trim().slice(0, 60).replace(/\n/g, ' ');
        if (stmt.trim().length === 0) {
          console.log(`   chunk ${i}: EMPTY (would crash) !!!`);
          crashed = `migration ${migration.folderMillis} chunk ${i} is EMPTY`;
          break;
        }
        const p = db.prepare(stmt);
        p.run();
        console.log(`   chunk ${i}: OK (${stmt.trim().length}b) :: ${preview}`);
      }
      if (crashed) break;
      db.prepare(`INSERT INTO "${migrationsTable}" ("hash", "created_at") VALUES (?, ?)`).run('', migration.folderMillis);
    } else {
      console.log(`-- skip migration folderMillis=${migration.folderMillis}`);
    }
  }
  db.exec('COMMIT');
  console.log('=== COMMIT OK ===');
} catch (e) {
  db.exec('ROLLBACK');
  console.log('=== ROLLBACK ===', e.message);
  crashed = crashed || e.message;
}
db.close();
process.exit(crashed ? 1 : 0);
