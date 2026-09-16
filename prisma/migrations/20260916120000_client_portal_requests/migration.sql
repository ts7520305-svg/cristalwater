-- Immutable acknowledgements survive changes to message read state and notifications.
-- No historical requests are assigned an identity or silently deduplicated.
CREATE TABLE "ClientPortalRequest" (
    "actorKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientPortalRequest_pkey" PRIMARY KEY ("actorKey", "requestId")
);
CREATE INDEX "ClientPortalRequest_clientId_idx" ON "ClientPortalRequest"("clientId");
