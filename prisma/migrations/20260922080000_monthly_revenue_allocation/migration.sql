-- CreateTable
CREATE TABLE "RevenueAllocation" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "lineId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "monthRef" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "targetHash" TEXT NOT NULL,
    "targetSnapshot" JSONB NOT NULL,
    "activeKey" TEXT,
    "reason" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "RevenueAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevenueEvent" (
    "id" SERIAL NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" INTEGER NOT NULL,
    "actorName" TEXT NOT NULL,
    "lineId" INTEGER NOT NULL,
    "command" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RevenueAllocation_activeKey_key" ON "RevenueAllocation"("activeKey");

-- CreateIndex
CREATE INDEX "RevenueAllocation_lineId_idx" ON "RevenueAllocation"("lineId");

-- CreateIndex
CREATE INDEX "RevenueAllocation_invoiceId_idx" ON "RevenueAllocation"("invoiceId");

-- CreateIndex
CREATE INDEX "RevenueAllocation_monthRef_clientId_idx" ON "RevenueAllocation"("monthRef", "clientId");

-- CreateIndex
CREATE INDEX "RevenueAllocation_targetType_targetId_idx" ON "RevenueAllocation"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueEvent_requestId_key" ON "RevenueEvent"("requestId");

-- CreateIndex
CREATE INDEX "RevenueEvent_lineId_createdAt_idx" ON "RevenueEvent"("lineId", "createdAt");

-- CreateIndex
CREATE INDEX "RevenueEvent_actorId_createdAt_idx" ON "RevenueEvent"("actorId", "createdAt");


-- Preserve immutable attribution history without blocking historical source edits.
ALTER TABLE "RevenueAllocation" ADD CONSTRAINT "RevenueAllocation_values_check" CHECK (
  "invoiceId" > 0 AND "lineId" > 0 AND "clientId" > 0 AND "targetId" > 0 AND "createdById" > 0 AND "amountCents" > 0
  AND "targetType" IN ('REGULAR','EXTRA') AND "monthRef" ~ '^(20|21)[0-9]{2}-(0[1-9]|1[0-2])$'
  AND "sourceHash" ~ '^[a-f0-9]{64}$' AND "targetHash" ~ '^[a-f0-9]{64}$' AND length(btrim("reason")) BETWEEN 1 AND 500
  AND (("voidedAt" IS NULL AND "voidReason" IS NULL AND "activeKey" IS NOT NULL AND "activeKey" = "targetType" || ':' || "targetId"::text)
    OR ("voidedAt" IS NOT NULL AND "activeKey" IS NULL AND "voidReason" IS NOT NULL AND length(btrim("voidReason")) BETWEEN 1 AND 500))
);
ALTER TABLE "RevenueEvent" ADD CONSTRAINT "RevenueEvent_values_check" CHECK (
  "actorId" > 0 AND "lineId" > 0 AND "command" IN ('ALLOCATE','VOID') AND "payloadHash" ~ '^[a-f0-9]{64}$'
  AND "requestId" ~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
);
