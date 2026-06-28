const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const mustContain = [
  ['src/routes/coreFlowRoutes.js', "router.put('/clients/:id'"],
  ['src/routes/coreFlowRoutes.js', "router.post('/clients/:id/restore'"],
  ['src/routes/coreFlowRoutes.js', "router.delete('/clients/:id'"],
  ['src/routes/coreFlowRoutes.js', "router.put('/pools/:id'"],
  ['src/routes/coreFlowRoutes.js', "router.post('/pools/:id/restore'"],
  ['src/routes/coreFlowRoutes.js', "router.delete('/pools/:id'"],
  ['src/routes/coreFlowRoutes.js', "router.post('/technicians/:id/restore'"],
  ['src/routes/guideRoutes.js', 'router.delete("/vehicles/:id"'],
  ['src/routes/guideRoutes.js', 'router.post("/vehicles/:id/restore"'],
  ['src/routes/inventoryRoutes.js', "router.put('/products/:id'"],
  ['src/routes/inventoryRoutes.js', "router.delete('/products/:id'"],
  ['frontend/admin-clients.js', 'editClient'],
  ['frontend/admin-pools.js', 'editPool'],
  ['frontend/admin-technicians.js', 'editTechnician'],
  ['frontend/admin-vehicles.js', 'editVehicle'],
  ['frontend/admin-inventory.js', 'editProduct'],
];
let ok = true;
for (const [file, needle] of mustContain) {
  const full = path.join(root, file);
  const text = fs.readFileSync(full, 'utf8');
  if (!text.includes(needle)) { console.error(`MISSING ${needle} in ${file}`); ok = false; }
}
const forbiddenVisible = ['Cliente WOW', 'Piscina Demo', 'Técnico Demo', 'Testar flow completo'];
for (const rel of ['frontend/admin-menu.html','frontend/admin-dashboard.html','frontend/admin-master-control.html','frontend/client-portal.html','frontend/admin-technicians.js','frontend/admin-pools.js','frontend/admin-clients.js']) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, 'utf8');
  for (const f of forbiddenVisible) if (text.includes(f)) { console.error(`FORBIDDEN visible text ${f} in ${rel}`); ok = false; }
}
if (!ok) process.exit(1);
console.log('V22.6.0 CRUD lifecycle static audit OK');
