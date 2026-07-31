const fs = require('fs');
const path = require('path');
const bundleDir = path.join(process.env.TEMP, 'opencode', 'hercare-bundle2', '_expo', 'static', 'js', 'android');
const files = fs.readdirSync(bundleDir).filter(f => f.endsWith('.js'));
const bundle = path.join(bundleDir, files[0]);
const text = fs.readFileSync(bundle, 'utf8');

const markers = [
  'Repair migration',
  'Isolated FTS5',
  'CREATE TABLE IF NOT EXISTS `diary_pages`',
  'CREATE VIRTUAL TABLE IF NOT EXISTS `diary_fts`',
  'CREATE TABLE `diary_page_objects`',
  'CREATE TABLE `diary_media`',
  'CREATE TABLE `diary_assets`',
];
for (const m of markers) {
  const i = text.indexOf(m);
  console.log('MARKER: ' + m + ' -> idx ' + (i < 0 ? 'NOT FOUND' : i));
}

const i = text.indexOf('Repair migration');
if (i >= 0) {
  console.log('--- context around Repair migration (0006) ---');
  console.log(text.substring(i - 300, i + 1200));
}

const j = text.indexOf('Isolated FTS5');
if (j >= 0) {
  console.log('--- context around Isolated FTS5 (0007) ---');
  console.log(text.substring(j - 300, j + 800));
}
