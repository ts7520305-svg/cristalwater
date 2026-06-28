/* Cristal Water V22.5.2.3 static preflight - produção */
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const root = process.cwd();
const requiredFiles = [
  'package.json','prisma/schema.prisma','src/server.js','src/prismaClient.js',
  'src/routes/coreFlowRoutes.js','src/routes/syncRoutes.js','src/routes/dashboardRoutes.js','src/routes/inventoryRoutes.js',
  'src/controllers/inventoryController.js','src/services/dashboardCacheService.js',
  'frontend/admin-master-control.js','frontend/client-portal.js','frontend/cw-enterprise-sidebar.js','frontend/cw-flow-shell.js'
];
function fail(msg){ console.error('FAIL:', msg); process.exit(1); }
for (const f of requiredFiles) if (!fs.existsSync(path.join(root, f))) fail('Missing required file: '+f);
const syntaxFiles = requiredFiles.filter(f => f.endsWith('.js'));
for (const f of syntaxFiles) {
  const file = path.join(root, f);
  try { childProcess.execFileSync(process.execPath, ['--check', file], { stdio:'pipe', timeout:5000 }); }
  catch (err) { fail('Syntax error in '+f+'\n'+String(err.stderr||err.message)); }
}
console.log('V22 static preflight OK');
console.log(`Checked ${syntaxFiles.length} critical JS files and ${requiredFiles.length} required files.`);
