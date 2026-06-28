const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

let ok = true;
const files = walk(path.join(__dirname, '..', 'src'));
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout: 10000 });
  if (r.error || r.status !== 0) {
    ok = false;
    console.error(`Syntax check failed: ${path.relative(path.join(__dirname, '..'), file)}`);
    console.error(r.stderr || r.stdout || r.error?.message || 'Unknown error');
  }
}
if (ok) console.log(`✅ Syntax OK: ${files.length} backend JS files.`);
process.exit(ok ? 0 : 1);
