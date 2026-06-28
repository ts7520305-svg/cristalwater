const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8');

function fail(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}
function requireIncludes(txt, needles, label) {
  for (const needle of needles) {
    if (!txt.includes(needle)) fail(`${label}: falta ${needle}`);
  }
}

requireIncludes(schema, [
  'enum ArchiveStatus',
  'model TechnicalSheet',
  'model KeyAccess',
  'model Attachment',
  'model OperationalReminder',
  'archiveStatus  ArchiveStatus @default(ATIVO)',
  'deletedAt      DateTime?',
  'orpMv',
  'isDraft',
  'inheritedFromId',
  'client             Client              @relation(fields: [clientId], references: [id], onDelete: Restrict)',
  'client              Client        @relation(fields: [clientId], references: [id], onDelete: Restrict)',
  'pool                  Pool     @relation(fields: [poolId], references: [id], onDelete: Restrict)',
], 'schema');

const forbiddenCritical = [
  'Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)',
  'Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)',
  'Client?  @relation(fields: [clientId], references: [id], onDelete: Cascade)',
  'Client?   @relation(fields: [clientId], references: [id], onDelete: Cascade)',
  'Technician   @relation(fields: [technicianId], references: [id], onDelete: Cascade)',
  'Vehicle      @relation(fields: [vehicleId], references: [id], onDelete: Cascade)',
];
for (const needle of forbiddenCritical) {
  if (schema.includes(needle)) fail(`cascade crítico ainda presente: ${needle}`);
}

const files = [
  'src/controllers/clientController.js',
  'src/controllers/poolController.js',
  'src/controllers/guideController.js',
  'src/controllers/inventoryController.js',
  'src/routes/clientRoutes.js',
  'src/routes/poolRoutes.js',
  'src/routes/guideRoutes.js',
  'src/routes/inventoryRoutes.js',
  'src/routes/coreFlowRoutes.js',
];
for (const f of files) if (!fs.existsSync(path.join(root, f))) fail(`ficheiro obrigatório ausente: ${f}`);

const clientController = fs.readFileSync(path.join(root, 'src/controllers/clientController.js'), 'utf8');
const poolController = fs.readFileSync(path.join(root, 'src/controllers/poolController.js'), 'utf8');
const guideController = fs.readFileSync(path.join(root, 'src/controllers/guideController.js'), 'utf8');
const inventoryController = fs.readFileSync(path.join(root, 'src/controllers/inventoryController.js'), 'utf8');
const coreFlow = fs.readFileSync(path.join(root, 'src/routes/coreFlowRoutes.js'), 'utf8');

requireIncludes(clientController, [
  'clientCreateData',
  'clientUpdateData',
  'contractActive: false',
  'billingActive: false',
  'archiveStatus: "ARQUIVADO"',
  'restoreClient',
  'paymentStatus: "BILLING_DISABLED"',
], 'clientController');
requireIncludes(poolController, [
  'ensureTechnicalSheet',
  'recordTechnicalSheetHistory',
  'archiveStatus: "ARQUIVADO"',
  'restorePool',
  'Number.isFinite',
], 'poolController');
requireIncludes(guideController, [
  'getVehiclePreset',
  'setVehiclePreset',
  'latestTransportGuide',
  'inheritedFromId',
  'isDraft',
  'TRANSPORT_GUIDE_ITEMS_UPDATE',
], 'guideController');
requireIncludes(inventoryController, [
  'updateProduct',
  'deleteProduct',
  'restoreProduct',
  'archiveStatus',
], 'inventoryController');
requireIncludes(coreFlow, ['technicalSheet.upsert', "archiveStatus: 'ARQUIVADO'"], 'coreFlow');

const migration66 = fs.readFileSync(path.join(root, 'prisma/migrations/20260605000000_v22_6_6_enterprise_safe_migration/migration.sql'), 'utf8');
const migration67 = fs.readFileSync(path.join(root, 'prisma/migrations/20260605001000_v22_6_7_final_constraints_audit/migration.sql'), 'utf8');
requireIncludes(migration66, ['CREATE TABLE IF NOT EXISTS "TechnicalSheet"', 'ALTER TABLE "Pool" DROP CONSTRAINT IF EXISTS "Pool_clientId_fkey"'], 'migration66');
requireIncludes(migration67, ['ClientAccess_clientId_fkey', 'ClientMessage_clientId_fkey', 'TechnicianVehicleLog_vehicleId_fkey'], 'migration67');
if (!packageJson.includes('22.6.7')) fail('package.json não está em 22.6.7');

console.log('✅ V22.6.7 Final Enterprise Audit static checks OK');
