-- AlterTable
ALTER TABLE "ExtraVisit" ADD COLUMN     "completionRequestId" TEXT,
ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "execution" JSONB,
ADD COLUMN     "startAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VehicleStockMovement" ADD COLUMN     "extraVisitId" INTEGER;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "extraVisitId" INTEGER;

-- CreateTable
CREATE TABLE "ExtraVisitPhoto" (
    "id" SERIAL NOT NULL,
    "extraVisitId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtraVisitPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtraVisitPhoto_extraVisitId_idx" ON "ExtraVisitPhoto"("extraVisitId");

-- CreateIndex
CREATE UNIQUE INDEX "ExtraVisit_completionRequestId_key" ON "ExtraVisit"("completionRequestId");

-- CreateIndex
CREATE INDEX "VehicleStockMovement_extraVisitId_idx" ON "VehicleStockMovement"("extraVisitId");

-- CreateIndex
CREATE INDEX "StockMovement_extraVisitId_idx" ON "StockMovement"("extraVisitId");

-- AddForeignKey
ALTER TABLE "ExtraVisitPhoto" ADD CONSTRAINT "ExtraVisitPhoto_extraVisitId_fkey" FOREIGN KEY ("extraVisitId") REFERENCES "ExtraVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

