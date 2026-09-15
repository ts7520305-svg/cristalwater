CREATE TABLE "RepairQuote" (
 "id" SERIAL NOT NULL, "repairId" INTEGER NOT NULL, "version" INTEGER NOT NULL,
 "snapshot" JSONB NOT NULL, "createdBy" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "RepairQuote_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "RepairQuote_repairId_fkey" FOREIGN KEY ("repairId") REFERENCES "Repair"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RepairQuote_repairId_version_key" ON "RepairQuote"("repairId", "version");
