const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const required = [
  'src/routes/operationalFlowRoutes.js',
  'frontend/admin-operational-flow.html',
  'frontend/admin-operational-flow.js',
  'frontend/cw-enterprise-sidebar.js',
  'frontend/cristal-assist.js',
  'frontend/cristal-assist.css'
];
let ok = true;
for (const rel of required) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) { console.error('MISSING', rel); ok = false; }
}
const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
if (!server.includes('/api/operational-flow')) { console.error('MISSING route mount /api/operational-flow'); ok = false; }
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
if (schema.includes('@default(\"{\\n}\")')) { console.error('Schema contains known broken JSON default'); ok = false; }
const rt = schema.match(/model RoundTechnician \{[\s\S]*?\n\}/);
if (rt && rt[0].includes('@@index([status])')) { console.error('RoundTechnician still indexes missing status'); ok = false; }
const notif = fs.readFileSync(path.join(root, 'frontend/admin-notifications.html'), 'utf8');
if (notif.includes('/frontend/admin-dashboard.html') || notif.includes('/frontend/admin-payments.html')) { console.error('Broken admin notification links'); ok = false; }
console.log(ok ? 'Operational flow static test: OK' : 'Operational flow static test: FAILED');
process.exit(ok ? 0 : 1);
