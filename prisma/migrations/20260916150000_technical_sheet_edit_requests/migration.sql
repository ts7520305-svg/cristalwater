-- Add immutable technical-sheet edit acknowledgements without altering existing pool/history records.
CREATE TABLE "TechnicalSheetEditRequest" (
    "actorKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "poolId" INTEGER NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TechnicalSheetEditRequest_pkey" PRIMARY KEY ("actorKey", "requestId")
);
CREATE INDEX "TechnicalSheetEditRequest_poolId_idx" ON "TechnicalSheetEditRequest"("poolId");
