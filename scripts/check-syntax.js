const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const vm = require('node:vm');

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
  // Parsing alone does not detect missing modules in a clean Git checkout.
  for (const match of fs.readFileSync(file, 'utf8').matchAll(/require\(['"](\.{1,2}\/[^'"]+)['"]\)/g)) {
    try {
      require.resolve(path.resolve(path.dirname(file), match[1]));
    } catch (_) {
      ok = false;
      console.error(`Missing local module: ${path.relative(rootPath(), file)} -> ${match[1]}`);
    }
  }
}
function rootPath() { return path.join(__dirname, '..'); }
// Browser scripts and inline HTML scripts can fail before their first network
// request. Include them in the gate rather than relying on backend parsing.
let frontendFiles = 0, inlineScripts = 0;
function browserSyntax(source, filename, module = false) {
  try {
    if (module) {
      const result = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: source, encoding: 'utf8', timeout: 10000 });
      if (result.error || result.status !== 0) throw Error(result.stderr || result.error?.message || 'Invalid module');
    } else new vm.Script(source, { filename });
  } catch (error) { ok = false; console.error(`Syntax check failed: ${filename}\n${error.message}`); }
}
function browserFiles(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) { browserFiles(file); continue; }
    if (file.endsWith('.js')) { frontendFiles++; browserSyntax(fs.readFileSync(file, 'utf8'), path.relative(rootPath(), file)); }
    if (file.endsWith('.html')) {
      let index = 0;
      for (const match of fs.readFileSync(file, 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
        index++; if (/\bsrc\s*=/i.test(match[1])) continue;
        const type = /\btype\s*=\s*["']?([^\s"'>]+)/i.exec(match[1])?.[1]?.toLowerCase();
        if (type && !['module', 'text/javascript', 'application/javascript'].includes(type)) continue;
        inlineScripts++; browserSyntax(match[2], path.relative(rootPath(), file) + ':inline-' + index, type === 'module');
      }
    }
  }
}
browserFiles(path.join(rootPath(), 'frontend'));
if (ok) console.log(`✅ Syntax OK: ${files.length} backend JS files, ${frontendFiles} frontend JS files and ${inlineScripts} inline scripts.`);
process.exit(ok ? 0 : 1);
