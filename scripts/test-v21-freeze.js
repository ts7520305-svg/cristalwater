const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
const required = ['test:v21-schema','test:v21-concurrency','test:v21-freeze','test:v21'];
let ok = true;
for (const s of required) {
  if (!pkg.scripts[s]) { console.error(`FAIL: missing script ${s}`); ok=false; }
  else console.log(`OK: script ${s}`);
}
const docs = '../docs/V21_STABILIZATION_FREEZE.md';
if (!fs.existsSync(docs)) { console.error('FAIL: missing V21 documentation'); ok=false; }
else console.log('OK: V21 documentation');
if (!ok) process.exit(1);
console.log('V21 freeze checks OK');
