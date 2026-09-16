CREATE TABLE "TechnicalProposalRequest" (
  "actorKey" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "poolId" INTEGER NOT NULL,
  "proposalId" INTEGER,
  "action" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "response" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TechnicalProposalRequest_pkey" PRIMARY KEY ("actorKey", "requestId")
);
CREATE INDEX "TechnicalProposalRequest_poolId_idx" ON "TechnicalProposalRequest"("poolId");
