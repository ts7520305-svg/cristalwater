-- Add only an optional historical identity; no repair or existing allocation
-- is rewritten. There is deliberately no Repair FK: its deletion must leave
-- the expense snapshot available for review and explicit voiding.
ALTER TABLE "ExpenseAllocation" ADD COLUMN "repairId" INTEGER;
CREATE INDEX "ExpenseAllocation_repairId_idx" ON "ExpenseAllocation"("repairId");
ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_target";
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_target" CHECK (
 ("targetType" = 'COMPANY' AND "clientId" IS NULL AND "visitId" IS NULL AND "extraVisitId" IS NULL AND "repairId" IS NULL) OR
 ("targetType" = 'CLIENT' AND "clientId" IS NOT NULL AND "visitId" IS NULL AND "extraVisitId" IS NULL AND "repairId" IS NULL) OR
 ("targetType" = 'REGULAR' AND "clientId" IS NOT NULL AND "visitId" IS NOT NULL AND "extraVisitId" IS NULL AND "repairId" IS NULL) OR
 ("targetType" = 'EXTRA' AND "clientId" IS NOT NULL AND "visitId" IS NULL AND "extraVisitId" IS NOT NULL AND "repairId" IS NULL) OR
 ("targetType" = 'REPAIR' AND "clientId" IS NOT NULL AND "visitId" IS NULL AND "extraVisitId" IS NULL AND "repairId" IS NOT NULL AND "repairId" > 0));
-- ExpenseAllocation_valuation_shape_check already restricts measured material
-- and labor valuations to regular/extra visits. Repairs remain manual only.
