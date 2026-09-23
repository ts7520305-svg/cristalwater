-- Confirmed distributions preserve one original expense/payment ledger.
CREATE TABLE "ExpenseLaborDistribution" (
 "id" SERIAL NOT NULL,
 "expenseId" INTEGER NOT NULL,
 "amountCents" INTEGER NOT NULL,
 "snapshot" JSONB NOT NULL,
 "fingerprint" TEXT NOT NULL,
 "activeKey" TEXT,
 "reason" TEXT NOT NULL,
 "createdById" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "voidedAt" TIMESTAMP(3),
 "voidReason" TEXT,
 CONSTRAINT "ExpenseLaborDistribution_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ExpenseLaborDistribution_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "CompanyExpense"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ExpenseLaborDistribution_values" CHECK ("amountCents">0 AND "createdById">0 AND length(btrim("reason"))>0 AND length("reason")<=500 AND "fingerprint" ~ '^[a-f0-9]{64}$'),
 CONSTRAINT "ExpenseLaborDistribution_state" CHECK (("voidedAt" IS NULL AND "voidReason" IS NULL AND "activeKey" IS NOT NULL AND "activeKey"="expenseId"::text) OR ("voidedAt" IS NOT NULL AND "activeKey" IS NULL AND "voidReason" IS NOT NULL AND length(btrim("voidReason"))>0 AND length("voidReason")<=500)),
 CONSTRAINT "ExpenseLaborDistribution_snapshot" CHECK (jsonb_typeof("snapshot")='object' AND COALESCE("snapshot"->>'version'='1',false) AND COALESCE("snapshot"->>'basis'='CONFIRMED_EXPENSE_LABOR_DISTRIBUTION',false) AND jsonb_typeof("snapshot"->'parts')='array' AND COALESCE(jsonb_array_length("snapshot"->'parts') BETWEEN 2 AND 20,false))
);
CREATE UNIQUE INDEX "ExpenseLaborDistribution_activeKey_key" ON "ExpenseLaborDistribution"("activeKey");
CREATE INDEX "ExpenseLaborDistribution_expenseId_createdAt_idx" ON "ExpenseLaborDistribution"("expenseId","createdAt");
-- No backfill or mutation of expense/allocation/basis/receipt history.
ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_repair_labor_interval_check";
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_repair_labor_interval_check" CHECK (
 "targetType" <> 'REPAIR' OR "valuationType" <> 'LABOR' OR COALESCE((
   "valuationSnapshot" #>> '{source,version}' IN ('3','5')
   AND "valuationSnapshot" #>> '{source,kind}' = 'LABOR'
   AND "valuationSnapshot" #>> '{source,workBasis}' = 'EXPLICIT_AUTHENTICATED_REPAIR_WORK_INTERVAL'
   AND jsonb_typeof("valuationSnapshot" #> '{source,workInterval,id}') = 'number'
   AND CASE WHEN "valuationSnapshot" #>> '{source,workInterval,id}' ~ '^[1-9][0-9]{0,9}$'
       THEN ("valuationSnapshot" #>> '{source,workInterval,id}')::bigint BETWEEN 1 AND 2147483647 ELSE FALSE END
   AND "valuationSnapshot" #>> '{source,workInterval,fingerprint}' ~ '^[a-f0-9]{64}$'
   AND jsonb_typeof("valuationSnapshot" #> '{source,workInterval,snapshot}') = 'object'
   AND "valuationSnapshot" #>> '{source,workInterval,snapshot,repairId}' = "repairId"::text
   AND "valuationSnapshot" #>> '{source,workInterval,snapshot,clientId}' = "clientId"::text
   AND "quantity" = trunc("quantity")
   AND ("voidedAt" IS NOT NULL OR "activeMeasurementKey" = 'LABOR:REPAIR:' || "repairId" || ':INTERVAL:' || ("valuationSnapshot" #>> '{source,workInterval,id}') || CASE WHEN "valuationSnapshot" ? 'composition' AND "valuationSnapshot" #>> '{composition,primaryExpenseId}' <> "expenseId"::text THEN ':COMPONENT:' || "expenseId"::text ELSE '' END)
 ), FALSE)
);
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_labor_distribution_check" CHECK (
 (NOT COALESCE(("valuationSnapshot"->'source') ? 'laborDistribution',false) AND COALESCE("valuationSnapshot" #>> '{source,version}','') NOT IN ('4','5'))
 OR COALESCE((
   "valuationType"='LABOR' AND NOT ("valuationSnapshot" ? 'composition')
   AND (("targetType" IN ('REGULAR','EXTRA') AND "valuationSnapshot" #>> '{source,version}'='4') OR ("targetType"='REPAIR' AND "valuationSnapshot" #>> '{source,version}'='5'))
   AND "valuationSnapshot" #>> '{source,kind}'='LABOR'
   AND jsonb_typeof("valuationSnapshot" #> '{source,laborDistribution}')='object'
   AND jsonb_typeof("valuationSnapshot" #> '{source,laborDistribution,id}')='number'
   AND "valuationSnapshot" #>> '{source,laborDistribution,id}' ~ '^[1-9][0-9]{0,9}$'
   AND jsonb_typeof("valuationSnapshot" #> '{source,laborDistribution,partIndex}')='number'
   AND "valuationSnapshot" #>> '{source,laborDistribution,partIndex}' ~ '^([1-9]|1[0-9]|20)$'
   AND "valuationSnapshot" #>> '{source,laborDistribution,fingerprint}' ~ '^[a-f0-9]{64}$'
   AND jsonb_typeof("valuationSnapshot" #> '{source,laborDistribution,snapshot}')='object'
   AND "valuationSnapshot" #>> '{source,laborDistribution,snapshot,version}'='1'
   AND "valuationSnapshot" #>> '{source,laborDistribution,snapshot,basis}'='CONFIRMED_EXPENSE_LABOR_DISTRIBUTION'
   AND "valuationSnapshot" #>> '{source,laborDistribution,snapshot,expense,id}'="expenseId"::text
   AND "valuationSnapshot" #>> '{source,basis,id}'="valuationSnapshot" #>> '{source,laborDistribution,id}'
   AND "valuationSnapshot" #>> '{source,basis,expenseId}'="expenseId"::text
 ),false)
);
