-- Cristal Water V22.6.6 Enterprise Safe Migration
-- Incremental, preserva histórico e evita deletes físicos perigosos.

DO $$ BEGIN
  CREATE TYPE "ArchiveStatus" AS ENUM ('ATIVO', 'PAUSA', 'ARQUIVADO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "archiveStatus" "ArchiveStatus" NOT NULL DEFAULT 'ATIVO';
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "contractActive" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Pool" ADD COLUMN IF NOT EXISTS "archiveStatus" "ArchiveStatus" NOT NULL DEFAULT 'ATIVO';
ALTER TABLE "Pool" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "Technician" ADD COLUMN IF NOT EXISTS "archiveStatus" "ArchiveStatus" NOT NULL DEFAULT 'ATIVO';
ALTER TABLE "Technician" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "archiveStatus" "ArchiveStatus" NOT NULL DEFAULT 'ATIVO';
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "InventoryProduct" ADD COLUMN IF NOT EXISTS "archiveStatus" "ArchiveStatus" NOT NULL DEFAULT 'ATIVO';
ALTER TABLE "InventoryProduct" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "ServiceVisit" ADD COLUMN IF NOT EXISTS "orpMv" DOUBLE PRECISION;
ALTER TABLE "TransportGuide" ADD COLUMN IF NOT EXISTS "isDraft" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TransportGuide" ADD COLUMN IF NOT EXISTS "inheritedFromId" INTEGER;
ALTER TABLE "WorkGuide" ADD COLUMN IF NOT EXISTS "isDraft" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "WorkGuide" ADD COLUMN IF NOT EXISTS "inheritedFromId" INTEGER;

CREATE TABLE IF NOT EXISTS "TechnicalSheet" (
  "id" SERIAL NOT NULL,
  "poolId" INTEGER NOT NULL,
  "volumeM3" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "disinfectionType" TEXT NOT NULL DEFAULT 'CLORO',
  "targetPhMin" DOUBLE PRECISION NOT NULL DEFAULT 7.2,
  "targetPhMax" DOUBLE PRECISION NOT NULL DEFAULT 7.6,
  "targetChlorineMin" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "targetChlorineMax" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
  "targetAlkalinityMin" DOUBLE PRECISION NOT NULL DEFAULT 80,
  "targetAlkalinityMax" DOUBLE PRECISION NOT NULL DEFAULT 120,
  "targetOrpMinMv" DOUBLE PRECISION,
  "filterBrandModel" TEXT,
  "pumpHorsePower" DOUBLE PRECISION,
  "chlorinatorModel" TEXT,
  "technicalRoomLocation" TEXT,
  "specialObservations" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TechnicalSheet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KeyAccess" (
  "id" SERIAL NOT NULL,
  "keyCode" TEXT NOT NULL,
  "description" TEXT,
  "requiredForVisit" BOOLEAN NOT NULL DEFAULT false,
  "visibleToTechnician" BOOLEAN NOT NULL DEFAULT true,
  "assignedTechnicianId" INTEGER,
  "assignedAt" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KeyAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Attachment" (
  "id" SERIAL NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "clientId" INTEGER,
  "poolId" INTEGER,
  "serviceVisitId" INTEGER,
  "alertId" INTEGER,
  "repairId" INTEGER,
  "invoiceId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperationalReminder" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "isCompleted" BOOLEAN NOT NULL DEFAULT false,
  "clientId" INTEGER,
  "poolId" INTEGER,
  "assignedToTechnicianId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TechnicalSheet_poolId_key" ON "TechnicalSheet"("poolId");
CREATE UNIQUE INDEX IF NOT EXISTS "KeyAccess_keyCode_key" ON "KeyAccess"("keyCode");
CREATE INDEX IF NOT EXISTS "KeyAccess_assignedTechnicianId_idx" ON "KeyAccess"("assignedTechnicianId");
CREATE INDEX IF NOT EXISTS "Attachment_clientId_idx" ON "Attachment"("clientId");
CREATE INDEX IF NOT EXISTS "Attachment_poolId_idx" ON "Attachment"("poolId");
CREATE INDEX IF NOT EXISTS "Attachment_serviceVisitId_idx" ON "Attachment"("serviceVisitId");
CREATE INDEX IF NOT EXISTS "Attachment_alertId_idx" ON "Attachment"("alertId");
CREATE INDEX IF NOT EXISTS "Attachment_repairId_idx" ON "Attachment"("repairId");
CREATE INDEX IF NOT EXISTS "Attachment_invoiceId_idx" ON "Attachment"("invoiceId");
CREATE INDEX IF NOT EXISTS "OperationalReminder_dueDate_idx" ON "OperationalReminder"("dueDate");
CREATE INDEX IF NOT EXISTS "OperationalReminder_clientId_idx" ON "OperationalReminder"("clientId");
CREATE INDEX IF NOT EXISTS "OperationalReminder_poolId_idx" ON "OperationalReminder"("poolId");

DO $$ BEGIN
  ALTER TABLE "TechnicalSheet" ADD CONSTRAINT "TechnicalSheet_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "KeyAccess" ADD CONSTRAINT "KeyAccess_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_serviceVisitId_fkey" FOREIGN KEY ("serviceVisitId") REFERENCES "ServiceVisit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "TechnicalAlert"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "OperationalReminder" ADD CONSTRAINT "OperationalReminder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "OperationalReminder" ADD CONSTRAINT "OperationalReminder_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "OperationalReminder" ADD CONSTRAINT "OperationalReminder_assignedToTechnicianId_fkey" FOREIGN KEY ("assignedToTechnicianId") REFERENCES "Technician"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Troca de cascades perigosos por RESTRICT. Ignora se o nome da constraint for diferente.
DO $$ BEGIN
  ALTER TABLE "Pool" DROP CONSTRAINT IF EXISTS "Pool_clientId_fkey";
  ALTER TABLE "Pool" ADD CONSTRAINT "Pool_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_clientId_fkey";
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PoolEquipment" DROP CONSTRAINT IF EXISTS "PoolEquipment_poolId_fkey";
  ALTER TABLE "PoolEquipment" ADD CONSTRAINT "PoolEquipment_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "TechnicalRoom" DROP CONSTRAINT IF EXISTS "TechnicalRoom_poolId_fkey";
  ALTER TABLE "TechnicalRoom" ADD CONSTRAINT "TechnicalRoom_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "PoolCalculationProfile" DROP CONSTRAINT IF EXISTS "PoolCalculationProfile_poolId_fkey";
  ALTER TABLE "PoolCalculationProfile" ADD CONSTRAINT "PoolCalculationProfile_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
