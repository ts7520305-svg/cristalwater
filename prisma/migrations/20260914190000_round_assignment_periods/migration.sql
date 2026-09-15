CREATE TABLE "RoundAssignment" (
  "id" SERIAL NOT NULL,
  "roundId" INTEGER NOT NULL,
  "technicianId" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsBefore" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RoundAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoundAssignment_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RoundAssignment_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Technician"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "RoundAssignment_roundId_startsAt_idx" ON "RoundAssignment"("roundId", "startsAt");
