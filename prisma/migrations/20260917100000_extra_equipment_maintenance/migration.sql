-- Existing completions keep their regular visit and their immutable result.
ALTER TABLE "EquipmentMaintenanceCompletion" ALTER COLUMN "visitId" DROP NOT NULL;
ALTER TABLE "EquipmentMaintenanceCompletion" ADD COLUMN "extraVisitId" INTEGER;
ALTER TABLE "EquipmentMaintenanceCompletion" ADD CONSTRAINT "EquipmentMaintenanceCompletion_one_visit_check"
  CHECK (("visitId" IS NOT NULL) <> ("extraVisitId" IS NOT NULL));
CREATE UNIQUE INDEX "EquipmentMaintenanceCompletion_planId_extraVisitId_key" ON "EquipmentMaintenanceCompletion"("planId", "extraVisitId");
CREATE INDEX "EquipmentMaintenanceCompletion_extraVisitId_idx" ON "EquipmentMaintenanceCompletion"("extraVisitId");
ALTER TABLE "EquipmentMaintenanceCompletion" ADD CONSTRAINT "EquipmentMaintenanceCompletion_extraVisitId_fkey"
  FOREIGN KEY ("extraVisitId") REFERENCES "ExtraVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
