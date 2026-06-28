const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const requiredFiles = [
  'src/server.js',
  'src/prismaClient.js',
  'src/routes/coreFlowRoutes.js',
  'src/routes/syncRoutes.js',
  'src/routes/dashboardRoutes.js',
  'src/controllers/inventoryController.js',
  'frontend/admin-master-control.html',
  'frontend/admin-master-control.js',
  'frontend/admin-technicians.html',
  'frontend/admin-clients.html',
  'frontend/admin-pools.html',
  'frontend/admin-rounds.html',
  'frontend/admin-visits.html',
  'frontend/admin-inventory.html',
  'frontend/billing.html',
];

const requiredServerMounts = [
  '/api/core', '/api/technicians', '/api/clients', '/api/pools', '/api/visits',
  '/api/rounds', '/api/inventory', '/api/stock', '/api/dashboard', '/api/sync',
];

const requiredCoreRoutes = [
  "router.get('/dashboard'", "router.get('/clients'", "router.post('/clients'",
  "router.post('/clients/:clientId/pools'", "router.get('/technicians'", "router.post('/technicians'",
  "router.get('/rounds'", "router.post('/rounds'", "router.post('/rounds/:roundId/technicians'",
  "router.post('/rounds/:roundId/pools'", "router.post('/visits'", "router.post('/visits/:id/complete'",
  "router.post('/invoices/generate'", "router.post('/invoices/:id/pay'", "router.post('/simulate-full-flow'",
];

function fail(msg) {
  console.error('❌ ' + msg);
  process.exitCode = 1;
}

for (const rel of requiredFiles) {
  if (!fs.existsSync(path.join(root, rel))) fail(`Ficheiro obrigatório em falta: ${rel}`);
}

const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
for (const mount of requiredServerMounts) {
  if (!server.includes(`mount("${mount}"`) && !server.includes(`mount('${mount}'`)) fail(`Mount em falta no server.js: ${mount}`);
}

const core = fs.readFileSync(path.join(root, 'src/routes/coreFlowRoutes.js'), 'utf8');
for (const route of requiredCoreRoutes) {
  if (!core.includes(route)) fail(`Rota core em falta: ${route}`);
}

const master = fs.readFileSync(path.join(root, 'frontend/admin-master-control.js'), 'utf8');
for (const token of ['technicians', 'clients', 'pools', 'rounds', 'visits', 'stock', 'billing', 'simulate-full-flow']) {
  if (!master.includes(token)) fail(`Admin master sem módulo: ${token}`);
}

const jsFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.js')) jsFiles.push(full);
  }
}
walk(path.join(root, 'src'));
walk(path.join(root, 'frontend'));
for (const file of jsFiles) {
  const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (r.status !== 0) fail(`Syntax error em ${path.relative(root, file)}\n${r.stderr || r.stdout}`);
}

if (!process.exitCode) console.log('✅ Harmonized static test OK: módulos, rotas, menu master e sintaxe validados.');
