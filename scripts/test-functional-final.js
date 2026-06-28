const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const checks = [];
function add(name, ok, detail = '') { checks.push({ name, ok, detail }); }
function exists(rel) { return fs.existsSync(path.join(root, rel)); }

const requiredFiles = [
  'src/server.js',
  'prisma/schema.prisma',
  'frontend/admin-dashboard.html',
  'frontend/admin-ai.html',
  'frontend/admin-rounds.html',
  'frontend/admin-ui-settings.html',
  'frontend/admin-operational-settings.html',
  'frontend/admin-crm.html',
  'frontend/admin-suppliers.html',
  'frontend/admin-security.html',
  'frontend/admin-test-center.html',
  'frontend/technician.html',
  'frontend/technician-new-client.html',
  'frontend/manifest.webmanifest',
  'frontend/sw.js',
  'scripts/install-windows.ps1',
  'scripts/start-windows.ps1',
  'scripts/deploy-vps.sh',
];
requiredFiles.forEach((file) => add(`file:${file}`, exists(file), exists(file) ? 'ok' : 'missing'));

const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
add('schema:no-bom', schema.charCodeAt(0) !== 0xfeff, 'schema.prisma sem BOM');
[
  'SystemSetting',
  'Client',
  'Pool',
  'AiAssistantThread',
  'SupplierAccount',
  'Lead',
  'UserAuditLog',
].forEach((model) => add(`schema:model:${model}`, schema.includes(`model ${model} `), 'modelo presente'));
[
  'createdByTechnicianId',
  'pendingReview',
  'reviewStatus',
].forEach((field) => add(`schema:field:${field}`, schema.includes(field), 'campo presente'));

const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
[
  'technicianIntakeRoutes',
  '/api/technician-intake',
  '/api/settings',
  '/api/crm',
  '/api/suppliers',
  '/api/security',
].forEach((needle) => add(`server:${needle}`, server.includes(needle), 'rota montada'));

const jsFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.js')) jsFiles.push(p);
  }
}
walk(path.join(root, 'src'));
walk(path.join(root, 'frontend'));
let syntaxOk = true;
let firstSyntaxError = '';
for (const file of jsFiles) {
  const res = childProcess.spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (res.status !== 0) { syntaxOk = false; firstSyntaxError = `${path.relative(root, file)} ${res.stderr || res.stdout}`; break; }
}
add('js:syntax', syntaxOk, syntaxOk ? `${jsFiles.length} ficheiros JS validados` : firstSyntaxError);

const failed = checks.filter((c) => !c.ok);
console.log('Cristal Water Functional Final Readiness');
console.log('----------------------------------------');
checks.forEach((c) => console.log(`${c.ok ? 'OK ' : 'ERR'} ${c.name}${c.detail ? ' — ' + c.detail : ''}`));
console.log('----------------------------------------');
console.log(`Total: ${checks.length}; OK: ${checks.length - failed.length}; Falhas: ${failed.length}`);
if (failed.length) process.exit(1);
