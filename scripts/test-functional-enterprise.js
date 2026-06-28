const fs = require('fs');
const path = require('path');
function ok(name, cond){ if(!cond){ console.error('FAIL:', name); process.exitCode=1; } else console.log('OK:', name); }
const root = path.join(__dirname, '..');
const schema = fs.readFileSync(path.join(root,'prisma/schema.prisma'),'utf8');
ok('schema sem BOM', !schema.charCodeAt(0) || schema.charCodeAt(0)!==0xfeff);
['InventoryProduct','StockPurchase','StockPurchaseItem','StockBalance','StockMovement','Vehicle','TransportGuide','WorkGuide','Client','Pool','Invoice','Payment','Alert','Visit'].forEach(m=>ok('model '+m, schema.includes('model '+m+' ')));
['src/routes/inventoryRoutes.js','src/controllers/inventoryController.js','frontend/admin-inventory.html','frontend/admin-inventory.js'].forEach(f=>ok('ficheiro '+f, fs.existsSync(path.join(root,f))));
const server = fs.readFileSync(path.join(root,'src/server.js'),'utf8');
ok('rota /api/inventory montada', server.includes('/api/inventory'));
console.log('Readiness enterprise concluído. Testes DB/API reais devem ser corridos no PC/VPS com PostgreSQL ativo.');
