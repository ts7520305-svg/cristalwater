-- Compositions reuse the original expense budgets; no cash entries are created.
CREATE TABLE "LaborCostBasis" (
 "id" SERIAL PRIMARY KEY, "snapshot" JSONB NOT NULL, "fingerprint" TEXT NOT NULL,
 "technicianName" TEXT NOT NULL, "activeKey" TEXT, "reason" TEXT NOT NULL,
 "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "voidedAt" TIMESTAMP(3), "voidedBy" TEXT, "voidReason" TEXT,
 CONSTRAINT "LaborCostBasis_shape_check" CHECK (jsonb_typeof("snapshot")='object' AND "fingerprint" ~ '^[a-f0-9]{64}$' AND length(btrim("reason"))>0 AND "createdBy" ~ '^ADMIN:[1-9][0-9]*$'),
 CONSTRAINT "LaborCostBasis_active_check" CHECK (("voidedAt" IS NULL AND "activeKey" IS NOT NULL AND "activeKey" ~ '^[a-f0-9]{64}$' AND "voidedBy" IS NULL AND "voidReason" IS NULL) OR ("voidedAt" IS NOT NULL AND "activeKey" IS NULL AND "voidedBy" IS NOT NULL AND "voidReason" IS NOT NULL AND length(btrim("voidReason"))>0))
);
CREATE UNIQUE INDEX "LaborCostBasis_activeKey_key" ON "LaborCostBasis"("activeKey");
CREATE TABLE "LaborCostValuation" (
 "id" SERIAL PRIMARY KEY, "basisId" INTEGER NOT NULL, "snapshot" JSONB NOT NULL, "fingerprint" TEXT NOT NULL,
 "reason" TEXT NOT NULL, "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "voidedAt" TIMESTAMP(3), "voidedBy" TEXT, "voidReason" TEXT,
 CONSTRAINT "LaborCostValuation_basisId_fkey" FOREIGN KEY ("basisId") REFERENCES "LaborCostBasis"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "LaborCostValuation_shape_check" CHECK (jsonb_typeof("snapshot")='object' AND "fingerprint" ~ '^[a-f0-9]{64}$' AND length(btrim("reason"))>0 AND "createdBy" ~ '^ADMIN:[1-9][0-9]*$'),
 CONSTRAINT "LaborCostValuation_active_check" CHECK (("voidedAt" IS NULL AND "voidedBy" IS NULL AND "voidReason" IS NULL) OR ("voidedAt" IS NOT NULL AND "voidedBy" IS NOT NULL AND "voidReason" IS NOT NULL AND length(btrim("voidReason"))>0))
);
CREATE INDEX "LaborCostValuation_basisId_idx" ON "LaborCostValuation"("basisId");
CREATE TABLE "LaborCostValuationPart" (
 "id" SERIAL PRIMARY KEY, "groupId" INTEGER NOT NULL, "allocationId" INTEGER NOT NULL, "expenseId" INTEGER NOT NULL,
 CONSTRAINT "LaborCostValuationPart_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LaborCostValuation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "LaborCostValuationPart_ids_check" CHECK ("allocationId">0 AND "expenseId">0)
);
CREATE UNIQUE INDEX "LaborCostValuationPart_allocationId_key" ON "LaborCostValuationPart"("allocationId");
CREATE UNIQUE INDEX "LaborCostValuationPart_groupId_expenseId_key" ON "LaborCostValuationPart"("groupId","expenseId");
CREATE INDEX "LaborCostValuationPart_expenseId_idx" ON "LaborCostValuationPart"("expenseId");

ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_repair_labor_interval_check";
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_repair_labor_interval_check" CHECK (
 "targetType" <> 'REPAIR' OR "valuationType" <> 'LABOR' OR COALESCE((
   "valuationSnapshot" #>> '{source,version}' = '3'
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

ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_composition_check" CHECK (
 NOT COALESCE("valuationSnapshot" ? 'composition',FALSE) OR COALESCE((
 "valuationType"='LABOR' AND jsonb_typeof("valuationSnapshot"->'composition')='object'
 AND "valuationSnapshot" #>> '{composition,version}'='1'
 AND jsonb_typeof("valuationSnapshot" #> '{composition,expenseIds}')='array'
 AND jsonb_array_length("valuationSnapshot" #> '{composition,expenseIds}') BETWEEN 2 AND 20
 AND "valuationSnapshot" #> '{composition,expenseIds}' @> jsonb_build_array("expenseId")
 AND "valuationSnapshot" #>> '{composition,basisFingerprint}' ~ '^[a-f0-9]{64}$'
 AND "valuationSnapshot" #>> '{composition,basisId}' ~ '^[1-9][0-9]{0,9}$'
 AND "valuationSnapshot" #>> '{composition,groupId}' ~ '^[1-9][0-9]{0,9}$'
 AND "valuationSnapshot" #>> '{composition,primaryExpenseId}' = "valuationSnapshot" #>> '{composition,expenseIds,0}'
 AND ("voidedAt" IS NOT NULL OR "activeMeasurementKey" = 'LABOR:' || "targetType" || ':' || COALESCE("visitId","extraVisitId","repairId") || CASE WHEN "targetType"='REPAIR' THEN ':INTERVAL:' || ("valuationSnapshot" #>> '{source,workInterval,id}') ELSE '' END || CASE WHEN "valuationSnapshot" #>> '{composition,primaryExpenseId}' <> "expenseId"::text THEN ':COMPONENT:' || "expenseId"::text ELSE '' END)
 ),FALSE)
);
