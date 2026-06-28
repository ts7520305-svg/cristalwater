const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const checks = [
  ['package.json', '22.6.1'],
  ['prisma/schema.prisma', 'billingActive'],
  ['prisma/schema.prisma', 'fiscalNif'],
  ['src/routes/coreFlowRoutes.js', "router.put('/clients/:id'"],
  ['src/routes/coreFlowRoutes.js', "router.delete('/clients/:id'"],
  ['src/routes/coreFlowRoutes.js', "router.get('/pools/:id/technical-sheet'"],
  ['src/routes/coreFlowRoutes.js', "router.put('/pools/:id/technical-sheet'"],
  ['src/routes/coreFlowRoutes.js', "billingActive"],
  ['src/routes/coreFlowRoutes.js', "invoices/external"],
  ['src/routes/guideRoutes.js', 'router.delete("/vehicles/:id"'],
  ['src/routes/inventoryRoutes.js', "router.delete('/products/:id'"],
  ['frontend/admin-clients.html', 'Necessita fatura oficial'],
  ['frontend/admin-clients.js', 'requiresInvoice'],
  ['frontend/admin-pools.js', 'admin-pool-technical'],
  ['frontend/admin-pool-technical.html', 'Ficha Técnica da Piscina'],
  ['frontend/admin-pool-technical.js', 'technical-sheet'],
  ['frontend/admin-vehicles.js', 'deleteVehicle'],
  ['frontend/admin-inventory.js', 'editProduct'],
];
const forbidden = ['Cliente WOW','Piscina Demo','Técnico Demo','Testar flow completo','Flow Harmonizado','Fluxo harmonizado'];
let ok = true;
function fail(msg){ console.error('FAIL:', msg); ok = false; }
for (const [file, needle] of checks) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) { fail(`missing file ${file}`); continue; }
  const txt = fs.readFileSync(full, 'utf8');
  if (!txt.includes(needle)) fail(`missing ${needle} in ${file}`);
}
for (const rel of ['frontend/admin-menu.html','frontend/admin-dashboard.html','frontend/admin-master-control.html','frontend/client-portal.html','frontend/admin-clients.html','frontend/admin-pools.html','frontend/admin-pool-technical.html','frontend/cw-enterprise-sidebar.js']) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;
  const txt = fs.readFileSync(full, 'utf8');
  for (const word of forbidden) if (txt.includes(word)) fail(`forbidden visible text ${word} in ${rel}`);
}
if (!ok) process.exit(1);
console.log('V22.6.1 enterprise final static audit OK');
