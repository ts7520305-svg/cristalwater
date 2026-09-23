-- Preserve operational repairs, completion proofs, costs and receipts without backfill.
CREATE TABLE "RepairWorkInterval" (
  "id" SERIAL NOT NULL,
  "repairId" INTEGER NOT NULL,
  "clientId" INTEGER NOT NULL,
  "poolId" INTEGER NOT NULL,
  "technicianId" INTEGER NOT NULL,
  "technicianName" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3) NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activeKey" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidedBy" TEXT,
  "voidReason" TEXT,
  CONSTRAINT "RepairWorkInterval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RepairWorkInterval_identity_check" CHECK (
    "repairId">0 AND "clientId">0 AND "poolId">0 AND "technicianId">0
    AND length(btrim("technicianName"))>0
    AND "createdBy" ~ '^(ADMIN:[1-9][0-9]*|TECH:[1-9][0-9]*|USER:[1-9][0-9]*:TECH:[1-9][0-9]*)$'
  ),
  CONSTRAINT "RepairWorkInterval_time_check" CHECK (
    "endedAt">"startedAt" AND "durationSeconds">0
    AND EXTRACT(EPOCH FROM ("endedAt"-"startedAt"))="durationSeconds"
    AND date_trunc('second',"startedAt")="startedAt" AND date_trunc('second',"endedAt")="endedAt"
    AND "createdAt">="endedAt"
  ),
  CONSTRAINT "RepairWorkInterval_evidence_check" CHECK (
    "sourceHash" ~ '^[a-f0-9]{64}$' AND "fingerprint" ~ '^[a-f0-9]{64}$'
    AND jsonb_typeof("snapshot")='object' AND length(btrim("reason")) BETWEEN 5 AND 1000
  ),
  CONSTRAINT "RepairWorkInterval_void_check" CHECK (
    ("voidedAt" IS NULL AND "voidedBy" IS NULL AND "voidReason" IS NULL AND "activeKey" IS NOT NULL AND "activeKey" ~ '^[a-f0-9]{64}$')
    OR ("voidedAt" IS NOT NULL AND "voidedAt">="createdAt" AND "voidedBy" IS NOT NULL
      AND "voidedBy" ~ '^(ADMIN:[1-9][0-9]*|TECH:[1-9][0-9]*|USER:[1-9][0-9]*:TECH:[1-9][0-9]*)$'
      AND "voidReason" IS NOT NULL AND length(btrim("voidReason")) BETWEEN 5 AND 1000 AND "activeKey" IS NULL)
  )
);
CREATE UNIQUE INDEX "RepairWorkInterval_activeKey_key" ON "RepairWorkInterval"("activeKey");
CREATE INDEX "RepairWorkInterval_repairId_createdAt_idx" ON "RepairWorkInterval"("repairId", "createdAt");
CREATE INDEX "RepairWorkInterval_technicianId_startedAt_endedAt_idx" ON "RepairWorkInterval"("technicianId", "startedAt", "endedAt");
