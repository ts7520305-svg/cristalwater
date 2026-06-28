const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const must = [
  'frontend/cw-polish.css','frontend/cw-flow-shell.js','frontend/admin-command-center.html','frontend/admin-command-center.js','frontend/technician-field-mode.html','frontend/technician-field-mode.js','frontend/client-wow.html','frontend/client-wow.js','frontend/cw-enterprise-sidebar.js','frontend/admin-master-control.html','src/server.js','src/routes/coreFlowRoutes.js'
];
let ok = true;
function fail(m){ console.error('❌ '+m); ok=false; }
for(const rel of must){ if(!fs.existsSync(path.join(root, rel))) fail('Ficheiro em falta: '+rel); }
const files = ['frontend/cw-flow-shell.js','frontend/admin-command-center.js','frontend/technician-field-mode.js','frontend/client-wow.js','src/server.js'];
for(const rel of files){ const r=spawnSync(process.execPath, ['--check', path.join(root, rel)], {encoding:'utf8'}); if(r.status!==0) fail('Syntax error '+rel+'\n'+(r.stderr||r.stdout)); }
const sidebar = fs.readFileSync(path.join(root,'frontend/cw-enterprise-sidebar.js'),'utf8');
for(const token of ['/admin-command-center','/admin-master-control','/technician-field-mode','/client-portal']) if(!sidebar.includes(token)) fail('Sidebar sem link '+token);
const htmls = ['admin-command-center.html','technician-field-mode.html','client-wow.html','admin-master-control.html'];
for(const h of htmls){ const s=fs.readFileSync(path.join(root,'frontend',h),'utf8'); if(!s.includes('/cw-flow-shell.js')) fail(h+' sem shell global'); if(!s.includes('/cw-polish.css')) fail(h+' sem CSS global'); }
const core = fs.readFileSync(path.join(root,'src/routes/coreFlowRoutes.js'),'utf8');
for(const route of ["router.get('/dashboard'", "router.get('/clients'", "router.get('/technicians'", "router.post('/visits'", "router.post('/visits/:id/complete'"]) if(!core.includes(route)) fail('Core route ausente '+route);
if(!ok) process.exit(1);
console.log('✅ UX Harmonized V22.5.2.1 OK: shell global, páginas novas, links, rotas core e sintaxe validados.');
