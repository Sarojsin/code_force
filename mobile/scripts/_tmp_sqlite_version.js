const fs = require('fs');
const p = 'node_modules/expo-sqlite/vendor/sqlite3/sqlite3.c';
if (fs.existsSync(p)) {
  const t = fs.readFileSync(p, 'utf8');
  const m = t.match(/SQLITE_VERSION\s+"([^"]+)"/);
  console.log('vendored sqlite3.c version:', m && m[1]);
  console.log('size bytes:', t.length);
} else {
  console.log('NOT FOUND');
}
