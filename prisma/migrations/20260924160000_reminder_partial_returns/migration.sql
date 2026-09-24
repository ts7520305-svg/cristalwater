-- Preserve version-8 receipts and allow proved net consumption after partial returns.
ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_reminder_material_source_check";
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_reminder_material_source_check" CHECK (
 "targetType" <> 'MAINTENANCE_REMINDER' OR "valuationType" <> 'MATERIAL' OR COALESCE((
   "valuationSnapshot" #>> '{source,version}' IN ('8','11')
   AND "valuationSnapshot" #>> '{source,kind}'='MATERIAL'
   AND "valuationSnapshot" #>> '{source,materialBasis}'='CONFIRMED_INDEPENDENT_REMINDER_CONSUMPTION'
   AND "valuationSnapshot" #>> '{source,service,type}'='MAINTENANCE_REMINDER'
   AND "valuationSnapshot" #>> '{source,service,id}'="serviceReminderId"::text
   AND "valuationSnapshot" #>> '{source,service,clientId}'="clientId"::text
   AND "valuationSnapshot" #>> '{source,item,id}'="purchaseItemId"::text
   AND jsonb_typeof("valuationSnapshot" #> '{source,movements}')='array'
   AND (("valuationSnapshot" #>> '{source,version}'='8' AND jsonb_array_length("valuationSnapshot" #> '{source,movements}')=1 AND NOT ("valuationSnapshot"->'source' ? 'returns'))
     OR ("valuationSnapshot" #>> '{source,version}'='11' AND jsonb_array_length("valuationSnapshot" #> '{source,movements}')>1
       AND jsonb_typeof("valuationSnapshot" #> '{source,returns}')='array' AND jsonb_array_length("valuationSnapshot" #> '{source,returns}')>0
       AND "valuationSnapshot" #>> '{source,returns,0,applied}'='true'
       AND "valuationSnapshot" #>> '{source,returns,0,event,schema}'='2'
       AND "valuationSnapshot" #>> '{source,returns,0,event,basis}'='CONFIRMED_INDEPENDENT_REMINDER_CONSUMPTION'
       AND "valuationSnapshot" #>> '{source,returns,0,event,reminderId}'="serviceReminderId"::text
       AND "valuationSnapshot" #>> '{source,returns,0,event,preview,selection,action}'='RETURN'
       AND "valuationSnapshot" #>> '{source,returns,0,event,preview,selection,recordId}'="valuationSnapshot" #>> '{source,consumption,event,id}'
       AND "valuationSnapshot" #>> '{source,returns,0,eventHash}' ~ '^[a-f0-9]{64}$'))
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
