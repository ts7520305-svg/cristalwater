-- Extend verified reminder labor formats. Existing rows, hashes, payments and reservations are not rewritten.
ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_labor_distribution_check";
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_labor_distribution_check" CHECK (
 (NOT COALESCE(("valuationSnapshot"->'source') ? 'laborDistribution',false) AND COALESCE("valuationSnapshot" #>> '{source,version}','') NOT IN ('4','5','7','10'))
 OR COALESCE((
   "valuationType"='LABOR' AND (NOT ("valuationSnapshot" ? 'composition') OR "valuationSnapshot" #>> '{composition,version}'='2')
   AND (("targetType" IN ('REGULAR','EXTRA') AND "valuationSnapshot" #>> '{source,version}'='4') OR ("targetType"='REPAIR' AND "valuationSnapshot" #>> '{source,version}'='5') OR ("targetType"='MAINTENANCE_REMINDER' AND "valuationSnapshot" #>> '{source,version}' IN ('7','10')))
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
ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_reminder_labor_interval_check";
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_reminder_labor_interval_check" CHECK (
 "targetType" <> 'MAINTENANCE_REMINDER' OR "valuationType" <> 'LABOR' OR COALESCE((
   "valuationSnapshot" #>> '{source,version}' IN ('6','7','9','10')
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
   AND (
     ("valuationSnapshot" #>> '{source,version}' IN ('6','7') AND "valuationSnapshot" #>> '{source,workInterval,snapshot,version}' = '1')
     OR ("valuationSnapshot" #>> '{source,version}' IN ('9','10') AND "valuationSnapshot" #>> '{source,workInterval,snapshot,version}' = '2'
       AND jsonb_typeof("valuationSnapshot" #> '{source,workInterval,snapshot,workIntervals}') = 'array'
       AND jsonb_array_length("valuationSnapshot" #> '{source,workInterval,snapshot,workIntervals}') BETWEEN 1 AND 20
       AND "valuationSnapshot" #> '{source,workInterval,snapshot,workIntervals}' = "valuationSnapshot" #> '{source,workInterval,snapshot,declaration,event,preview,proposed,workIntervals}'
       AND "valuationSnapshot" #>> '{source,workInterval,snapshot,durationSeconds}' = "valuationSnapshot" #>> '{source,workInterval,snapshot,declaration,event,preview,durationSeconds}'
       AND "valuationSnapshot" #>> '{source,workInterval,snapshot,startedAt}' = "valuationSnapshot" #>> '{source,workInterval,snapshot,workIntervals,0,startedAt}'
       AND "valuationSnapshot" #>> '{source,workInterval,snapshot,endedAt}' = "valuationSnapshot" #>> '{source,workInterval,snapshot,workIntervals,-1,endedAt}'
       AND "valuationSnapshot" #>> '{source,workInterval,snapshot,declaration,event,schema}' = '2'
       AND "valuationSnapshot" #>> '{source,workInterval,snapshot,declaration,event,preview,schema}' = '2'
     )
   )
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
