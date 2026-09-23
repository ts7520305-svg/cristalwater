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
 AND ("voidedAt" IS NOT NULL OR "activeMeasurementKey" = 'LABOR:' || "targetType" || ':' || COALESCE("visitId","extraVisitId","repairId") || CASE WHEN "targetType"='REPAIR' THEN ':INTERVAL:' || ("valuationSnapshot" #>> '{source,workInterval,id}') ELSE '' END || CASE WHEN "valuationSnapshot" #>> '{composition,primaryExpenseId}' <> "expenseId"::text THEN ':COMPONENT:' || "expenseId"::text ELSE '' END)
 ),FALSE)
);

ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_labor_distribution_check";
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_labor_distribution_check" CHECK (
 (NOT COALESCE(("valuationSnapshot"->'source') ? 'laborDistribution',false) AND COALESCE("valuationSnapshot" #>> '{source,version}','') NOT IN ('4','5'))
 OR COALESCE((
   "valuationType"='LABOR' AND (NOT ("valuationSnapshot" ? 'composition') OR "valuationSnapshot" #>> '{composition,version}'='2')
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
