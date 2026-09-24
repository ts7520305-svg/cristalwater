-- Extend the measured-cost shape to authenticated independent reminder materials.
-- Previous rows, documents, receipts and stock history are preserved.
ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_valuation_shape_check";
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_valuation_shape_check" CHECK (
 ("valuationType"='MANUAL' AND "valuationKey" IS NULL AND "valuationHash" IS NULL AND "valuationSnapshot" IS NULL AND "quantity" IS NULL AND "quantityUnit" IS NULL AND "purchaseItemId" IS NULL AND "activeMeasurementKey" IS NULL)
 OR ("valuationType" IN ('MATERIAL','LABOR') AND "targetType" IN ('REGULAR','EXTRA','REPAIR','MAINTENANCE_REMINDER') AND "valuationKey" IS NOT NULL AND "valuationKey" ~ '^[a-f0-9]{64}$' AND "valuationHash" IS NOT NULL AND "valuationHash" ~ '^[a-f0-9]{64}$' AND "valuationSnapshot" IS NOT NULL AND jsonb_typeof("valuationSnapshot")='object' AND "quantity" IS NOT NULL AND "quantity">0 AND "quantityUnit" IS NOT NULL AND length(btrim("quantityUnit"))>0
   AND (("valuationType"='MATERIAL' AND "purchaseItemId" IS NOT NULL AND "activeMeasurementKey" IS NULL)
     OR ("valuationType"='LABOR' AND "purchaseItemId" IS NULL AND "quantityUnit"='SECOND' AND (("voidedAt" IS NULL AND "activeMeasurementKey" IS NOT NULL AND length("activeMeasurementKey")>0) OR ("voidedAt" IS NOT NULL AND "activeMeasurementKey" IS NULL)))))
);
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_reminder_material_source_check" CHECK (
 "targetType" <> 'MAINTENANCE_REMINDER' OR "valuationType" <> 'MATERIAL' OR COALESCE((
   "valuationSnapshot" #>> '{source,version}'='8'
   AND "valuationSnapshot" #>> '{source,kind}'='MATERIAL'
   AND "valuationSnapshot" #>> '{source,materialBasis}'='CONFIRMED_INDEPENDENT_REMINDER_CONSUMPTION'
   AND "valuationSnapshot" #>> '{source,service,type}'='MAINTENANCE_REMINDER'
   AND "valuationSnapshot" #>> '{source,service,id}'="serviceReminderId"::text
   AND "valuationSnapshot" #>> '{source,service,clientId}'="clientId"::text
   AND "valuationSnapshot" #>> '{source,item,id}'="purchaseItemId"::text
   AND jsonb_typeof("valuationSnapshot" #> '{source,movements}')='array'
   AND jsonb_array_length("valuationSnapshot" #> '{source,movements}')=1
   AND "valuationSnapshot" #>> '{source,consumption,applied}'='true'
   AND "valuationSnapshot" #>> '{source,consumption,event,basis}'='CONFIRMED_INDEPENDENT_REMINDER_CONSUMPTION'
   AND "valuationSnapshot" #>> '{source,consumption,event,reminderId}'="serviceReminderId"::text
   AND "valuationSnapshot" #>> '{source,consumption,event,id}' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
   AND "valuationSnapshot" #>> '{source,consumption,eventHash}' ~ '^[a-f0-9]{64}$'
   AND "valuationSnapshot" #>> '{source,consumption,event,preview,selection,action}'='CONSUME'
   AND "valuationSnapshot" #>> '{source,consumption,event,preview,origin,clientId}'="clientId"::text
   AND "valuationSnapshot" #>> '{source,consumption,event,preview,declaration,applied}'='true'
   AND "valuationSnapshot" #>> '{source,consumption,event,preview,declaration,event,preview,action}'='DECLARE'
 ),FALSE)
);
