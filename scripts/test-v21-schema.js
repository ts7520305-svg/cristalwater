const fs = require('fs');
const schema = fs.readFileSync('prisma/schema.prisma', 'utf8');
const checks = [
  ['Visit composite index technician/status', '@@index([technicianId, status])'],
  ['Visit composite index pool/plannedDate', '@@index([poolId, plannedDate])'],
  ['Visit composite index status/plannedDate', '@@index([status, plannedDate])'],
  ['Invoice composite index client/status', '@@index([clientId, status])'],
  ['Invoice composite index dueDate/status', '@@index([dueDate, status])'],
  ['AuditTrail append-only model', 'model AuditTrail {'],
  ['Operational locks model', 'model OperationalLock {'],
  ['Vehicle stock audit model', 'model VehicleStockAudit {'],
  ['Emergency consumption batch model', 'model EmergencyConsumptionBatch {'],
];
let ok = true;
for (const [name, needle] of checks) {
  if (!schema.includes(needle)) { console.error(`FAIL: ${name}`); ok = false; }
  else console.log(`OK: ${name}`);
}
if (!ok) process.exit(1);
console.log('V21 schema checks OK');
