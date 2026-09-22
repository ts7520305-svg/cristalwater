-- CreateTable
CREATE TABLE "CreditRevenueAllocation" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "lineId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "monthRef" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "targetLineId" INTEGER NOT NULL,
    "serviceType" TEXT NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "serviceMonth" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "targetHash" TEXT NOT NULL,
    "targetSnapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "CreditRevenueAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditRevenueEvent" (
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

    CONSTRAINT "CreditRevenueEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditRevenueAllocation_lineId_idx" ON "CreditRevenueAllocation"("lineId");

-- CreateIndex
CREATE INDEX "CreditRevenueAllocation_invoiceId_idx" ON "CreditRevenueAllocation"("invoiceId");

-- CreateIndex
CREATE INDEX "CreditRevenueAllocation_monthRef_clientId_idx" ON "CreditRevenueAllocation"("monthRef", "clientId");

-- CreateIndex
CREATE INDEX "CreditRevenueAllocation_targetType_targetId_idx" ON "CreditRevenueAllocation"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "CreditRevenueAllocation_serviceType_serviceId_idx" ON "CreditRevenueAllocation"("serviceType", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditRevenueEvent_requestId_key" ON "CreditRevenueEvent"("requestId");

-- CreateIndex
CREATE INDEX "CreditRevenueEvent_lineId_createdAt_idx" ON "CreditRevenueEvent"("lineId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditRevenueEvent_actorId_createdAt_idx" ON "CreditRevenueEvent"("actorId", "createdAt");

-- History has no cascading foreign keys: deleted sources must still be reviewable.
ALTER TABLE "CreditRevenueAllocation" ADD CONSTRAINT "CreditRevenueAllocation_values_check" CHECK (
 "invoiceId">0 AND "lineId">0 AND "clientId">0 AND "amountCents">0 AND "targetId">0 AND "targetLineId">0 AND "serviceId">0 AND "createdById">0
 AND "targetType" IN ('LINE','MONTHLY_ALLOCATION') AND "serviceType" IN ('REGULAR','EXTRA','MAINTENANCE_EQUIPMENT','MAINTENANCE_REMINDER','REPAIR')
 AND "monthRef" ~ '^(20|21)[0-9]{2}-(0[1-9]|1[0-2])$' AND "serviceMonth" ~ '^(20|21)[0-9]{2}-(0[1-9]|1[0-2])$'
 AND "sourceHash" ~ '^[a-f0-9]{64}$' AND "targetHash" ~ '^[a-f0-9]{64}$' AND length(trim("reason")) BETWEEN 1 AND 500
 AND (("voidedAt" IS NULL AND "voidReason" IS NULL) OR ("voidedAt" IS NOT NULL AND "voidReason" IS NOT NULL AND length(trim("voidReason")) BETWEEN 1 AND 500))
);
ALTER TABLE "CreditRevenueEvent" ADD CONSTRAINT "CreditRevenueEvent_values_check" CHECK (
 "actorId">0 AND "lineId">0 AND "command" IN ('ALLOCATE','VOID') AND length("actorName") BETWEEN 1 AND 180
 AND "requestId" ~ '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' AND "payloadHash" ~ '^[a-f0-9]{64}$'
);
