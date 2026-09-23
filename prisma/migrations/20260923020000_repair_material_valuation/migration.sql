-- Permit confirmed repair material valuation without rewriting historical allocations.
-- Repair labor remains outside this measurement contract.
ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_valuation_shape_check";
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_valuation_shape_check" CHECK (
 ("valuationType"='MANUAL' AND "valuationKey" IS NULL AND "valuationHash" IS NULL AND "valuationSnapshot" IS NULL AND "quantity" IS NULL AND "quantityUnit" IS NULL AND "purchaseItemId" IS NULL AND "activeMeasurementKey" IS NULL)
 OR ("valuationType" IN ('MATERIAL','LABOR') AND ("targetType" IN ('REGULAR','EXTRA') OR ("targetType"='REPAIR' AND "valuationType"='MATERIAL')) AND "valuationKey" IS NOT NULL AND "valuationKey" ~ '^[a-f0-9]{64}$' AND "valuationHash" IS NOT NULL AND "valuationHash" ~ '^[a-f0-9]{64}$' AND "valuationSnapshot" IS NOT NULL AND jsonb_typeof("valuationSnapshot")='object' AND "quantity" IS NOT NULL AND "quantity">0 AND "quantityUnit" IS NOT NULL AND length(btrim("quantityUnit"))>0
   AND (("valuationType"='MATERIAL' AND "purchaseItemId" IS NOT NULL AND "activeMeasurementKey" IS NULL)
     OR ("valuationType"='LABOR' AND "purchaseItemId" IS NULL AND "quantityUnit"='SECOND' AND (("voidedAt" IS NULL AND "activeMeasurementKey" IS NOT NULL AND length("activeMeasurementKey")>0) OR ("voidedAt" IS NOT NULL AND "activeMeasurementKey" IS NULL)))))
);
