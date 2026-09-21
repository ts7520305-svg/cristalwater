-- CreateTable
CREATE TABLE "CompanyExpense" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "supplierId" INTEGER,
    "supplierName" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "documentKey" TEXT,
    "expenseDate" DATE NOT NULL,
    "dueDate" DATE,
    "amountCents" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "stockPurchaseId" INTEGER,
    "maintenanceId" INTEGER,
    "sourceHash" TEXT,
    "sourceSnapshot" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "cancelledAt" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpensePayment" (
    "id" SERIAL NOT NULL,
    "expenseId" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidOn" DATE NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reverseReason" TEXT,

    CONSTRAINT "ExpensePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseEvent" (
    "id" SERIAL NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" INTEGER NOT NULL,
    "actorName" TEXT NOT NULL,
    "expenseId" INTEGER,
    "command" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseEvidence" (
    "id" SERIAL NOT NULL,
    "expenseId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,

    CONSTRAINT "ExpenseEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyExpense_documentKey_key" ON "CompanyExpense"("documentKey");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyExpense_stockPurchaseId_key" ON "CompanyExpense"("stockPurchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyExpense_maintenanceId_key" ON "CompanyExpense"("maintenanceId");

-- CreateIndex
CREATE INDEX "CompanyExpense_expenseDate_idx" ON "CompanyExpense"("expenseDate");

-- CreateIndex
CREATE INDEX "CompanyExpense_dueDate_idx" ON "CompanyExpense"("dueDate");

-- CreateIndex
CREATE INDEX "CompanyExpense_supplierId_idx" ON "CompanyExpense"("supplierId");

-- CreateIndex
CREATE INDEX "CompanyExpense_category_idx" ON "CompanyExpense"("category");

-- CreateIndex
CREATE INDEX "ExpensePayment_expenseId_idx" ON "ExpensePayment"("expenseId");

-- CreateIndex
CREATE INDEX "ExpensePayment_paidOn_idx" ON "ExpensePayment"("paidOn");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseEvent_requestId_key" ON "ExpenseEvent"("requestId");

-- CreateIndex
CREATE INDEX "ExpenseEvent_expenseId_id_idx" ON "ExpenseEvent"("expenseId", "id");

-- CreateIndex
CREATE INDEX "ExpenseEvent_actorId_idx" ON "ExpenseEvent"("actorId");

-- CreateIndex
CREATE INDEX "ExpenseEvidence_expenseId_idx" ON "ExpenseEvidence"("expenseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseEvidence_expenseId_sha256_key" ON "ExpenseEvidence"("expenseId", "sha256");

-- AddForeignKey
ALTER TABLE "CompanyExpense" ADD CONSTRAINT "CompanyExpense_stockPurchaseId_fkey" FOREIGN KEY ("stockPurchaseId") REFERENCES "StockPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyExpense" ADD CONSTRAINT "CompanyExpense_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "VehicleMaintenanceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "CompanyExpense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEvent" ADD CONSTRAINT "ExpenseEvent_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "CompanyExpense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseEvidence" ADD CONSTRAINT "ExpenseEvidence_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "CompanyExpense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity checks apply only to the new ledger; legacy source rows are untouched.
ALTER TABLE "CompanyExpense" ADD CONSTRAINT "CompanyExpense_positive_amount" CHECK ("amountCents" > 0 AND "version" > 0);
ALTER TABLE "CompanyExpense" ADD CONSTRAINT "CompanyExpense_source" CHECK (
 ("sourceType" = 'MANUAL' AND "stockPurchaseId" IS NULL AND "maintenanceId" IS NULL AND "sourceHash" IS NULL AND "sourceSnapshot" IS NULL) OR
 ("sourceType" = 'STOCK_PURCHASE' AND "stockPurchaseId" IS NOT NULL AND "maintenanceId" IS NULL AND "sourceHash" IS NOT NULL AND "sourceSnapshot" IS NOT NULL) OR
 ("sourceType" = 'VEHICLE_MAINTENANCE' AND "stockPurchaseId" IS NULL AND "maintenanceId" IS NOT NULL AND "sourceHash" IS NOT NULL AND "sourceSnapshot" IS NOT NULL));
ALTER TABLE "CompanyExpense" ADD CONSTRAINT "CompanyExpense_category" CHECK ("category" IN ('STOCK','MATERIAL','FUEL','VEHICLE','LABOR','INSURANCE','GENERAL'));
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_positive_amount" CHECK ("amountCents" > 0);
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_method" CHECK ("method" IN ('TRANSFER','CARD','CASH','OTHER'));
ALTER TABLE "ExpensePayment" ADD CONSTRAINT "ExpensePayment_reversal" CHECK (("reversedAt" IS NULL AND "reverseReason" IS NULL) OR ("reversedAt" IS NOT NULL AND "reverseReason" IS NOT NULL AND length(trim("reverseReason")) > 0));
ALTER TABLE "ExpenseEvidence" ADD CONSTRAINT "ExpenseEvidence_size" CHECK ("size" > 0 AND "size" <= 5242880 AND octet_length("bytes") = "size");
ALTER TABLE "ExpenseEvidence" ADD CONSTRAINT "ExpenseEvidence_mime" CHECK ("mime" IN ('application/pdf','image/png','image/jpeg'));

ALTER TABLE "ExpenseEvidence" ADD CONSTRAINT "ExpenseEvidence_void" CHECK (("voidedAt" IS NULL AND "voidReason" IS NULL) OR ("voidedAt" IS NOT NULL AND "voidReason" IS NOT NULL AND length(trim("voidReason")) > 0));
