const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chunkDir = process.env.TEMP + '\\opencode\\sqlite-repro\\chunks';
const srcDir = 'src/db/migrations';
const whenByIdx = {
  0: '1784554343915', 1: '1785678900000', 2: '1786000000000',
  3: '1786800000000', 4: '1790000000000', 5: '1790500000000',
  6: '1791000000000', 7: '1791100000000',
};

const db = process.argv[2];
if (!db) { console.error('usage: node run_migrate.js <db.sqlite>'); process.exit(2); }

const files = fs.readdirSync(srcDir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const chunks = [];
for (const f of files) {
  const idx = parseInt(f.slice(0, 4), 10);
  const q = fs.readFileSync(path.join(srcDir, f), 'utf8');
  q.split('--> statement-breakpoint').forEach((c, i) => {
    const chunkFile = path.join(chunkDir, `${f}.chunk${i}.sql`);
    fs.writeFileSync(chunkFile, c, 'utf8');
    chunks.push(`when=${whenByIdx[idx]}__${chunkFile}`);
  });
}

// copy db so harness readwrite doesn't touch the pristine device pull
const dbCopy = db.replace(/\.db$/, '.repro.db');
fs.copyFileSync(db, dbCopy);

const exe = path.join(process.env.TEMP, 'opencode', 'sqlite-repro', 'migrate_repro.exe');
const respFile = path.join(process.env.TEMP, 'opencode', 'sqlite-repro', 'chunks.rsp');
fs.writeFileSync(respFile, chunks.join('\n'), 'utf8');
const args = ['"' + exe + '"', '"' + dbCopy + '"', '@"' + respFile + '"'];
try {
  const out = execSync(args.join(' '), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: 'cmd' });
  process.stdout.write(out);
} catch (e) {
  process.stdout.write(e.stdout || '');
  process.stderr.write(e.stderr || '');
  process.exit(1);
}
