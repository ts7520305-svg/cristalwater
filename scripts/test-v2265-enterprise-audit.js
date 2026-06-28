const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assert(cond, msg){ if(!cond){ console.error('❌', msg); process.exitCode = 1; } else { console.log('✅', msg); } }
const server = read('src/server.js');
assert(server.includes('keyRoutes') && server.includes('mount("/api/keys"'), 'keys routes mounted');
assert(server.includes('searchRoutes') && server.includes('mount("/api/search"'), 'global search mounted');
assert(server.includes('documentRoutes') && server.includes('mount("/api/documents"'), 'document routes mounted');
const guide = read('src/controllers/guideController.js');
['getLatestTransportGuide','updateTransportGuideItems','getVehicleStockPreset','saveVehicleStockPreset'].forEach(fn=>assert(guide.includes(`async function ${fn}`) && guide.includes(fn+','), `guide controller exports ${fn}`));
assert(guide.includes('importFromLast') && guide.includes('VEHICLE_PRESET'), 'transport guide supports last-guide import and vehicle preset');
const gr = read('src/routes/guideRoutes.js');
['/transport/latest/:vehicleId','/transport/:id/items','/vehicles/:vehicleId/stock-preset'].forEach(route=>assert(gr.includes(route), `guide route ${route}`));
const kr = read('src/routes/keyRoutes.js');
['/required/morning','/holder/:code','accessType: \'KEY\''].forEach(x=>assert(kr.includes(x), `key route feature ${x}`));
const core = read('src/routes/coreFlowRoutes.js');
assert(core.includes('recordTechnicalSheetHistory') && core.includes('TECHNICAL_SHEET_CHANGE'), 'technical sheet immutable history recorded');
const sidebar = read('frontend/cw-enterprise-sidebar.js');
assert(sidebar.includes('/admin-keys') && sidebar.includes('Chaves'), 'sidebar contains keys module');
assert(fs.existsSync(path.join(root,'frontend/admin-keys.html')) && fs.existsSync(path.join(root,'frontend/admin-keys.js')), 'admin keys frontend exists');
assert(!/Cliente WOW|Piscina Demo|Técnico Demo|Testar flow completo/i.test(sidebar), 'production sidebar has no demo/test labels');
if (process.exitCode) process.exit(process.exitCode);
console.log('V22.6.5 enterprise audit passed.');
