const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const frontend = path.join(root, 'frontend');
function read(file){ return fs.readFileSync(path.join(frontend,file),'utf8'); }
function ok(label){ console.log('OK:', label); }
function fail(label){ console.error('FAIL:', label); process.exitCode = 1; }

const requiredFiles = ['cw-auth.js','admin-auth-guard.js','login.js','admin-login.js','cw-enterprise-sidebar.js'];
for (const file of requiredFiles) fs.existsSync(path.join(frontend,file)) ? ok(file) : fail(file + ' missing');

const auth = read('cw-auth.js');
[
  'cristalwater_jwt',
  'CristalAuth',
  'Authorization',
  'res.status === 401',
  'Ligação instável'
].forEach(token => auth.includes(token) ? ok('cw-auth contains ' + token) : fail('cw-auth missing ' + token));

const adminGuard = read('admin-auth-guard.js');
if (/fetch\s*\(/.test(adminGuard)) fail('admin auth guard must not call API'); else ok('admin guard synchronous');
if (adminGuard.includes('cristalwater_jwt')) ok('admin guard uses unified jwt'); else fail('admin guard missing unified jwt');

for (const file of ['login.js','admin-login.js']) {
  const src = read(file);
  if (src.includes('CristalAuth.persistSession') && src.includes('cristalwater_jwt')) ok(file + ' persists unified session');
  else fail(file + ' does not persist unified session');
}

const htmlFiles = fs.readdirSync(frontend).filter(f => f.endsWith('.html'));
let missing = [];
for (const file of htmlFiles) {
  const src = read(file);
  if (!src.includes('/cw-auth.js')) missing.push(file);
}
if (missing.length) fail('missing cw-auth include: ' + missing.slice(0,10).join(', ')); else ok('all html include cw-auth.js');

if (!process.exitCode) console.log('V21 frontend continuity checks OK');
