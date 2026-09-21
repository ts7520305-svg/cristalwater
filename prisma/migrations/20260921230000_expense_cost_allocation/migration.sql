-- CreateTable
CREATE TABLE "ExpenseAllocation" (
    "id" SERIAL NOT NULL,
    "expenseId" INTEGER NOT NULL,
    "monthRef" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "targetType" TEXT NOT NULL,
    "clientId" INTEGER,
    "visitId" INTEGER,
    "extraVisitId" INTEGER,
    "targetHash" TEXT NOT NULL,
    "targetSnapshot" JSONB NOT NULL,
    "expenseHash" TEXT NOT NULL,
    "expenseSnapshot" JSONB NOT NULL,
    "activeKey" TEXT,
    "reason" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "ExpenseAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseAllocation_activeKey_key" ON "ExpenseAllocation"("activeKey");

-- CreateIndex
CREATE INDEX "ExpenseAllocation_expenseId_idx" ON "ExpenseAllocation"("expenseId");

-- CreateIndex
CREATE INDEX "ExpenseAllocation_monthRef_clientId_idx" ON "ExpenseAllocation"("monthRef", "clientId");

-- CreateIndex
CREATE INDEX "ExpenseAllocation_visitId_idx" ON "ExpenseAllocation"("visitId");

-- CreateIndex
CREATE INDEX "ExpenseAllocation_extraVisitId_idx" ON "ExpenseAllocation"("extraVisitId");

-- AddForeignKey
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "CompanyExpense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "ServiceVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_extraVisitId_fkey" FOREIGN KEY ("extraVisitId") REFERENCES "ExtraVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Only new attribution rows are constrained; existing expenses and visits are preserved.
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_amount" CHECK ("amountCents" > 0);
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_month" CHECK ("monthRef" ~ '^(20|21)[0-9]{2}-(0[1-9]|1[0-2])$');
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_target" CHECK (
 ("targetType" = 'COMPANY' AND "clientId" IS NULL AND "visitId" IS NULL AND "extraVisitId" IS NULL) OR
 ("targetType" = 'CLIENT' AND "clientId" IS NOT NULL AND "visitId" IS NULL AND "extraVisitId" IS NULL) OR
 ("targetType" = 'REGULAR' AND "clientId" IS NOT NULL AND "visitId" IS NOT NULL AND "extraVisitId" IS NULL) OR
 ("targetType" = 'EXTRA' AND "clientId" IS NOT NULL AND "visitId" IS NULL AND "extraVisitId" IS NOT NULL));
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_active" CHECK (
 ("voidedAt" IS NULL AND "voidReason" IS NULL AND "activeKey" IS NOT NULL) OR
 ("voidedAt" IS NOT NULL AND "voidReason" IS NOT NULL AND length(trim("voidReason")) > 0 AND "activeKey" IS NULL));
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_reason" CHECK (length(trim("reason")) > 0);
