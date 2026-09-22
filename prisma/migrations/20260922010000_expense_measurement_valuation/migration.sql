-- AlterTable
ALTER TABLE "ExpenseAllocation" ADD COLUMN     "activeMeasurementKey" TEXT,
ADD COLUMN     "purchaseItemId" INTEGER,
ADD COLUMN     "quantity" DECIMAL(18,6),
ADD COLUMN     "quantityUnit" TEXT,
ADD COLUMN     "valuationHash" TEXT,
ADD COLUMN     "valuationKey" TEXT,
ADD COLUMN     "valuationSnapshot" JSONB,
ADD COLUMN     "valuationType" TEXT NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "ExpenseLaborBasis" (
    "id" SERIAL NOT NULL,
    "expenseId" INTEGER NOT NULL,
    "technicianId" INTEGER NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "paidMinutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseLaborBasis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseLaborBasis_expenseId_key" ON "ExpenseLaborBasis"("expenseId");

-- CreateIndex
CREATE INDEX "ExpenseLaborBasis_technicianId_periodStart_periodEnd_idx" ON "ExpenseLaborBasis"("technicianId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseAllocation_activeMeasurementKey_key" ON "ExpenseAllocation"("activeMeasurementKey");

-- CreateIndex
CREATE INDEX "ExpenseAllocation_valuationKey_idx" ON "ExpenseAllocation"("valuationKey");

-- CreateIndex
CREATE INDEX "ExpenseAllocation_purchaseItemId_idx" ON "ExpenseAllocation"("purchaseItemId");

-- AddForeignKey
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "StockPurchaseItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseLaborBasis" ADD CONSTRAINT "ExpenseLaborBasis_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "CompanyExpense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseLaborBasis" ADD CONSTRAINT "ExpenseLaborBasis_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Existing manual attributions retain their original values and identity.
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_valuation_shape_check" CHECK (
 ("valuationType"='MANUAL' AND "valuationKey" IS NULL AND "valuationHash" IS NULL AND "valuationSnapshot" IS NULL AND "quantity" IS NULL AND "quantityUnit" IS NULL AND "purchaseItemId" IS NULL AND "activeMeasurementKey" IS NULL)
 OR ("valuationType" IN ('MATERIAL','LABOR') AND "targetType" IN ('REGULAR','EXTRA') AND "valuationKey" IS NOT NULL AND "valuationKey" ~ '^[a-f0-9]{64}$' AND "valuationHash" IS NOT NULL AND "valuationHash" ~ '^[a-f0-9]{64}$' AND "valuationSnapshot" IS NOT NULL AND jsonb_typeof("valuationSnapshot")='object' AND "quantity" IS NOT NULL AND "quantity">0 AND "quantityUnit" IS NOT NULL AND length(btrim("quantityUnit"))>0
   AND (("valuationType"='MATERIAL' AND "purchaseItemId" IS NOT NULL AND "activeMeasurementKey" IS NULL)
     OR ("valuationType"='LABOR' AND "purchaseItemId" IS NULL AND "quantityUnit"='SECOND' AND (("voidedAt" IS NULL AND "activeMeasurementKey" IS NOT NULL AND length("activeMeasurementKey")>0) OR ("voidedAt" IS NOT NULL AND "activeMeasurementKey" IS NULL)))))
);
ALTER TABLE "ExpenseLaborBasis" ADD CONSTRAINT "ExpenseLaborBasis_period_check" CHECK ("periodStart">=DATE '2000-01-01' AND "periodEnd"<=DATE '2199-12-31' AND "periodEnd">="periodStart" AND "paidMinutes">0 AND "paidMinutes"<=("periodEnd"-"periodStart"+1)*1440 AND length(btrim("reason"))>0);
