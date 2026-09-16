-- Historical messages keep null request identities; no authors are inferred.
ALTER TABLE "ClientMessage" ADD COLUMN "actorKey" TEXT, ADD COLUMN "requestId" TEXT, ADD COLUMN "payloadHash" TEXT;
CREATE UNIQUE INDEX "ClientMessage_actorKey_requestId_key" ON "ClientMessage"("actorKey", "requestId");
