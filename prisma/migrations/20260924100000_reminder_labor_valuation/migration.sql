-- Permit confirmed independent reminder labor without rewriting prior allocations.
ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_valuation_shape_check";
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_valuation_shape_check" CHECK (
 ("valuationType"='MANUAL' AND "valuationKey" IS NULL AND "valuationHash" IS NULL AND "valuationSnapshot" IS NULL AND "quantity" IS NULL AND "quantityUnit" IS NULL AND "purchaseItemId" IS NULL AND "activeMeasurementKey" IS NULL)
 OR ("valuationType" IN ('MATERIAL','LABOR') AND ("targetType" IN ('REGULAR','EXTRA','REPAIR') OR ("targetType"='MAINTENANCE_REMINDER' AND "valuationType"='LABOR')) AND "valuationKey" IS NOT NULL AND "valuationKey" ~ '^[a-f0-9]{64}$' AND "valuationHash" IS NOT NULL AND "valuationHash" ~ '^[a-f0-9]{64}$' AND "valuationSnapshot" IS NOT NULL AND jsonb_typeof("valuationSnapshot")='object' AND "quantity" IS NOT NULL AND "quantity">0 AND "quantityUnit" IS NOT NULL AND length(btrim("quantityUnit"))>0
   AND (("valuationType"='MATERIAL' AND "purchaseItemId" IS NOT NULL AND "activeMeasurementKey" IS NULL)
     OR ("valuationType"='LABOR' AND "purchaseItemId" IS NULL AND "quantityUnit"='SECOND' AND (("voidedAt" IS NULL AND "activeMeasurementKey" IS NOT NULL AND length("activeMeasurementKey")>0) OR ("voidedAt" IS NOT NULL AND "activeMeasurementKey" IS NULL)))))
);

-- Preserve all receipts and budgets; permit explicit parts in version-two compositions.
ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_composition_check";
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_composition_check" CHECK (
 NOT COALESCE("valuationSnapshot" ? 'composition',FALSE) OR COALESCE((
 "valuationType"='LABOR' AND jsonb_typeof("valuationSnapshot"->'composition')='object'
 AND "valuationSnapshot" #>> '{composition,version}' IN ('1','2')
 AND ("valuationSnapshot" #>> '{composition,version}'='1' OR (
   jsonb_typeof("valuationSnapshot" #> '{composition,components}')='array'
   AND jsonb_array_length("valuationSnapshot" #> '{composition,components}')=jsonb_array_length("valuationSnapshot" #> '{composition,expenseIds}')
   AND "valuationSnapshot" #>> '{composition,components,0,expenseId}'="valuationSnapshot" #>> '{composition,primaryExpenseId}'
   AND "valuationSnapshot" #> '{composition,components}' @> jsonb_build_array(jsonb_build_object('expenseId',"expenseId",'distributionId',COALESCE("valuationSnapshot" #> '{source,laborDistribution,id}','null'::jsonb),'laborPart',COALESCE("valuationSnapshot" #> '{source,laborDistribution,partIndex}','null'::jsonb)))
 ))
 AND jsonb_typeof("valuationSnapshot" #> '{composition,expenseIds}')='array'
 AND jsonb_array_length("valuationSnapshot" #> '{composition,expenseIds}') BETWEEN 2 AND 20
 AND "valuationSnapshot" #> '{composition,expenseIds}' @> jsonb_build_array("expenseId")
 AND "valuationSnapshot" #>> '{composition,basisFingerprint}' ~ '^[a-f0-9]{64}$'
 AND "valuationSnapshot" #>> '{composition,basisId}' ~ '^[1-9][0-9]{0,9}$'
 AND "valuationSnapshot" #>> '{composition,groupId}' ~ '^[1-9][0-9]{0,9}$'
 AND "valuationSnapshot" #>> '{composition,primaryExpenseId}' = "valuationSnapshot" #>> '{composition,expenseIds,0}'
 AND ("voidedAt" IS NOT NULL OR "activeMeasurementKey" = 'LABOR:' || "targetType" || ':' || COALESCE("visitId","extraVisitId","repairId","serviceReminderId") || CASE WHEN "targetType" IN ('REPAIR','MAINTENANCE_REMINDER') THEN ':INTERVAL:' || ("valuationSnapshot" #>> '{source,workInterval,id}') ELSE '' END || CASE WHEN "valuationSnapshot" #>> '{composition,primaryExpenseId}' <> "expenseId"::text THEN ':COMPONENT:' || "expenseId"::text ELSE '' END)
 ),FALSE)
);

ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_labor_distribution_check";
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_labor_distribution_check" CHECK (
 (NOT COALESCE(("valuationSnapshot"->'source') ? 'laborDistribution',false) AND COALESCE("valuationSnapshot" #>> '{source,version}','') NOT IN ('4','5','7'))
 OR COALESCE((
   "valuationType"='LABOR' AND (NOT ("valuationSnapshot" ? 'composition') OR "valuationSnapshot" #>> '{composition,version}'='2')
   AND (("targetType" IN ('REGULAR','EXTRA') AND "valuationSnapshot" #>> '{source,version}'='4') OR ("targetType"='REPAIR' AND "valuationSnapshot" #>> '{source,version}'='5') OR ("targetType"='MAINTENANCE_REMINDER' AND "valuationSnapshot" #>> '{source,version}'='7'))
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


-- Typed independent work keeps reminder IDs separate from repair IDs.
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_reminder_labor_interval_check" CHECK (
 "targetType" <> 'MAINTENANCE_REMINDER' OR "valuationType" <> 'LABOR' OR COALESCE((
   "valuationSnapshot" #>> '{source,version}' IN ('6','7')
   AND "valuationSnapshot" #>> '{source,kind}' = 'LABOR'
   AND "valuationSnapshot" #>> '{source,workBasis}' = 'CONFIRMED_INDEPENDENT_REMINDER_WORK'
   AND "valuationSnapshot" #>> '{source,service,type}' = 'MAINTENANCE_REMINDER'
   AND "valuationSnapshot" #>> '{source,service,id}' = "serviceReminderId"::text
   AND "valuationSnapshot" #>> '{source,service,clientId}' = "clientId"::text
   AND jsonb_typeof("valuationSnapshot" #> '{source,workInterval,id}') = 'number'
   AND CASE WHEN "valuationSnapshot" #>> '{source,workInterval,id}' ~ '^[1-9][0-9]{0,9}$'
       THEN ("valuationSnapshot" #>> '{source,workInterval,id}')::bigint BETWEEN 1 AND 2147483647 ELSE FALSE END
   AND "valuationSnapshot" #>> '{source,workInterval,fingerprint}' ~ '^[a-f0-9]{64}$'
   AND jsonb_typeof("valuationSnapshot" #> '{source,workInterval,snapshot}') = 'object'
   AND "valuationSnapshot" #>> '{source,workInterval,snapshot,version}' = '1'
   AND "valuationSnapshot" #>> '{source,workInterval,snapshot,basis}' = 'CONFIRMED_INDEPENDENT_REMINDER_WORK'
   AND "valuationSnapshot" #>> '{source,workInterval,snapshot,reminderId}' = "serviceReminderId"::text
   AND "valuationSnapshot" #>> '{source,workInterval,snapshot,clientId}' = "clientId"::text
   AND "valuationSnapshot" #>> '{source,workInterval,snapshot,technicianId}' = "valuationSnapshot" #>> '{source,basis,technicianId}'
   AND "valuationSnapshot" #>> '{source,workInterval,snapshot,durationSeconds}' = trunc("quantity")::bigint::text
   AND jsonb_typeof("valuationSnapshot" #> '{source,workInterval,snapshot,declaration}') = 'object'
   AND "valuationSnapshot" #>> '{source,workInterval,snapshot,declaration,applied}' = 'true'
   AND "valuationSnapshot" #>> '{source,workInterval,snapshot,declaration,event,recordId}' = "valuationSnapshot" #>> '{source,workInterval,id}'
   AND "valuationSnapshot" #>> '{source,workInterval,snapshot,declaration,event,preview,action}' = 'DECLARE'
   AND "quantity" = trunc("quantity")
   AND ( "voidedAt" IS NOT NULL OR "activeMeasurementKey" =
     'LABOR:MAINTENANCE_REMINDER:' || "serviceReminderId" || ':INTERVAL:' || ("valuationSnapshot" #>> '{source,workInterval,id}')
     || CASE WHEN "valuationSnapshot" ? 'composition' AND "valuationSnapshot" #>> '{composition,primaryExpenseId}' <> "expenseId"::text THEN ':COMPONENT:' || "expenseId"::text ELSE '' END )
 ), FALSE)
);
