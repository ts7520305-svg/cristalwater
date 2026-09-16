-- Add immutable pool edit acknowledgements without altering existing pool/history records.
CREATE TABLE "PoolEditRequest" (
    "actorKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "poolId" INTEGER NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PoolEditRequest_pkey" PRIMARY KEY ("actorKey", "requestId")
);
CREATE INDEX "PoolEditRequest_poolId_idx" ON "PoolEditRequest"("poolId");
