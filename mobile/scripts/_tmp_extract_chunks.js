const fs = require('fs');
const path = require('path');

const srcDir = 'src/db/migrations';
const outDir = process.env.TEMP + '\\opencode\\sqlite-repro\\chunks';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(srcDir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
for (const f of files) {
  const q = fs.readFileSync(path.join(srcDir, f), 'utf8');
  const chunks = q.split('--> statement-breakpoint');
  chunks.forEach((c, i) => {
    const name = `${f}.chunk${i}.sql`;
    fs.writeFileSync(path.join(outDir, name), c, 'utf8');
  });
  console.log(`${f}: ${chunks.length} chunks -> ${outDir}`);
}
