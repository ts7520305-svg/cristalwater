const fs = require('fs');
const path = require('path');
function assert(condition, message) { if (!condition) throw new Error(message); }
const root = path.join(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/services/operationalStateEngine.js'), 'utf8');
const route = fs.readFileSync(path.join(root, 'src/routes/operationalStateRoutes.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');
for (const model of ['OperationalLock','VisitStateLog','SeasonalRule','VehicleAccessibilityRule','EmergencyConsumptionBatch','VehicleStockAudit','ClientProfitSnapshot']) {
  assert(new RegExp(`model\\s+${model}\\b`).test(schema), `Modelo em falta: ${model}`);
}
for (const fn of ['validatePoolReadyForRound','validateVisitReadyForStock','validateChemicalDose','setVisitState','checkVehicleCompatibility','createEmergencyConsumptionBatch','distributeEmergencyConsumption','computeClientProfit','createVehicleAudit']) {
  assert(service.includes(fn), `Função em falta: ${fn}`);
}
for (const endpoint of ['/chemical/check','/stock-audit','/profitability/:clientId','/emergency-consumption']) {
  assert(route.includes(endpoint), `Endpoint em falta: ${endpoint}`);
}
assert(server.includes('/api/operational-state'), 'Rota /api/operational-state não montada');
console.log('✅ V18 operational state engine OK');
