-- Add immutable edit acknowledgements without changing existing client records.
CREATE TABLE "ClientEditRequest" (
    "actorKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "passwordProof" TEXT,
    "pinProof" TEXT,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientEditRequest_pkey" PRIMARY KEY ("actorKey", "requestId")
);
CREATE INDEX "ClientEditRequest_clientId_idx" ON "ClientEditRequest"("clientId");
