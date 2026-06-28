const fs = require('fs');
const path = require('path');
const core = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'coreFlowRoutes.js'), 'utf8');
const required = [
  'function dataFor(modelName, data)',
  'clientBaseData',
  'poolBaseData',
  'technicianBaseData',
  "router.post('/clients'",
  "router.put('/clients/:id'",
  "router.delete('/clients/:id'",
  "router.put('/pools/:id'",
  "router.delete('/pools/:id'",
  "router.put('/technicians/:id'",
  "router.delete('/technicians/:id'",
  'Simulação desativada em produção'
];
const missing = required.filter((needle) => !core.includes(needle));
if (missing.length) {
  console.error('Missing CRUD/Prisma hardening markers:', missing);
  process.exit(1);
}
console.log('✅ V22.6.3 CRUD Prisma route hardening OK');
