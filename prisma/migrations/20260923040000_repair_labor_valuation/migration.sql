-- Add declared repair-interval labor valuation without rewriting previous allocations.
ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_valuation_shape_check";
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_valuation_shape_check" CHECK (
 ("valuationType"='MANUAL' AND "valuationKey" IS NULL AND "valuationHash" IS NULL AND "valuationSnapshot" IS NULL AND "quantity" IS NULL AND "quantityUnit" IS NULL AND "purchaseItemId" IS NULL AND "activeMeasurementKey" IS NULL)
 OR ("valuationType" IN ('MATERIAL','LABOR') AND "targetType" IN ('REGULAR','EXTRA','REPAIR') AND "valuationKey" IS NOT NULL AND "valuationKey" ~ '^[a-f0-9]{64}$' AND "valuationHash" IS NOT NULL AND "valuationHash" ~ '^[a-f0-9]{64}$' AND "valuationSnapshot" IS NOT NULL AND jsonb_typeof("valuationSnapshot")='object' AND "quantity" IS NOT NULL AND "quantity">0 AND "quantityUnit" IS NOT NULL AND length(btrim("quantityUnit"))>0
   AND (("valuationType"='MATERIAL' AND "purchaseItemId" IS NOT NULL AND "activeMeasurementKey" IS NULL)
     OR ("valuationType"='LABOR' AND "purchaseItemId" IS NULL AND "quantityUnit"='SECOND' AND (("voidedAt" IS NULL AND "activeMeasurementKey" IS NOT NULL AND length("activeMeasurementKey")>0) OR ("voidedAt" IS NOT NULL AND "activeMeasurementKey" IS NULL)))))
);

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
   AND ("voidedAt" IS NOT NULL OR "activeMeasurementKey" = 'LABOR:REPAIR:' || "repairId" || ':INTERVAL:' || ("valuationSnapshot" #>> '{source,workInterval,id}'))
 ), FALSE)
);
