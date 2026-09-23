-- Historical typed identities only; do not rewrite existing cost evidence.
-- Source deletion must preserve the expense and its snapshot for review.
ALTER TABLE "ExpenseAllocation" ADD COLUMN "maintenanceCompletionId" INTEGER,
 ADD COLUMN "serviceReminderId" INTEGER;
CREATE INDEX "ExpenseAllocation_maintenanceCompletionId_idx" ON "ExpenseAllocation"("maintenanceCompletionId");
CREATE INDEX "ExpenseAllocation_serviceReminderId_idx" ON "ExpenseAllocation"("serviceReminderId");
ALTER TABLE "ExpenseAllocation" DROP CONSTRAINT "ExpenseAllocation_target";
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_target" CHECK (
 (("targetType" = 'COMPANY' AND "clientId" IS NULL AND "visitId" IS NULL AND "extraVisitId" IS NULL AND "repairId" IS NULL) OR
  ("targetType" = 'CLIENT' AND "clientId" IS NOT NULL AND "visitId" IS NULL AND "extraVisitId" IS NULL AND "repairId" IS NULL) OR
  ("targetType" = 'REGULAR' AND "clientId" IS NOT NULL AND "visitId" IS NOT NULL AND "extraVisitId" IS NULL AND "repairId" IS NULL) OR
  ("targetType" = 'EXTRA' AND "clientId" IS NOT NULL AND "visitId" IS NULL AND "extraVisitId" IS NOT NULL AND "repairId" IS NULL) OR
  ("targetType" = 'REPAIR' AND "clientId" IS NOT NULL AND "visitId" IS NULL AND "extraVisitId" IS NULL AND "repairId" IS NOT NULL AND "repairId" > 0))
   AND "maintenanceCompletionId" IS NULL AND "serviceReminderId" IS NULL
 OR ("targetType" = 'MAINTENANCE_EQUIPMENT' AND "clientId" IS NOT NULL AND "visitId" IS NULL AND "extraVisitId" IS NULL AND "repairId" IS NULL AND "maintenanceCompletionId" IS NOT NULL AND "maintenanceCompletionId" > 0 AND "serviceReminderId" IS NULL)
 OR ("targetType" = 'MAINTENANCE_REMINDER' AND "clientId" IS NOT NULL AND "visitId" IS NULL AND "extraVisitId" IS NULL AND "repairId" IS NULL AND "maintenanceCompletionId" IS NULL AND "serviceReminderId" IS NOT NULL AND "serviceReminderId" > 0)
);
-- Existing valuation shape constraints keep maintenance costs manual only.
