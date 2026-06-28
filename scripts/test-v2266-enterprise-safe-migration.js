const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
const requiredSchema = [
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
  'Client        @relation(fields: [clientId], references: [id], onDelete: Restrict)',
  'Pool     @relation(fields: [poolId], references: [id], onDelete: Restrict)',
];
const missing = requiredSchema.filter(x => !schema.includes(x));
if (missing.length) {
  console.error('Schema V22.6.6 incompleto:', missing);
  process.exit(1);
}

const clientController = fs.readFileSync(path.join(root, 'src/controllers/clientController.js'), 'utf8');
const poolController = fs.readFileSync(path.join(root, 'src/controllers/poolController.js'), 'utf8');
const guideController = fs.readFileSync(path.join(root, 'src/controllers/guideController.js'), 'utf8');
const coreFlow = fs.readFileSync(path.join(root, 'src/routes/coreFlowRoutes.js'), 'utf8');

const checks = [
  [clientController, 'contractActive: false'],
  [clientController, 'archiveStatus: "ARQUIVADO"'],
  [clientController, 'restoreClient'],
  [poolController, 'ensureTechnicalSheet'],
  [poolController, 'archiveStatus: "ARQUIVADO"'],
  [poolController, 'restorePool'],
  [guideController, 'inheritedFromId'],
  [guideController, 'isDraft'],
  [coreFlow, 'technicalSheet.upsert'],
  [coreFlow, "archiveStatus: 'ARQUIVADO'"],
];
for (const [txt, needle] of checks) {
  if (!txt.includes(needle)) {
    console.error('Falta no código:', needle);
    process.exit(1);
  }
}

const migration = fs.readFileSync(path.join(root, 'prisma/migrations/20260605000000_v22_6_6_enterprise_safe_migration/migration.sql'), 'utf8');
for (const needle of ['CREATE TYPE "ArchiveStatus"', 'CREATE TABLE IF NOT EXISTS "TechnicalSheet"', 'ALTER TABLE "Pool" DROP CONSTRAINT IF EXISTS "Pool_clientId_fkey"']) {
  if (!migration.includes(needle)) {
    console.error('Migração incompleta:', needle);
    process.exit(1);
  }
}

console.log('✅ V22.6.6 Enterprise Safe Migration static audit OK');
