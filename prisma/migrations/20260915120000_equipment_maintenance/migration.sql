CREATE TABLE "EquipmentMaintenancePlan" (
 "id" SERIAL PRIMARY KEY, "poolId" INTEGER NOT NULL,
 "component" TEXT NOT NULL, "title" TEXT NOT NULL, "instructions" TEXT NOT NULL,
 "intervalUnit" TEXT NOT NULL, "intervalCount" INTEGER NOT NULL,
 "nextDue" DATE NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
 "version" INTEGER NOT NULL DEFAULT 1, "lastCompletedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "EquipmentMaintenancePlan_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "EquipmentMaintenancePlan_poolId_active_nextDue_idx" ON "EquipmentMaintenancePlan"("poolId","active","nextDue");
CREATE TABLE "EquipmentMaintenanceCompletion" (
 "id" SERIAL PRIMARY KEY, "planId" INTEGER NOT NULL, "version" INTEGER NOT NULL,
 "visitId" INTEGER NOT NULL, "requestId" TEXT NOT NULL, "actor" TEXT NOT NULL,
 "fingerprint" TEXT NOT NULL, "notes" TEXT NOT NULL,
 "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "result" JSONB NOT NULL,
 CONSTRAINT "EquipmentMaintenanceCompletion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "EquipmentMaintenancePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "EquipmentMaintenanceCompletion_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "ServiceVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "EquipmentMaintenanceCompletion_requestId_key" ON "EquipmentMaintenanceCompletion"("requestId");
CREATE UNIQUE INDEX "EquipmentMaintenanceCompletion_planId_version_key" ON "EquipmentMaintenanceCompletion"("planId","version");
CREATE INDEX "EquipmentMaintenanceCompletion_visitId_idx" ON "EquipmentMaintenanceCompletion"("visitId");

CREATE UNIQUE INDEX "EquipmentMaintenancePlan_poolId_title_key" ON "EquipmentMaintenancePlan"("poolId","title");

CREATE UNIQUE INDEX "EquipmentMaintenanceCompletion_planId_visitId_key" ON "EquipmentMaintenanceCompletion"("planId","visitId");
